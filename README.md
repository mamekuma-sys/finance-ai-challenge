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

### Web

```bash
cd apps/web
npm install
npm run dev
```

### API와 worker

```bash
cd services/backend
python -m venv .venv
python -m pip install -e ".[dev]"
fastapi dev src/rwa_guard/api/main.py
python -m rwa_guard.worker
```

### 전체 검증

PowerShell에서 `./scripts/verify.ps1`을 실행한다. 설치되지 않은 도구는 명확히 건너뛰며, 설치된 Web/Python/Foundry 검사를 수행한다.

## 구현 기준 문서

1. [`docs/product/prd.md`](docs/product/prd.md) — 기능·우선순위·수용 기준의 단일 진실
2. [`docs/architecture/stack-and-visual-direction.md`](docs/architecture/stack-and-visual-direction.md) — 기술 경계와 Assurance Ledger UI
3. [`contracts/README.md`](contracts/README.md) — 팀 간 payload 계약
4. [`docs/project/ownership.md`](docs/project/ownership.md) — 4인 소유권과 통합 규칙

모든 샘플은 합성 데이터이며 `is_synthetic=true`를 유지한다. 실제 금융정보·개인정보·실제 투자자 자금은 사용하지 않는다.
