# RWA Guard Backend
Mutation 인증은 production에서 `OPERATOR_TOKEN`과 `OPERATOR_ID`가 모두
필수다. P0는 이 구성값으로 단일 검토자만 식별하며 실제 identity provider,
사용자 세션, 역할 기반 권한 관리는 구현하지 않는다. 개발·테스트의
`ALLOW_INSECURE_DEMO_OPERATOR=true`는 감사 `actor_type=INSECURE_DEMO`,
`actor_id=demo-operator`로 기록된다. 구성된 bearer는
`actor_type=OPERATOR`, `actor_id=OPERATOR_ID`로 분리해 기록한다.
Operator 잠금 해제 코드는 20자 이상 upper/lower/digit/symbol 조합이어야 한다.
`/v1/operator/session/verify`는 bearer로 보호되며 HMAC opaque fingerprint별 실패를
DB의 `operator_login_attempts`에만 저장해 5회 실패 후 15분간 제한한다. 원본
IP, User-Agent, access code는 저장하지 않는다.
`/health/operator`는 bearer/access-code 설정뿐 아니라 이 table의 필수 columns를
lightweight query로 확인하므로 migration이 적용되지 않은 배포는 ready가 아니다.


팀원 B의 기본 소유 경로이며 팀원 C의 contract pipeline, 팀원 D의 chain worker가 같은 Python package를 공유한다.

```bash
python -m venv .venv
python -m pip install -e ".[dev]"
fastapi dev src/rwa_guard/api/main.py
python -m rwa_guard.worker
```

추가 도구는 필요한 트랙에서만 설치한다.

```bash
python -m pip install -e ".[analysis,chain,valuation,dev]"
```

P0 API는 P1 패키지나 RPC 연결이 없어도 기동해야 한다.
Production은 `RWA_GUARD_FIXTURE_ROOT`가 필수다. 해당 root의
`fixtures/p0-manifest.json`에 기록된 SHA-256과 문서·Solidity fixture가 모두
일치해야 `/health/ready`와 demo bootstrap이 동작한다. 누락·변조 시 readiness와
bootstrap은 `FIXTURE_UNAVAILABLE` 503으로 닫힌다. 개발/test에서만 source package
위쪽의 저장소 manifest를 탐색한다.

worker는 `WORKER_POLL_INTERVAL_SECONDS` 간격으로 job을 claim하며
`WORKER_LOCK_TIMEOUT_SECONDS`를 넘긴 RUNNING lock을 회수한다. Task 3 handler는
`rwa_guard.worker.__main__.build_handler_registry(settings)`에서
`DOCUMENT_EXTRACT`와 `CONTRACT_SCAN`을 등록한다. handler signature는
`(job: JobRecord, session: Session) -> None`이며 transaction commit/rollback은 worker가 맡는다.
완료와 실패는 `locked_by + attempt_count + lease_token` fencing을 통과한 현재 lease만
확정할 수 있다.
idle 및 job 처리 전후 heartbeat를 `worker_heartbeats`에 upsert한다.
`/health/ready`는 `WORKER_HEARTBEAT_FRESHNESS_SECONDS` 이내의 READY heartbeat가
없거나 오래되면 503을 반환한다.

결정론적 컨트랙트 검사는 Foundry `v1.7.1`과 solc `0.8.24` AST를 사용한다. 로컬에서는
`forge`를 PATH에 두거나 `RWA_GUARD_FORGE_BIN`으로 실행 파일을 지정한다. 배포 Docker
이미지는 같은 버전의 도구와 컴파일러를 포함하며 분석 중 외부 네트워크를 사용하지 않는다.
