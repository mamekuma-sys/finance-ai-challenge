# Job 실행과 상태 전이

이 문서는 현재 저장소의 migration, SQLAlchemy model, repository, worker, API가 실제로
수행하는 동작만 설명한다. P1 설계 문서에만 있는 항목은 마지막 절에 분리한다.

## 1. job 상태와 결과 상태

`jobs`는 여러 실행 시도를 포함하는 큐 항목이고, 문서와 scan 상태는 사용자가 보는
처리 결과다. 따라서 job의 완료 여부와 도메인 결과의 성공 여부는 같지 않다.

| 레코드 | 현재 코드가 사용하는 상태 |
|---|---|
| `jobs.status` | `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED` |
| `issuance_documents.status` | `UPLOADED`, `PROCESSING`, `READY`, `PARTIAL`, `FAILED` |
| `scan_runs.status` | `QUEUED`, `RUNNING`, `COMPLETED`, `PARTIAL`, `FAILED` |
| `reports.status` | `QUEUED`, `READY`, `FAILED` |

`jobs.status`에는 `PARTIAL`이 없다. handler의 정상 반환만으로 job이 `COMPLETED`가
되는 것은 아니다. claim 뒤 handler 실행 전 heartbeat가 성공하고, handler transaction이
`complete`까지 도달하며, `complete`의 fenced update가 현재 lease와 일치해야
`COMPLETED`로 확정된다. 실제 handler는 다음과 같이 도메인 실패를 레코드에 기록한 뒤
정상 반환할 수 있다.

- 문서 파싱 오류와 저장소 읽기 오류: 문서를 `FAILED`로 기록
- contract scan 내부 예외: scan과 report를 `FAILED`로 기록

이 도메인 실패 기록 뒤 `complete`까지 성공하면 `job=COMPLETED`이면서 문서 또는 scan은
`FAILED`일 수 있다. `run_once`의 try block에서 발생한 `LeaseLost` 이외 예외는
`JobRepository.fail` 경로로 간다. 여기에는 handler가 내보낸 예외뿐 아니라 handler 실행
전 heartbeat 오류도 포함된다. 반면 stale recovery 등으로 lease가 무효화되어
`get_for_lease` 또는 `complete`가 `LeaseLost`를 내면 `fail`을 호출하지 않고 다시
전파하며, 진행 중이던 handler transaction은 rollback된다.

근거: [`build_document_handler`, `build_contract_scan_handler`](../../services/backend/src/rwa_guard/worker/handlers.py),
[`JobWorker.run_once`](../../services/backend/src/rwa_guard/worker/core.py).

## 2. 현재 영속화 구조

적용 순서가 `0001`~`0010`인 SQL migration은 총 14개 테이블을 만든다.

- SQLAlchemy가 매핑하는 11개: `assets`, `issuance_documents`,
  `policy_constraints`, `contracts`, `scan_runs`, `reports`, `alerts`,
  `audit_logs`, `operator_login_attempts`, `jobs`, `worker_heartbeats`
- migration에는 있지만 ORM model이 없는 3개: `findings`,
  `mismatch_findings`, `onchain_events`

현재 worker는 finding, mismatch, onchain 결과를 별도 세 테이블에 쓰지 않는다.
contract scan 결과는 `scan_runs.result_payload`에, Evidence Report snapshot은
`reports.evidence`에 저장한다.

근거: [`0001_core.sql`](../../infra/supabase/migrations/0001_core.sql),
[`0002_p0_workflow.sql`](../../infra/supabase/migrations/0002_p0_workflow.sql),
[`0004_task3_scan_results.sql`](../../infra/supabase/migrations/0004_task3_scan_results.sql),
[`0008_operator_login_attempts.sql`](../../infra/supabase/migrations/0008_operator_login_attempts.sql),
[`db/models.py`](../../services/backend/src/rwa_guard/db/models.py).

### `jobs` 필드

| 필드 | 현재 의미 |
|---|---|
| `id`, `job_type`, `payload` | 실행 대상과 입력 |
| `status` | 큐 항목 상태 |
| `attempt_count` | 성공 여부와 무관하게 claim된 총 횟수. 최초값 0 |
| `max_attempts` | 허용되는 총 claim 횟수. 기본값 3, `> 0` 제약 |
| `available_at` | 다음 claim이 가능한 시각 |
| `locked_at`, `locked_by`, `lease_token` | 현재 실행 소유권 |
| `last_error` | 마지막 handler 실패 또는 stale recovery 사유 |

