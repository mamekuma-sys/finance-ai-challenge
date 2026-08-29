# Job 실행과 상태 전이

handoff 항목 6의 최소 산출물인 "핵심 테이블과 `QUEUED → RUNNING → 완료/부분실패/실패`"를
고정한다.

이 문서는 `services/backend/src/rwa_guard/`의 **현재 동작을 서술**한 것이며 새 규칙을
제안하지 않는다. 코드와 어긋나면 둘을 같은 변경에서 갱신한다.

---

## 1. job과 scan은 다른 것이다

가장 혼동하기 쉬운 지점이라 먼저 못 박는다. **두 상태는 어휘도 개수도 다르다.**

| | `jobs.status` | `scan_runs.status` / `issuance_documents.status` |
|---|---|---|
| 뜻 | **실행 시도**가 끝났는가 | **결과**가 어떤가 |
| 값 | `QUEUED` `RUNNING` `COMPLETED` `FAILED` | `RUNNING` `COMPLETED` `PARTIAL` `FAILED` (문서는 `READY` `PARTIAL` `FAILED`) |
| 보는 사람 | worker와 운영 | 사용자, 화면, 리포트 |

**`jobs.status`에는 `PARTIAL`이 없다.** worker 입장에서 핸들러가 예외 없이 끝났으면
`COMPLETED`다. 그 안에서 일부 룰이 실패했는지는 **도메인 레코드**가 표현한다.

즉 부분 실패는 job이 아니라 결과의 속성이다. 스캔 도구 하나가 죽어도 job은 정상 종료하고
`scan_runs.status = PARTIAL`과 `failed_stages`가 무엇이 빠졌는지 남긴다.

---

## 2. 핵심 테이블

SQLAlchemy 모델이 매핑하는 테이블은 11개다.

| 테이블 | 역할 |
|---|---|
| `assets` | 자산 |
| `issuance_documents` | 발행 문서와 추출 상태 |
| `policy_constraints` | 확정된 통제조건 |
| `contracts` | 분석 대상 소스와 해시 |
| `scan_runs` | 분석 실행, 결과 상태, **결과 payload** |
| `alerts` | 경보 |
| `reports` | Evidence Report immutable snapshot |
| `audit_logs` | 변경 전후 값 |
| `operator_login_attempts` | 운영자 인증 시도 |
| `jobs` | **실행 큐** |
| `worker_heartbeats` | worker 생존 신호 |

### 발견사항은 별도 테이블이 아니다

`0001_core.sql`이 `findings`, `mismatch_findings`, `onchain_events` 테이블을 만들지만
**SQLAlchemy 모델은 이들을 매핑하지 않는다.** 실제 분석 결과는 `scan_runs.result_payload`
JSONB 하나에 들어간다.

한 번의 scan 결과를 **원자적으로 쓰고 통째로 읽기** 위한 선택이다. 리포트가 요구하는 것도
개별 finding의 갱신이 아니라 그 시점 스냅샷이다. 초기 스키마의 세 테이블은 현재 쓰이지
않으므로, 유지할지 정리할지는 팀 합의가 필요하다.

마이그레이션은 `infra/supabase/migrations/`의 `0001`~`0010`이다. P0에서 Alembic, Redis,
Celery를 추가하지 않는다. PostgreSQL job table로 충분하다.

### `jobs` 컬럼

| 컬럼 | 용도 |
|---|---|
| `id`, `job_type`, `payload` | 무엇을 실행할지 |
| `status` | `QUEUED` / `RUNNING` / `COMPLETED` / `FAILED` |
| `attempt_count`, `max_attempts` | 재시도 횟수. 기본 3회, `max_attempts > 0` 제약 |
| `available_at` | 이 시각 이후에만 집을 수 있다. 백오프에 쓴다 |
| `locked_at`, `locked_by`, `lease_token` | lease 소유권 |
| `last_error` | 마지막 실패 사유 |

`job_type`은 현재 두 가지다: `DOCUMENT_EXTRACT`, `CONTRACT_SCAN`.

---

## 3. 상태 전이

```text
            claim_next()
QUEUED ──────────────────▶ RUNNING ──── 핸들러 정상 종료 ────▶ COMPLETED
   ▲                          │
   │                          ├── 예외 & attempt < max ──┐
   │                          │                          │
   └──── 백오프 후 재시도 ◀────┘                          │
                              │                          │
                              └── 예외 & attempt >= max ─┴──▶ FAILED
```

### 3.1 claim — 한 건씩, 겹치지 않게

- `status='QUEUED'`이고 `available_at <= now`인 job을 `available_at, created_at` 순으로 하나 집는다
- PostgreSQL에서는 `SELECT ... FOR UPDATE SKIP LOCKED`를 쓴다. worker를 여러 개 띄워도
  같은 job을 두 번 집지 않는다
