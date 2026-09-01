# P0 안정화 및 제출 리허설 — 2026-09-01 KST

이 문서는 합성 fixture만 사용한 로컬 제출 리허설의 실행 기록이다. 측정값은
개발 머신과 Colima 환경의 결과이며 프로덕션 정확도, 지연 또는 가용성 수치가
아니다.

## 범위 판정

- 공식 P0 필드는 `max_supply`, `issuer_role`, `collateral_verified`,
  `oracle_max_age`, `price_band_breach`, `pauser_role` 6개다.
- 공식 네트워크는 Kaia Kairos 한 개지만 제출판 온체인 증거는 `REPLAY`로
  고정한다.
- 2026-09-01 점검 시 실제 Kairos receipt, event cursor, 재수집 worker,
  `tx_hash + log_index` dedupe 실행 증거, 장애 격리 10회 중 9회 성공 기록이 없다.
  따라서 P1을 LIVE로 승격하지 않았고 시뮬레이터도 제출 화면에 렌더링하지
  않는다.
- 모든 fixture와 API 결과는 `is_synthetic=true`다. 실제 금융데이터, 개인정보,
  signer key 또는 실제 자금 이동은 사용하지 않았다.

## 수직 경로 결과

실제 Foundry와 격리 SQLite를 쓰는
`test_authenticated_vulnerable_to_fixed_p0_journey_uses_real_foundry_and_sqlite`
경로로 다음 항목을 한 번에 검증했다.

1. 합성 TXT 업로드와 결정론적 문서 추출
2. 공식 6개 필드의 page/span 원문 일치와 담당자 확정
3. 취약 Solidity 컴파일과 접근권한, 담보/발행한도, 오라클 검증 결함 3종의
   `CONFIRMED` 판정
4. 모든 Critical/High의 문서 constraint와 코드 file/line 연결
5. 수정 fixture의 Critical/High 0건과 3개 `RESOLVED` diff
6. 불변 `EvidenceReport`, JSON/HTML 다운로드와 SHA-256 일치
7. `REPLAY` 표시와 실제 receipt가 아니라는 제한 문구

Compose의 bootstrap 저장 소스도 별도로 worker에 다시 제출했다. 컴파일이
성공했고 3개 룰 모두 `CONFIRMED`, 불일치 4건, Exploit Risk 100/CRITICAL로
재현됐다. 수정 fixture 재검사는 Critical/High 0건, 불일치 0건, 3개 룰 모두
`RESOLVED`, Exploit Risk 0/LOW였다.

## 10회 반복 측정

명령:

```text
.venv/bin/python -m pytest -q \
  tests/test_task7_p0_e2e.py::test_authenticated_vulnerable_to_fixed_p0_journey_uses_real_foundry_and_sqlite \
  --disable-warnings -p no:cacheprovider
```

| 회차 | 결과 | 경과 시간 |
| ---: | :---: | --------: |
| 1 | PASS | 1,797 ms |
| 2 | PASS | 1,158 ms |
| 3 | PASS | 1,141 ms |
| 4 | PASS | 1,179 ms |
| 5 | PASS | 1,146 ms |
| 6 | PASS | 1,169 ms |
| 7 | PASS | 1,157 ms |
| 8 | PASS | 1,198 ms |
| 9 | PASS | 1,189 ms |
| 10 | PASS | 1,192 ms |

- 성공: 10/10
- 실패: 0/10
- 합계: 12,326 ms
- 평균: 1,232.6 ms
- 중앙값: 1,174 ms
- 최소/최대: 1,141/1,797 ms

## 검증 결과

- Web `npm run verify`: 27 test files, 196 tests 통과. OpenAPI 재생성 검사,
  TypeScript, ESLint, Next.js production build, client/server bundle 경계 통과.
- Backend: 272 tests 통과, Ruff 통과, mypy 26개 source files 오류 0건.
- Solidity: `forge fmt --check`, `forge build`, 2 suites/16 tests 통과.
- 문서 추출 평가셋: 합성 TXT 결정론적 parser 범위에서 60/60. AI, PDF,
  실제 금융 문서 정확도로 해석하지 않는다.
- PowerShell이 설치되지 않아 `scripts/verify.ps1` 자체는 실행하지 못했다.
  스크립트가 호출하는 Web, Backend, Foundry 검사는 위 명령으로 각각 실행했다.

## Compose, migration, readiness

- `docker-compose` 5.5.0으로 로컬 HTTP 기본값과 외부 HTTPS 환경값의
  `config --quiet`가 모두 통과했다.
- Postgres 17, API, worker, Web, nginx 이미지를 빌드하고 격리 프로젝트로
  기동했다.
- `0001`부터 `0010`까지 migration 10개가 순서대로 적용됐다. public table
  14개, 핵심 후속 migration column 4개, `reports_ready_immutable` trigger 1개를
  확인했다.
- API readiness: `status=ready`, `database=ready`.
- Web BFF readiness: `ready`, `server_configured`, `backend_operator`,
  `worker_ready`가 모두 true.
- Chromium으로 홈, 자산, 문서, 검사, 리포트 5개 route를 확인했다. 검토자
  unlock → 샘플 bootstrap → 공식 6개 필드 → 3개 룰 → REPLAY 리포트 동선이
  통과했고 console error와 page error는 각각 0건이었다.

## 공개 배포 상태

검증 시점에 공개 URL은 없다. 저장소에는 full-stack Compose 구성은 있으나
배포 provider 프로젝트/계정, HTTPS origin 또는 DNS, production database와
영속 storage, 강한 operator/Postgres/session secret이 제공되지 않았다.
GitHub Actions secret/variable도 등록되어 있지 않고 Vercel CLI 및 `apps/web`
프로젝트 연결도 없다. Web만 단독 배포하면 API, worker, PostgreSQL 경로가
없으므로 제출 가능한 공개 서비스가 되지 않는다.

공개 readiness 확인에 필요한 최소 외부 입력은 full-stack 배포 대상 접근권한,
공개 HTTPS origin/DNS, 그리고 저장소에 커밋하지 않을 production secret
주입 권한이다.
