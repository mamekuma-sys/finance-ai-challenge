# RWA Guard 제출 인수인계 — 2026-09-02 KST

## 결론

`main`의 P0 코드와 로컬 제출 리허설은 안정화됐다. 지금 가장 먼저 할 일은
**Web만이 아닌 API·worker·PostgreSQL을 포함한 full-stack 공개 HTTPS 배포**다.
배포 권한이 확보되기 전까지 P1 LIVE 기능을 새로 만들지 않는다. 현재 제출판은
실제 Kairos receipt가 없으므로 `REPLAY`가 맞다.

## 인수 기준선

- 검증된 P0 코드 기준선: `6d573f6` (이후 변경은 이 인수인계 문서뿐)
- GitHub CI: [run 33473634237](https://github.com/mamekuma-sys/finance-ai-challenge/actions/runs/33473634237), 3/3 통과
- 기존 핵심 PR #9, #10, #11, #12: `main`에 반영 후 종료
- 오래된 PR #1, #2: 병합하지 않는다. 최신 `main`이 고유 요구사항을 대체하는지
  확인만 하고, 사용자 승인 없이 브랜치나 PR을 삭제하지 않는다.
- 작업 트리에서 허용되는 유일한 로컬 항목: 미추적 `app/` 약 606 MB. 빌드
  산출물이므로 열거나 커밋하지 않는다.
- `docs/competition/`은 읽기 전용이다. 제출 양식 원본은
  `docs/submission/templates/`에 있다.
- 기존 로컬 Compose 검증 환경은 종료했지만 volume은 보존했다.

인수 직후 아래 결과가 아니면 작업을 시작하기 전에 변경 원인을 확인한다.

```bash
git fetch --prune origin
git status --short --branch
git rev-parse --short HEAD
git rev-parse --short origin/main
```

예상값은 `main...origin/main`, `HEAD`와 `origin/main`의 동일한 commit, 그리고
`?? app/`뿐이다.

## 현재 P0 상태

| 기능 | 상태 | 확인된 결과 |
| --- | --- | --- |
| 샘플 bootstrap | 완료 | 저장한 Solidity source byte와 SHA-256이 일치하고 다시 컴파일됨 |
| 문서 검토 | 완료 | 합성 TXT에서 공식 6개 필드와 page/span 근거 재현 |
| 컨트랙트 검사 | 완료 | 접근권한, 담보·발행한도, 오라클 검증 결함 3종 `CONFIRMED` |
| Evidence 연결 | 완료 | 모든 Critical/High에 문서 page/span과 코드 file/line 연결 |
| 재검사 diff | 완료 | 수정 fixture에서 Critical/High 0건, 3개 룰 `RESOLVED` |
| Exploit Risk | 완료 | 서버가 취약본 100/CRITICAL, 수정본 0/LOW를 계산하고 Web과 일치 |
| 리포트 | 완료 | 불변 EvidenceReport와 HTML/JSON SHA-256 검증 |
| AI 경계 | 완료 | AI 단독 결과는 `NEEDS_REVIEW`; 결정적 근거 없이 승격하지 않음 |
| 온체인 표시 | 완료 | 제출 UI는 `REPLAY`; receipt 없는 데이터를 `LIVE`로 표시하지 않음 |
| 로컬 운영 | 완료 | Compose, migration 10개, API/Web readiness, 브라우저 5개 route 검증 |
| 반복 리허설 | 완료 | 실제 Foundry+SQLite P0 E2E 10/10, 평균 1,232.6 ms |
| 공개 배포 | **차단** | 공개 URL, 배포 대상, HTTPS origin/DNS, 운영 secret 주입 권한 없음 |

측정 범위와 세부 로그는
[`docs/project/p0-stabilization-2026-09-01.md`](docs/project/p0-stabilization-2026-09-01.md)를
기준으로 한다. 합성 TXT 평가 60/60과 로컬 시간은 AI/PDF/실데이터 정확도나
프로덕션 성능·가용성 수치가 아니다.

## 다음 작업 — 우선순위와 완료 조건

### P0-1. full-stack 공개 HTTPS 배포 확보 — 9월 2일 즉시

담당: D(배포·도메인·모니터링), B(API·worker·DB), A(Web origin·공개 동선)

1. Docker Compose 또는 동등한 구성으로 nginx/Web/API/worker/PostgreSQL과
   영속 DB storage를 함께 운영할 수 있는 배포 대상을 정한다.
2. 공개 HTTPS origin과 DNS/TLS를 연결한다. Web만 Vercel에 올리는 구성은
   API·worker·DB가 없어 제출판이 아니므로 완료로 보지 않는다.
3. provider의 secret manager에 아래 값을 강한 운영값으로 주입한다.

   - `POSTGRES_PASSWORD`
   - `OPERATOR_TOKEN`
   - `OPERATOR_ID`
   - `OPERATOR_ACCESS_CODE`
   - `OPERATOR_SESSION_SECRET`
   - `PUBLIC_WEB_ORIGIN=https://<실제-host>`
   - `ALLOW_INSECURE_LOCAL_SESSION=false`

   secret 값은 채팅, 이 문서, 로그, Git에 쓰지 않는다. `NEXT_PUBLIC_` 접두사를
   붙이지 않으며 signer key도 배포하지 않는다. fixture는 image에 포함된
   `/opt/rwa-guard-fixtures`와 manifest를 사용한다.
4. HTTPS reverse proxy가 실제 Host와 scheme을 Web까지 보존하도록 한다.
   `PUBLIC_WEB_ORIGIN`은 scheme-host-port가 공개 URL과 정확히 같아야 한다.
5. clean DB에서 migration `0001`~`0010`과 bootstrap을 실행하고 재실행해도
   데이터가 중복되거나 깨지지 않는지 확인한다.

Compose를 직접 지원하는 배포 shell에서는 다음 순서를 쓴다. `<secure-env>`는
배포 환경에서만 접근 가능한 경로이며 저장소 안에 두지 않는다.

```bash
git pull --ff-only origin main
docker compose --env-file <secure-env> -f infra/docker-compose.yml config --quiet
docker compose --env-file <secure-env> -f infra/docker-compose.yml up --build -d
```

완료 조건:

- `https://<host>/backend-api/health/ready`가 HTTP 200이며
  `status=ready`, `database=ready`
- `https://<host>/api/readiness`가 HTTP 200이며 `ready`,
  `server_configured`, `backend_operator`, `worker_ready`가 모두 `true`
- 비로그인 시크릿 브라우저에서 홈·자산·문서·검사·리포트 5개 route가 열림
- 운영자 unlock 후 sample bootstrap부터 HTML/JSON 다운로드까지 완주

### P0-2. 공개 환경 수용 테스트 — 배포 직후, 늦어도 9월 4일

담당: A(브라우저), B/C(검사·리포트), D(운영 로그)

1. 합성 샘플을 불러와 공식 6개 필드
   `max_supply`, `issuer_role`, `collateral_verified`, `oracle_max_age`,
   `price_band_breach`, `pauser_role`를 확인한다.
2. 취약 source가 컴파일되고 핵심 3종이 `UNKNOWN`이 아닌 결정적 결과로
   탐지되는지 확인한다.
3. Critical/High마다 문서 page/span과 코드 file/line이 함께 표시되는지
   확인한다.
4. 수정 fixture 재검사에서 Critical/High 0건, 세 룰 `RESOLVED`,
   Exploit Risk 100/CRITICAL → 0/LOW diff를 확인한다.
5. EvidenceReport와 HTML/JSON을 내려받아 화면 값, source hash, report hash가
   일치하는지 확인한다.
6. 모든 화면과 export에 `REPLAY`, `is_synthetic=true`, receipt 부재 제한을
   정직하게 표시하는지 확인한다.
7. 공개 HTTPS 환경에서 전체 동선을 10회 실행해 성공/실패, 시작·종료 시각,
   소요 시간을 실측한다. 9회 미만 성공이면 제출 가능 상태가 아니다.
8. 결과는 `docs/project/public-rehearsal-YYYY-MM-DD.md`에 새로 기록한다.
   로컬 10/10 기록을 공개 배포 실적으로 재사용하지 않는다.

공개 smoke check 예시:

```bash
curl -fsS https://<host>/backend-api/health/ready
curl -fsS https://<host>/api/readiness
```

운영자 access code나 token을 명령 예시에 넣지 않는다.

### P0-3. 전체 회귀 검증 — 공개 수용 테스트와 같은 commit

담당: 각 트랙 소유자, 최종 확인은 전원

```bash
cd apps/web && npm run verify
cd services/backend && python -m pytest && python -m ruff check . && python -m mypy
cd chain && forge fmt --check && forge build && forge test
powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
```

마지막 로컬 기준은 Web 27 files/196 tests, Backend 272 tests, mypy 26 sources,
Chain 2 suites/16 tests다. PowerShell이 없는 환경에서는 wrapper 미실행을 환경
제약으로 기록하고 위 구성요소 명령을 각각 통과시킨다. 테스트 수가 달라지면
그 시점의 정확한 실제 수를 새 기록에 남긴다.

### P1 게이트 판정 — 9월 3일

현재 판정은 **승격 안 함 / 제출판 REPLAY 고정**이다. 아래 증거가 모두 이미
존재하고 재현될 때만 `LIVE` 노출을 재검토한다.

- 실제 Kaia Kairos receipt
- event cursor 영속화와 stale recovery
- `tx_hash + log_index` dedupe
- P1 장애가 P0를 막지 않는 장애 격리
- LIVE 전체 동선 10회 중 9회 이상 성공한 실행 기록

현재 저장소에는 이 다섯 항목을 충족하는 실행 증거가 없다. 9월 3일 게이트를
넘기지 못하면 P1 구현, simulator, 미완성 LIVE UI를 새로 추가하지 않는다.
P0를 통과시키기 위해 `LIVE/REPLAY`나 Evidence 불변식을 약화해서도 안 된다.

### 기능 동결 — 9월 5일

담당: 전원

- 신규 기능, 자산 유형, 네트워크, 핵심 룰 추가를 중단한다.
- 이후 변경은 공개 배포 blocker, 복구, 보안, 제출 문서 오류만 허용한다.
- `NOTICE.md`와 포함된 외부 코드·데이터의 라이선스/출처를 마지막 확인한다.
- 브라우저 bundle, image layer, 로그, 제출 파일에 secret이 없는지 확인한다.
- clean 배포 및 DB 복구 리허설을 한 번 수행한다.
- 공개 수용 테스트가 통과한 정확한 commit에만 immutable submission tag를
  만든다. 후보명은 `submission-p0-2026-09-05`이며, 검증 전에는 만들지 않는다.

### 제출 문서와 최종 리허설 — 9월 6일 밤까지

담당: 전원, 최종 제출 책임자 1명 지정

1. `docs/submission/templates/`의 데이콘 HWPX 양식으로 기획서와 기능명세서를
   작성해 PDF 2종으로 변환한다. 제품의 HTML/JSON EvidenceReport와 대회 제출
   PDF 2종은 서로 다른 산출물이다.
2. 문서의 기능명, P0 6개 필드, 3개 룰, 공개 URL, `REPLAY` 상태를 실제 제품과
   일치시킨다. P1 미구현, 합성 TXT 60/60, 로컬 성능을 과장하지 않는다.
3. 비로그인 시크릿 브라우저와 일반 데스크톱 viewport에서 공개 URL의 10회
   리허설 결과가 9/10 이상인지 재확인한다.
4. 9월 6일 밤까지 PDF 2종과 공개 URL 제출을 목표로 한다.

### 마감과 URL 유지 — 9월 7일~11일

담당: D(모니터링), 지정 제출 책임자

- 9월 7일 10:00 KST 전에 기획서 PDF, 기능명세서 PDF, 공개 URL 제출을
  완료한다.
- 9월 7일 10:30과 11:00에 외부 네트워크에서 URL과 readiness를 다시 확인한다.
- 9월 7일 11:00부터 9월 11일 23:59 KST까지 URL과 DB를 유지하고 readiness
  알림 담당자를 둔다.
- 마감 후에는 대회 규정이 허용하지 않는 코드 수정·재배포를 하지 않는다.

## 역할별 바로 할 일

| 트랙 | 다음 행동 | 인계 산출물 |
| --- | --- | --- |
| A — Web | 공개 origin/CSRF/session 확인, 5 route와 Evidence diff 수용 테스트 | 브라우저 결과와 오류 0건 기록 |
| B — Backend | 운영 DB/worker 배포, migration, readiness, bootstrap 재실행 검증 | API/Web readiness와 migration 기록 |
| C — Contract | 공개 bootstrap source 재컴파일, 취약·수정 fixture 3종 회귀 | finding/evidence/diff 결과 |
| D — Infra | provider, DNS/TLS, secret manager, storage, uptime alert 구성 | 공개 HTTPS URL과 모니터링 책임자 |
| 전원 | 제출 PDF 2종 교차 검토, 최종 10회 리허설 | 제출본, URL, 측정 로그 |

## 외부 blocker와 요청할 최소 권한

현재 로컬에서 남은 코드 blocker는 없다. 공개 배포가 계속 막히면 실제 secret
값을 요청하지 말고 아래 권한만 요청한다.

1. full-stack 배포 대상의 프로젝트 접근권한
2. 공개 HTTPS origin/DNS 설정 권한
3. provider secret manager에 운영값을 직접 주입할 권한
4. production PostgreSQL과 영속 storage 생성 권한

이 권한이 없으면 Web 단독 임시 URL을 제출 가능 상태로 보고하지 않는다.
권한이 생기기 전까지 가능한 일은 제출 PDF 초안, 라이선스 점검, 로컬 회귀
검증뿐이며 P1 범위를 확대하지 않는다.

## 변경 금지선

- `docs/competition/` 수정 금지
- 미추적 `app/` 커밋 금지
- 삭제된 과거 프로젝트 코드를 Git 이력에서 복원하지 않음
- 실제 금융데이터·개인정보·실제 자금 이동·자동 승인/정지 구현 금지
- 환경변수, operator secret, signer key 커밋 또는 출력 금지
- 실제 receipt가 없는 데이터의 `LIVE` 표시 금지
- AI 단독 결과의 `CONFIRMED` 승격 금지
- P0 통과 전 새 자산·네트워크·핵심 룰 추가 금지

## 참고 문서

- 제품 기준: [`docs/product/prd.md`](docs/product/prd.md)
- 기술·시각 기준: [`docs/architecture/stack-and-visual-direction.md`](docs/architecture/stack-and-visual-direction.md)
- 팀 계약: [`contracts/schemas/`](contracts/schemas/),
  [`docs/project/ownership.md`](docs/project/ownership.md)
- 운영 방법: [`infra/README.md`](infra/README.md)
- 완료 정의: [`docs/project/definition-of-done.md`](docs/project/definition-of-done.md)
- 제출 일정: [`docs/project/milestones.md`](docs/project/milestones.md)
- 제출 작업공간: [`docs/submission/README.md`](docs/submission/README.md)