현재 등록되는 `job_type`은 `DOCUMENT_EXTRACT`, `CONTRACT_SCAN` 두 가지다.

근거: [`JobRecord`](../../services/backend/src/rwa_guard/db/models.py),
[`JobRepository.enqueue`](../../services/backend/src/rwa_guard/db/repositories.py),
[`build_handler_registry`](../../services/backend/src/rwa_guard/worker/__main__.py).

## 3. enqueue, claim, 실행

### 3.1 enqueue와 claim

`JobRepository.enqueue`는 `max_attempts=3`, `attempt_count=0`, 즉시 실행 가능한
`available_at`으로 job을 만든다. 여기서 3은 **재시도 3회가 아니라 최초 시도를 포함한
최대 3회 실행**이다.

`claim_next`는 `status='QUEUED' AND available_at <= now`를 만족하고 worker에 등록된
type인 job 하나를 `available_at, created_at` 순으로 선택한다.

- PostgreSQL: `SELECT ... FOR UPDATE SKIP LOCKED` 후 row를 `RUNNING`으로 변경한다.
- PostgreSQL 이외 dialect: 같은 자격 조건을 다시 포함한 단일
  `UPDATE ... RETURNING`을 실행한다. 현재 SQLite 테스트가 이 경로를 검증한다.
- claim이 성공하는 순간 `attempt_count`를 1 증가시키고 `locked_at`, `locked_by`,
  새로운 `lease_token`을 기록한다. handler 호출 전에 이미 증가한 값이다.

PostgreSQL의 stale row 선택도 worker끼리 회수 작업이 겹치지 않도록
`FOR UPDATE SKIP LOCKED`를 사용한다.

근거: [`JobRepository.claim_next`, `recover_stale`](../../services/backend/src/rwa_guard/db/repositories.py),
[`test_postgresql_claim_uses_skip_locked`](../../services/backend/tests/test_task2_api_worker.py).

### 3.2 handler transaction과 fencing

claim transaction이 끝난 뒤 worker는 먼저 `READY` heartbeat를 기록한다. 이 호출이
`LeaseLost` 이외 예외를 내면 handler를 시작하지 않고 fenced `fail`을 시도한다.

heartbeat가 성공하면 별도 transaction에서 현재 lease를 다시 조회하고 handler를
실행한 뒤 `complete`를 호출한다. handler 변경과 `complete`는 같은 transaction에
있으므로 완료 fencing이 실패해 `LeaseLost`가 발생하면 그 transaction의 도메인 변경도
rollback된다. 따라서 handler의 정상 반환은 완료의 필요조건이지만 충분조건은 아니다.

`complete`와 `fail`은 다음 다섯 조건이 모두 맞는 row만 갱신한다.

```text
id
status = RUNNING
locked_by
lease_token
attempt_count
```

일치하는 row가 없으면 `LeaseLost`가 발생한다. stale recovery 뒤 다시 claim한 worker는
새 `lease_token`과 증가한 `attempt_count`를 받으므로 이전 worker가 늦게 완료 또는 실패
처리를 해도 새 lease를 덮어쓸 수 없다.

근거: [`JobLease`, `JobRepository._lease_conditions`](../../services/backend/src/rwa_guard/db/repositories.py),
[`test_stale_lease_cannot_finalize_or_persist_handler_side_effect`](../../services/backend/tests/test_task2_api_worker.py).

### 3.3 heartbeat

worker는 idle loop, job 처리 전후, 장시간 handler 실행 중 별도 thread에서 heartbeat를
기록한다. 허용된 heartbeat 상태는 `STARTING`, `READY`, `DEGRADED`, `STOPPING`이지만
현재 `JobWorker` 실행 경로는 `READY`와 종료 시 `STOPPING`만 기록한다.

