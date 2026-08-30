# RWA Guard — 2026 금융 AI Challenge

RWA Guard는 합성 토큰증권의 **발행 문서 → 스마트컨트랙트 코드 → 온체인 이벤트 → 경보**를 하나의 Evidence Spine으로 연결하는 금융 통제 연속검증 MVP다.

## 제출 일정

| 일정 | 내용 |
|---|---|
| 2026-09-07 10:00 KST | 기획서, 기능명세서, 공개 웹서비스 URL 제출 |
| 2026-09-07 11:00 ~ 09-11 23:59 | 제출 URL 무중단 접근 필수 |
| 2026-10-08 23:59 | 발표심사 진출 시 발표자료와 소스코드 제출 |

## 범위

- **P0 제출 계약:** 문서 통제조건 추출·확정, Solidity 핵심 결함 3종 검사, 문서–코드 불일치, Evidence Spine, 취약→수정 재검사, HTML/JSON 증적, 명시적 Replay
- **P1 라이브 경쟁력:** 기준가 밴드, Kaia Kairos 이벤트 수집, 가격 무결성 경보, allowlist 시뮬레이터
- **P2 발표심사·PoC:** 추가 룰팩, 범용 프록시, 다중 자산·네트워크, 외부 알림과 기관 워크플로

자산 유형은 합성 상업용 부동산 수익증권 1종, 네트워크는 Kaia Kairos, 핵심 결함은 접근권한·담보/발행한도·오라클 검증 3종으로 고정한다.

## 저장소 구조

```text
apps/web/                 팀원 A — Next.js 관제 콘솔과 Evidence Spine
services/backend/         팀원 B — FastAPI, 문서 AI, job worker, 리포트
chain/                    팀원 C — Solidity fixture, Foundry, 보안 룰 입력
data/synthetic/           팀원 D — 합성 데이터, LIVE/REPLAY 이벤트 fixture
infra/                    팀원 D — Docker, Supabase migration, 배포 운영
contracts/                전 팀 공통 — JSON Schema와 예시 payload
docs/product/             PRD와 제품 범위
docs/architecture/        기술·시각 방향과 계약 설명
docs/project/             역할, 일정, 완료 정의
docs/submission/          제출 양식과 운영 체크
docs/competition/         공모전 원문 요약 — 수정 금지
```

## 빠른 시작

Docker와 Docker Compose를 설치한 뒤 저장소 루트에서 실행한다.

```powershell
Copy-Item .env.example .env
```

`.env`의 `POSTGRES_PASSWORD`, `OPERATOR_TOKEN`, `OPERATOR_ACCESS_CODE`,
`OPERATOR_SESSION_SECRET`을 각각 새 강한 값으로 채우고 `OPERATOR_ID`도 지정한다.
토큰과 secret을 저장소에 커밋하지 않는다. `OPERATOR_ACCESS_CODE`는 20자 이상
upper/lower/digit/symbol, `OPERATOR_SESSION_SECRET`은 32자 이상이어야 한다.
Compose는 동일한 `OPERATOR_TOKEN`을 API의 `OPERATOR_TOKEN`과 Web BFF의
`BACKEND_OPERATOR_TOKEN`으로 전달한다.

Compose는 production 모드로 API·worker·Web을 내부 네트워크에 두고 nginx
reverse proxy만 `http://localhost:3000`에 노출한다. Proxy는 외부 요청의
`X-Real-IP`과 `X-Forwarded-For`를 신뢰하지 않고 연결의 `remote_addr`로
덮어쓰며 원래 Host와 protocol을 Web에 전달한다. Web은 고정된
`TRUSTED_CLIENT_IP_HEADER=x-real-ip`, `ALLOW_INSECURE_DEMO_OPERATOR=false`로
실행된다. 기본 로컬 구성은 HTTP 개발만 가능하도록
`ALLOW_INSECURE_LOCAL_SESSION=true`와
`PUBLIC_WEB_ORIGIN=http://localhost:3000`을 함께 사용한다. 이 예외는 정확한
loopback origin에서만 session cookie의 `Secure`를 제거하며 실배포에서는
절대 사용하지 않는다. 실제 배포는 HTTPS origin과
`ALLOW_INSECURE_LOCAL_SESSION=false`를 사용해 `Secure`를 강제해야 한다.
Backend image는 P0에 필요한 합성 문서와 Solidity fixture, SHA-256 manifest만
포함하고 API·worker가 동일한 `/opt/rwa-guard-fixtures`를 사용한다. 누락 또는
hash 불일치는 readiness와 demo bootstrap에서 actionable 503으로 표시된다.

```powershell
docker compose --env-file .env -f infra/docker-compose.yml config
docker compose --env-file .env -f infra/docker-compose.yml up --build
```

별도 PowerShell에서 proxy를 통한 API/worker heartbeat와 Web BFF 준비 상태를
확인한다. API와 PostgreSQL 포트는 host에 직접 노출되지 않는다.

```powershell
Invoke-RestMethod http://localhost:3000/backend-api/health/ready
Invoke-RestMethod http://localhost:3000/api/readiness
```

### 전체 검증

PowerShell에서 `./scripts/verify.ps1`을 실행한다. Backend 개발 의존성, Web
`node_modules`, npm, Foundry/forge가 모두 필수이며 하나라도 없으면 즉시 실패한다.
검증은 backend pytest/Ruff/mypy, Web verify, forge fmt/build/test를 모두 실행한다.

### 문서 추출 평가

체크인된 합성 TXT 10개의 결정론적 P0 6필드 경로는 다음 명령으로 재현한다.

```powershell
Set-Location services/backend
$env:PYTHONPATH = (Resolve-Path src).Path
python -m pytest tests/test_document_golden.py
```

기록된 `exact_match_rate=1.0`은 이 합성 TXT 결정론적 실행 범위에만 해당한다.
Anthropic/기타 AI, PDF, 실데이터·대회 비공개 데이터, `effective_date`는 측정하지 않았으며,
이 값을 해당 경로의 정확도나 대회 성능으로 해석할 수 없다.

## 구현 기준 문서

1. [`docs/product/prd.md`](docs/product/prd.md) — 기능·우선순위·수용 기준의 단일 진실
2. [`docs/architecture/stack-and-visual-direction.md`](docs/architecture/stack-and-visual-direction.md) — 기술 경계와 Assurance Ledger UI
3. [`contracts/README.md`](contracts/README.md) — 팀 간 payload 계약
4. [`docs/project/ownership.md`](docs/project/ownership.md) — 4인 소유권과 통합 규칙

모든 샘플은 합성 데이터이며 `is_synthetic=true`를 유지한다. 실제 금융정보·개인정보·실제 투자자 자금은 사용하지 않는다.
