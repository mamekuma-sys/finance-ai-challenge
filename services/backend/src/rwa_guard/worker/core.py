from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from threading import Event, Thread
from typing import Protocol

from sqlalchemy.orm import Session, sessionmaker

from rwa_guard.db.models import JobRecord
from rwa_guard.db.repositories import (
    JobLease,
    JobRepository,
    LeaseLost,
    WorkerHeartbeatRepository,
)

REQUIRED_JOB_TYPES = frozenset({"DOCUMENT_EXTRACT", "CONTRACT_SCAN"})
WORKER_VERSION = "0.1.0"
logger = logging.getLogger(__name__)


class JobHandler(Protocol):
    """Task 3 hook: mutate domain records in the supplied transaction or raise."""

    def __call__(self, job: JobRecord, session: Session) -> None: ...


class HandlerRegistry:
    def __init__(self) -> None:
        self._handlers: dict[str, JobHandler] = {}

    @property
    def supported_job_types(self) -> set[str]:
        return set(REQUIRED_JOB_TYPES) | set(self._handlers)

    @property
    def registered_job_types(self) -> set[str]:
        return set(self._handlers)

    def register(self, job_type: str, handler: JobHandler) -> None:
        if job_type not in REQUIRED_JOB_TYPES:
            raise ValueError(f"unsupported job type: {job_type}")
        self._handlers[job_type] = handler

    def resolve(self, job_type: str) -> JobHandler:
        try:
            return self._handlers[job_type]
        except KeyError as error:
            raise LookupError(f"no handler registered for {job_type}") from error


class JobWorker:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        registry: HandlerRegistry,
        worker_name: str,
        *,
        retry_base_seconds: int = 5,
        heartbeat_interval_seconds: float = 10.0,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.session_factory = session_factory
        self.registry = registry
        self.worker_name = worker_name
        self.retry_base_seconds = retry_base_seconds
        self.heartbeat_interval_seconds = heartbeat_interval_seconds
        self.clock = clock or (lambda: datetime.now(UTC))
        self._stop_event = Event()

    def heartbeat(self, *, status: str = "READY", now: datetime | None = None) -> None:
        with self.session_factory() as session, session.begin():
            WorkerHeartbeatRepository(session).record(
                self.worker_name,
                status,
                sorted(self.registry.supported_job_types),
                WORKER_VERSION,
                now=now,
            )

    def run_once(self, *, now: datetime | None = None) -> bool:
        claimed_at = now or self.clock()
        with self.session_factory() as claim_session, claim_session.begin():
            claimed = JobRepository(claim_session).claim_next(
                self.worker_name,
                now=claimed_at,
                job_types=self.registry.registered_job_types,
            )
            if claimed is None:
                return False
            lease = JobLease.from_record(claimed)

        try:
            self.heartbeat(status="READY", now=self.clock())
            with self.session_factory() as handler_session, handler_session.begin():
                repository = JobRepository(handler_session)
                job = repository.get_for_lease(lease)
                if job is None:
                    raise LeaseLost(f"job lease lost before handler start: {lease.job_id}")
                heartbeat_stop = Event()
                heartbeat_thread = Thread(
                    target=self._heartbeat_during_job,
                    args=(heartbeat_stop,),
                    daemon=True,
                    name=f"{self.worker_name}-heartbeat",
                )
                heartbeat_thread.start()
                try:
                    self.registry.resolve(job.job_type)(job, handler_session)
                finally:
                    heartbeat_stop.set()
                    heartbeat_thread.join()
                repository.complete(lease, now=self.clock())
        except LeaseLost:
            raise
        except Exception as error:
            failed_at = self.clock()
            with self.session_factory() as failure_session, failure_session.begin():
                JobRepository(failure_session).fail(
                    lease,
                    str(error),
                    now=failed_at,
                    retry_base_seconds=self.retry_base_seconds,
                )
        finally:
            self.heartbeat(status="READY", now=self.clock())
        return True

    def _heartbeat_during_job(self, stop_event: Event) -> None:
        while not stop_event.wait(self.heartbeat_interval_seconds):
            try:
                self.heartbeat(status="READY", now=self.clock())
            except Exception:
                logger.exception("worker heartbeat refresh failed during job")

    def stop(self) -> None:
        self._stop_event.set()

    def run_forever(
        self,
        *,
        poll_interval_seconds: float,
        lock_timeout: timedelta,
        stop_event: Event | None = None,
    ) -> None:
        external_stop = stop_event or Event()
        try:
            while not self._stop_event.is_set() and not external_stop.is_set():
                now = self.clock()
                with self.session_factory() as session, session.begin():
                    JobRepository(session).recover_stale(now=now, lock_timeout=lock_timeout)
                self.heartbeat(status="READY", now=now)
                try:
                    processed = self.run_once(now=now)
                except LeaseLost as error:
                    logger.warning("%s", error)
                    processed = True
                if not processed:
                    self._stop_event.wait(poll_interval_seconds)
        finally:
            self.heartbeat(status="STOPPING", now=self.clock())


HandlerFactory = Callable[[], JobHandler]