heartbeat는 생존 신호일 뿐 lease 갱신이 아니다. 처리 중 heartbeat를 새로 써도
`jobs.locked_at`은 갱신되지 않는다. handler 실행 전 heartbeat 오류는 `fail` 경로로
가지만, handler 중 heartbeat thread의 오류는 잡아서 log만 남긴다. `run_once`의
`finally`에서 실행하는 처리 후 heartbeat 오류는 앞선 `fail` 분기로 다시 들어가지 않고
호출자에게 전파된다.

근거: [`JobWorker.heartbeat`, `_heartbeat_during_job`](../../services/backend/src/rwa_guard/worker/core.py),
[`WorkerHeartbeatRecord`](../../services/backend/src/rwa_guard/db/models.py).

## 4. stale RUNNING 자동 회수

시간 기준 회수는 이미 구현되어 있다. `JobWorker.run_forever`는 매 poll loop에서
job claim 전에 `JobRepository.recover_stale`을 호출한다. 기본 설정은 poll 1초,
lock timeout 300초다.

회수 조건은 다음과 같다.

```text
status = RUNNING
locked_at IS NOT NULL
locked_at <= now - lock_timeout
```

해당 row의 lock 필드를 비우고 `last_error='stale worker lock recovered'`를 기록한다.

- `attempt_count < max_attempts`: 즉시 claim 가능하도록 `QUEUED`,
  `available_at=recovered_at`으로 변경
- `attempt_count >= max_attempts`: `FAILED`로 확정

stale recovery 자체는 `attempt_count`를 증가시키지 않고 백오프도 적용하지 않는다.
다음 claim 시점에 횟수가 증가한다. 또한 heartbeat의 상태나 최신성은 회수 조건에
포함되지 않는다. 그러므로 handler가 lock timeout보다 오래 실행되면 worker가 살아
있어도 다른 loop가 그 job을 회수할 수 있으며, 이 경우 fencing이 이전 transaction의
확정을 차단한다.

근거: [`JobRepository.recover_stale`](../../services/backend/src/rwa_guard/db/repositories.py),
[`JobWorker.run_forever`](../../services/backend/src/rwa_guard/worker/core.py),
[`Settings`](../../services/backend/src/rwa_guard/config.py),
[`test_stale_running_jobs_are_requeued_then_terminally_failed`](../../services/backend/tests/test_task2_api_worker.py).

## 5. handler 예외 재시도와 백오프

`JobWorker.run_once`의 try block에서 `LeaseLost` 이외 예외가 발생하면
`JobRepository.fail`을 호출한다. handler가 내보낸 예외와 handler 실행 전 heartbeat
오류가 이 경로에 포함된다. `fail`도 현재 lease 조건으로 fenced update를 하므로 그사이
lease를 잃었다면 `LeaseLost`를 낸다. `get_for_lease` 또는 `complete`에서 직접 발생한
`LeaseLost`는 이 재시도 분기를 우회해 호출자에게 다시 전파된다.

```text
delay = retry_base_seconds * 2 ** max(attempt_count - 1, 0)
```

`retry_base_seconds`의 코드 기본값은 5초다. `retry_delay_seconds`라는 설정이나
함수는 현재 없다. 기본 `max_attempts=3`의 실제 전이는 다음과 같다.

| 실패한 claim | 결과 |
|---|---|
| 1회차 | `QUEUED`, 5초 뒤 재시도 가능 |
| 2회차 | `QUEUED`, 10초 뒤 재시도 가능 |
| 3회차 | `FAILED`, 추가 재시도 없음 |

20초 지연은 `max_attempts >= 4`인 job이 3회차에 실패했을 때만 계산된다.
재시도와 최종 실패 모두 lock 필드를 비우고 handler 오류를 `last_error`에 남긴다.

근거: [`JobRepository.fail`](../../services/backend/src/rwa_guard/db/repositories.py),
[`JobWorker.__init__`, `run_once`](../../services/backend/src/rwa_guard/worker/core.py),
[`test_worker_retries_with_backoff_then_marks_terminal_failed`](../../services/backend/tests/test_task2_api_worker.py).

## 6. 실제 `PARTIAL`과 degraded 노출

### 6.1 문서 추출

[`build_document_handler`](../../services/backend/src/rwa_guard/worker/handlers.py)의 판정은
다음과 같다.

