import logging
from datetime import timedelta

from rwa_guard.config import Settings, get_settings
from rwa_guard.db.session import build_engine, create_session_factory
from rwa_guard.fixture_store import fixture_store_for_settings
from rwa_guard.worker.core import HandlerRegistry, JobWorker
from rwa_guard.worker.handlers import build_contract_scan_handler, build_document_handler


def build_handler_registry(settings: Settings) -> HandlerRegistry:
    registry = HandlerRegistry()
    registry.register("DOCUMENT_EXTRACT", build_document_handler(settings))
    registry.register("CONTRACT_SCAN", build_contract_scan_handler(settings))
    return registry


def build_worker(settings: Settings) -> JobWorker:
    fixture_store_for_settings(settings)
    engine = build_engine(settings.database_url)
    session_factory = create_session_factory(engine)
    return JobWorker(
        session_factory=session_factory,
        registry=build_handler_registry(settings),
        worker_name=settings.worker_name,
        heartbeat_interval_seconds=max(
            0.1, settings.worker_heartbeat_freshness_seconds / 3
        ),
    )


def main() -> int:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("rwa_guard.worker")
    worker = build_worker(settings)
    logger.info(
        "worker starting; app_env=%s registered_handlers=%s",
        settings.app_env,
        sorted(worker.registry.registered_job_types),
    )
    try:
        worker.run_forever(
            poll_interval_seconds=settings.worker_poll_interval_seconds,
            lock_timeout=timedelta(seconds=settings.worker_lock_timeout_seconds),
        )
    except KeyboardInterrupt:
        logger.info("worker interrupted")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