- 다른 dialect(테스트의 SQLite)에서는 조건부 `UPDATE ... RETURNING`으로 같은 효과를 낸다
- 집는 순간 `status='RUNNING'`, `attempt_count += 1`, `locked_by`와 새 `lease_token`을 기록한다
- worker는 **자기가 등록한 `job_type`만** 집는다

### 3.2 lease — 소유권 확인

`complete`와 `fail`은 `(id, status='RUNNING', locked_by, lease_token)`이 **모두 일치할 때만**
쓰기가 통한다. 하나라도 어긋나면 `LeaseLost`를 던진다.

이것이 막는 상황: worker A가 job을 잡은 채 멈췄고 그 사이 다른 worker B가 회수해 갔다면,
A가 뒤늦게 완료 처리를 시도해도 `lease_token`이 달라 무시된다. **늦게 깨어난 worker가
남의 결과를 덮어쓰지 못한다.**

### 3.3 실패와 재시도

`attempt_count`가 `max_attempts`(기본 3) 미만이면 `QUEUED`로 되돌리고 지수 백오프를 건다.

```
available_at = 실패시각 + retry_base_seconds × 2^(attempt_count - 1)
```

`retry_base_seconds` 기본값 5초 기준으로 5초 → 10초 → 20초다.

`attempt_count >= max_attempts`면 `FAILED`로 확정하고 `last_error`를 남긴다.

어느 쪽이든 `locked_at`, `locked_by`, `lease_token`을 비워 다음 worker가 집을 수 있게 한다.

### 3.4 heartbeat

job을 처리하는 동안 별도 스레드가 `worker_heartbeats`에 주기적으로 신호를 남긴다.
핸들러가 오래 걸려도 worker가 살아 있다는 것을 운영이 구분할 수 있다.

---

## 4. `PARTIAL`의 정의

**job이 아니라 도메인 레코드의 상태다.** 판정 기준은 job 종류마다 다르다.

### 4.1 문서 추출 (`DOCUMENT_EXTRACT`)

| 조건 | `issuance_documents.status` | `error_code` |
|---|---|---|
| P0 6개 필드를 모두 추출 | `READY` | — |
| 문서에 지시문 주입이 감지됨 | `PARTIAL` | `SUSPICIOUS_INSTRUCTIONS` |
| 일부 필드를 못 찾음 | `PARTIAL` | `MISSING_FIELDS` |
| 파싱 자체가 실패 | `FAILED` | `DocumentExtractionError.code` |

문서 파이프라인의 실패 원칙은 `document-extraction.md` §3을 따른다.

### 4.2 컨트랙트 분석 (`CONTRACT_SCAN`)

| 조건 | `scan_runs.status` |
|---|---|
| 모든 단계 완료 | `COMPLETED` |
| `failed_stages`가 하나라도 있음 | `PARTIAL` |
| 컴파일·소스 확보 실패 | `FAILED` |

`ScanRun.failed_stages`가 무엇이 실패했는지 담는다. `status = PARTIAL`이면 최소 1건이
있어야 한다는 규칙을 Pydantic validator와 JSON Schema가 양쪽에서 강제한다.

### 4.3 AI 실패는 단독으로 `FAILED`가 아니다

**결정론적 결과가 살아 있으면 `PARTIAL`이다.** P0가 AI 없이도 작동해야 하기 때문이다.
AI 타임아웃이나 호출 실패는 `limitations`에 남고 job은 정상 종료한다.

---

## 5. 소비자가 지켜야 할 것

- `PARTIAL`을 정상이나 완료로 표시하지 않는다
- job이 `COMPLETED`라고 결과가 완전한 것은 아니다. 도메인 상태를 따로 봐야 한다
- 부분 실패는 HTTP 오류가 아니다. 200 응답의 payload 필드로 나간다
- `FAILED` scan의 finding을 `안전함`이나 `통과`로 표시하지 않는다

---

## 6. 아직 없는 것

| 항목 | 상태 |
|---|---|
| `chain_cursors` | 아키텍처 문서 §4.2가 참조하지만 테이블이 없다. P1 이벤트 재수집에 필요하다 (D) |
| `risk_snapshots` | PRD `RiskSnapshot` 엔터티인데 테이블이 없다 (D) |
| lease 만료 자동 회수 | 현재 회수는 `LeaseLost` 감지에 의존한다. 멈춘 worker의 job을 시간 기준으로 되돌리는 배치는 없다 |

lease 만료 회수가 없어도 P0는 작동한다. worker가 한 대이고 재시작하면 `RUNNING`으로 남은
job이 생길 수 있으므로, 운영 중 발견되면 그때 추가한다.