| 조건 | 문서 상태 | `error_code` |
|---|---|---|
| 의심스러운 문서 지시문 감지 | `PARTIAL` | `SUSPICIOUS_INSTRUCTIONS` |
| P0 6개 필드를 모두 추출 | `READY` | 없음 |
| 하나 이상의 P0 필드 누락 | `PARTIAL` | `MISSING_FIELDS` |
| `DocumentExtractionError` | `FAILED` | 예외의 code |
| 저장소 `OSError` | `FAILED` | `STORAGE_READ_FAILED` |

Anthropic 호출 실패 또는 미설정은 deterministic fallback과 `limitations`로 기록된다.
최종 상태는 AI 실패 자체가 아니라 위 필드 누락 판정에 따른다. 현재 호출 조건상 AI는
deterministic 결과에 누락 필드가 있을 때만 시도되므로 호출이 실패하면 해당 문서는
`PARTIAL/MISSING_FIELDS`가 된다.

근거: [`extract_controls`](../../services/backend/src/rwa_guard/pipelines/document.py),
[`build_document_handler`](../../services/backend/src/rwa_guard/worker/handlers.py).

### 6.2 contract scan

현재 handler가 `PARTIAL`로 만드는 조건은 code finding 중 하나 이상이
`UNKNOWN` 또는 `NEEDS_REVIEW`인 경우뿐이다. 이때
`failed_stages=[{stage: "contract_analysis", ...}]`를 기록한다.

컴파일러 실행 실패 등 `analyze_contract_sources`가 처리하는 분석 실패는
`UNKNOWN` finding으로 변환되므로 `PARTIAL`이 된다. 반면 저장된 source가 없거나
handler의 다른 예외가 발생하면 handler가 scan과 report를 `FAILED`로 기록한다.

`ScanRun` Pydantic model과 JSON Schema는 `PARTIAL`이면 `failed_stages`가 최소 1개여야
함을 강제한다.

근거: [`analyze_contract_sources`](../../services/backend/src/rwa_guard/pipelines/contract.py),
[`build_contract_scan_handler`](../../services/backend/src/rwa_guard/worker/handlers.py),
[`ScanRun.partial_requires_failed_stages`](../../services/backend/src/rwa_guard/domain/contracts.py).

### 6.3 API와 health

- scan 조회는 저장된 `PARTIAL`/`FAILED`를 응답 payload에 노출하고, 둘의 freshness를
  `INVALID`로 계산한다.
- 문서 조회는 저장된 `PARTIAL`과 `error_code`, `failed_pages`를 payload에 노출한다.
- `/health`에는 `PARTIAL` 상태가 없다. `p0_ready` boolean과 P1 chain의
  `configured`/`disabled`만 반환한다.
- `/health/ready`는 DB, 인증, fixture, heartbeat를 검사한다. heartbeat가 없으면
  `WORKER_HEARTBEAT_MISSING` 503, 최신 `READY`가 아니면
  `WORKER_HEARTBEAT_STALE` 503을 반환한다. 저장 가능한 `DEGRADED` heartbeat도
  별도 상태 payload가 아니라 이 503 경로로 처리된다.

근거: [`derive_scan_freshness`, `/health`, `/health/ready`](../../services/backend/src/rwa_guard/api/routes.py).

## 7. 현재 구현과 미래 계획의 경계

| 항목 | 현재 상태 |
|---|---|
| PostgreSQL table job queue | 구현됨 |
| SQLite 테스트용 `UPDATE ... RETURNING` claim | 구현됨 |
| stale RUNNING 시간 기준 회수 | 구현됨 |
| lease fencing | 구현됨 |
| handler 중 `locked_at` 갱신 또는 heartbeat 기반 lease 연장 | 구현되지 않음 |
| `chain_cursors` | migration/model 없음. P1 설계 문서에만 있음 |
| `risk_snapshots` | migration/model 없음. P1 설계 문서에만 있음 |
| Redis/Celery/Alembic queue runtime | 현재 구현에 없음 |

`chain_cursors`와 `risk_snapshots`를 사용하는 event worker/Realtime 흐름은
[`stack-and-visual-direction.md` §4.2, §5.2](stack-and-visual-direction.md)의 P1 계획이며
현재 완료된 동작으로 간주하지 않는다.
