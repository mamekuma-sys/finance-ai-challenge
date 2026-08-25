# RWA Guard 역할별 기술 스택 및 개발 환경

| 항목 | 내용 |
|---|---|
| 문서 상태 | 개발 착수 전 기술 기준 |
| 기준일 | 2026-08-25 |
| 대상 | 4인 개발팀 A·B·C·D |
| 제품 계약 | `docs/product/prd.md` |
| 팀 운영 계약 | `docs/project/team-development-operating-plan.md` |
| 기술·시각 상세 | `docs/architecture/stack-and-visual-direction.md` |

이 문서는 각 담당자가 사용할 기술, 소유할 실행 환경, 트랙 사이의 연결 방식과 아직 확정하지 않은 선택을 구분한다. 패키지의 정확한 설치 버전은 lock file을 우선하며, 문서와 실제 의존성이 다르면 구현 전에 둘을 함께 갱신한다.

---

## 1. 상태 표기

| 상태 | 의미 |
|---|---|
| 현재 | 저장소 의존성·설정·코드에 이미 존재한다. |
| P0 예정 | 제출 핵심 경로를 위해 개발 착수 시 추가하거나 구현한다. |
| P1 조건부 | 9월 3일 승격 게이트를 통과한 경우에만 제출판에 노출한다. |
| 미확정 | 팀 선택이 필요한 공급업체 또는 구현 세부사항이다. 확정 전 임의 도입하지 않는다. |

---

## 2. 전체 아키텍처

```text
Browser
  └─ Next.js 16 + React 19 + TypeScript
       └─ generated OpenAPI client
            └─ FastAPI + Pydantic + PostgreSQL
                 ├─ document AI pipeline
                 ├─ Solidity assurance pipeline
                 ├─ report assembler
                 └─ PostgreSQL job worker
                      ├─ Slither / solc / Foundry
                      ├─ Claude structured extraction
                      └─ web3.py / Kaia Kairos(P1)

Runtime
  ├─ Vercel: Web
  ├─ always-on Docker: API + worker
  ├─ Supabase PostgreSQL: data + job queue
  └─ Kaia Kairos: synthetic contracts and events(P1)
```

### 아키텍처 불변식

- Next.js는 UI와 Web용 data fetching만 담당한다.
- PDF 처리, AI 호출, Solidity compile·분석은 Python API·worker에서 수행한다.
- 브라우저가 블록체인 RPC를 직접 구독하거나 signer key를 보유하지 않는다.
- Pydantic이 runtime 계약의 원본이며 OpenAPI와 TypeScript가 이를 따라간다.
- PostgreSQL job table을 사용하고 P0에 Redis·Celery를 추가하지 않는다.
- P1 chain worker 장애는 P0 scan과 report를 중단시키지 않는다.

---

## 3. A — 제품·프론트엔드 기술 스택

### 런타임과 프레임워크

| 기술 | 상태 | 저장소 기준 | 용도 |
|---|---|---|---|
| Node.js | 현재 | CI 22 | Web build와 test runtime |
| Next.js App Router | 현재 | 16.3.2 | routing, server rendering, loading·error boundary |
| React | 현재 | 19.2.8 | 화면과 상호작용 |
| TypeScript | 현재 | 5.x | strict frontend type contract |
| Vercel | P0 예정 | 배포 설정 존재 | 공개 심사 URL |

`page.tsx`와 초기 데이터 요약은 Server Component를 기본으로 한다. `EvidenceSpine`, `RiskChart`, `SimulationControls`처럼 상호작용이 필요한 부분만 Client Component로 격리한다.

### UI와 시각화

| 기술 | 상태 | 저장소 기준 | 용도 |
|---|---|---|---|
| Tailwind CSS | 현재 | 4.x | layout과 design token 적용 |
| CSS custom properties | 현재 | `globals.css` | Assurance Ledger 색상·간격·상태 token |
| React Aria Components | 현재 | 1.13.x | 접근 가능한 dialog, tabs, tooltip, select, table |
| Pretendard | 현재 | 1.3.9 | 한국어 본문 UI |
| IBM Plex Mono fallback | 현재 | CSS font stack | hash, block, code, 수치 |
| Shiki | 현재 | 3.12.x | Solidity read-only highlighting과 line anchor |
| Apache ECharts | P1 조건부 | 6.x 설치됨 | 기준가 band, oracle price, alert marker |

외형은 React Aria의 기본 theme나 shadcn 복사본을 사용하지 않고 자체 token으로 구현한다. `Risk Ruler`, `Evidence Spine`, `Ledger Row`, `Alert Notch`, `Contract Diff`, `Block Receipt`는 프로젝트 전용 component다.

### 서버 상태와 API 계약

| 기술 | 상태 | 용도 |
|---|---|---|
| TanStack Query 5 | 현재 | scan polling, retry, simulation mutation, cache |
| `openapi-typescript` | P0 예정 | FastAPI OpenAPI에서 TypeScript type 생성 |
| `openapi-fetch` | P0 예정 | 생성 type을 사용하는 경량 API client |
| Supabase Realtime | P1 조건부 | 새 alert와 risk snapshot만 구독 |

P0 scan 상태는 TanStack Query polling으로 동작한다. Realtime이나 SSE가 없어도 핵심 경로가 완주돼야 한다. OpenAPI client package는 아직 `package.json`에 없으므로 개발 착수 전 계약 생성 script와 함께 추가한다.

### 품질 도구

| 기술 | 현재 버전 범위 | 책임 |
|---|---|---|
| Vitest | 4.1.x | component·contract test |
| Testing Library | 16.3.x | 사용자 행동 기반 UI test |
| user-event | 14.6.x | keyboard·pointer interaction |
| jest-dom | 6.9.x | accessible DOM assertion |
| axe-core | 4.12.x | 핵심 화면 접근성 검사 |
| ESLint | 9.x | Next.js lint |
| TypeScript compiler | 5.x | `tsc --noEmit` |

### A 담당 실행 명령

```powershell
cd apps/web
npm ci
npm run dev
npm run verify
```

### A가 사용하지 않을 기술

- 브라우저에서 Anthropic API 직접 호출
- 브라우저에서 Kaia signer 또는 private key 보관
- Monaco Editor
- Recharts
- 대형 전역 상태 library
- 프론트에서 수기로 복제한 backend DTO

---

## 4. B — 문서 AI·백엔드 기술 스택

### 런타임과 API

| 기술 | 상태 | 저장소 기준 | 용도 |
|---|---|---|---|
| Python | 현재 | 3.12 이상, CI·Docker 3.12 | API, pipeline, worker 공통 runtime |
| FastAPI | 현재 | 0.116 이상 1 미만 | REST API와 OpenAPI |
| Uvicorn | 현재 | 0.35 이상 1 미만 | ASGI runtime |
| Pydantic | 현재 | 2.11 이상 3 미만 | API·domain·AI output 원본 schema |
| pydantic-settings | 현재 | 2.10 이상 3 미만 | 환경설정과 secret 경계 |
| SQLAlchemy | 현재 | 2.x | DB model과 transaction |
| psycopg | 현재 | 3.2 이상 4 미만 | PostgreSQL driver |

### 문서 AI pipeline

| 기술 | 상태 | 저장소 기준 | 용도 |
|---|---|---|---|
| PyMuPDF | 현재 | 1.26 이상 2 미만 | PDF page·text·span 추출 |
| Anthropic Python SDK | 현재 | 0.66 이상 1 미만 | Claude structured extraction과 설명 |
| Pydantic schema validation | 현재 | domain model 존재 | model output 검증과 실패 격리 |
| Supabase Storage adapter | P0 예정 | 구현·package 미확정 | 업로드 원문 또는 report artifact 저장 |

AI pipeline은 `parse → extract controls → map candidates → evidence-bound explanation`의 명시적 함수 흐름으로 만든다. LangChain, CrewAI, AutoGen 같은 agent framework는 사용하지 않는다.

### 작업 실행과 데이터

| 기술 | 상태 | 용도 |
|---|---|---|
| PostgreSQL job table | P0 예정 | queued job과 retry 관리 |
| `FOR UPDATE SKIP LOCKED` worker | P0 예정 | API와 분리된 안전한 job claim |
| SQL migration | 현재 | `infra/supabase/migrations/`에서 schema 재현 |
| Supabase PostgreSQL | P0 예정 | 운영 DB와 합성 seed |
| JSONB evidence snapshot | P0 예정 | Evidence Report lineage 보관 |

P0에서는 Alembic, Redis, Celery를 추가하지 않는다. migration은 검토 가능한 SQL file로 관리하고 API와 worker는 동일 Docker image에서 실행 command만 분리한다.

### 품질 도구

| 기술 | 저장소 기준 | 책임 |
|---|---|---|
| pytest | 8.4 이상 9 미만 | API·pipeline·contract test |
| HTTPX | 0.28 이상 1 미만 | FastAPI integration test |
| Ruff | 0.12 이상 1 미만 | format/lint 기준 |
| Mypy | 1.17 이상 2 미만 | strict Python type checking |
| pytest-cov | 6.2 이상 7 미만 | 핵심 pipeline coverage |

### B 담당 실행 명령

```powershell
cd services/backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python -m ruff check .
.\.venv\Scripts\python -m mypy
```

### B가 사용하지 않을 기술

- FastAPI `BackgroundTasks`에서 장시간 Slither·AI job 실행
- AI 원문 JSON을 검증 없이 DB에 확정 결과로 저장
- LLM이 생성한 가격·위험 수치를 결정값으로 사용
- AI 단독 finding을 Critical/High로 승격
- 실제 금융정보나 개인정보를 sample로 저장

---

## 5. C — 스마트컨트랙트 보안 기술 스택

### Solidity와 분석 도구

| 기술 | 상태 | 저장소 기준 | 용도 |
|---|---|---|---|
| Solidity | 현재 | 0.8.24 | RWA token·oracle fixture |
| Foundry | 현재/로컬 설치 필요 | CI toolchain 존재 | build, unit test, deployment script |
| Forge optimizer | 현재 | 200 runs | fixture compile 기준 |
| Slither | P0 예정 | 0.11 이상 1 미만 optional dependency | JSON static analysis |
| solc AST | P0 예정 | Solidity 0.8.24와 일치 | custom semantic detector 입력 |
| Python custom detectors | P0 예정 | backend contract pipeline | 핵심 비즈니스 룰 3종 |
| JSON Schema·Pydantic | 현재 | `CodeFinding`, `MismatchFinding` | 분석 결과의 팀 간 계약 |

Foundry는 CI에 설정돼 있지만 현재 Windows 개발 환경에는 설치 여부를 각 담당자가 확인해야 한다. Hardhat와 Foundry를 함께 사용하지 않는다.

### 핵심 detector별 기술

| detector | 주 분석 방식 | 보강 방식 | 필수 증거 |
|---|---|---|---|
| 접근권한 | AST modifier·role check와 call path | Slither result, Foundry negative test | function, modifier/check, file/line |
| 담보·발행한도 | state read·require·mint path data flow | custom Python rule, Foundry boundary test | constraint ID, guard path, file/line |
| 오라클 검증 | value range·timestamp·freshness check | AST rule, stale/zero input test | oracle function, validation line, rule version |

문자열 substring 검색은 후보 생성에만 사용할 수 있다. `CONFIRMED`는 AST, Slither, custom rule 또는 Foundry test의 재현 가능한 근거를 가져야 한다.

### 평가와 회귀

- 핵심 결함별 취약 fixture 2개와 안전 fixture 2개
- 같은 source hash와 rule version에서 같은 결과
- `CONFIRMED | PROBABLE | NEEDS_REVIEW | UNKNOWN` 경계 test
- 취약본→수정본 `RESOLVED | REMAINS | NEW` diff test
- Precision·Recall 측정값과 evaluation fixture version 기록

### C 담당 실행 명령

```powershell
cd services/backend
.\.venv\Scripts\python -m pip install -e ".[analysis,dev]"

cd ..\..\chain
forge fmt --check
forge build
forge test
```

### C가 사용하지 않을 기술

- Hardhat와 Foundry 병행
- Slither 출력 원문을 사용자 화면에 그대로 노출
- substring만으로 확정 finding 생성
- 범용 proxy·임의 bytecode 복원 기능을 P0에 추가
- 외부 contract library를 license 기록 없이 추가

---

## 6. D — 온체인·가격·운영 기술 스택

### Chain과 event worker

| 기술 | 상태 | 저장소 기준 | 용도 |
|---|---|---|---|
| Kaia Kairos | P1 조건부 | chain ID 1001 | 합성 token·oracle live demo |
| web3.py | P1 조건부 | 7.13 이상 8 미만 | RPC, log polling, transaction receipt |
| Python worker | 현재/P0 예정 | worker entrypoint 존재 | cursor polling과 alert 생성 |
| PostgreSQL 17 | 현재 | local Docker image | cursor, event, alert, job 저장 |
| Kaiascan | P1 조건부 | Kairos explorer URL | tx 증거 link |
| Replay JSON fixture | 현재/P0 확장 | `data/synthetic/` | RPC 없는 제출 복구 경로 |

브라우저 WebSocket에 의존하지 않고 worker가 2~3초 polling으로 block range를 조회한다. event unique key는 `(chain_id, tx_hash, log_index)`다.

### 가격과 데이터 품질

| 기술 | 상태 | 저장소 기준 | 용도 |
|---|---|---|---|
| pandas | P1 조건부 | 2.3 이상 3 미만 | 합성 비교거래 snapshot 전처리 |
| scikit-learn | P1 조건부 | 1.7 이상 2 미만 | quantile regression band |
| deterministic risk logic | P0/P1 예정 | Python rule | 이탈 폭·지속 횟수·freshness 계산 |
| versioned CSV·JSON | 현재/P0 확장 | `data/synthetic/` | 재현 가능한 입력 snapshot |

LLM은 기준가나 가격 band를 생성하지 않는다. 모델 version, 입력 snapshot hash, 기준시각을 저장하고 데이터 상태를 `FRESH | AGING | STALE | INVALID`로 구분한다.

### Runtime과 운영

| 기술 | 상태 | 용도 |
|---|---|---|
| Docker | 현재 | API·worker 동일 image |
| Docker Compose | 현재 | PostgreSQL·API·worker local integration |
| Supabase PostgreSQL | P0 예정 | 운영 data와 job queue |
| Supabase Realtime | P1 조건부 | alert·risk snapshot insert만 Web에 전달 |
| Vercel | P0 예정 | Web 배포 |
| always-on Docker host | 미확정 | API·worker 운영, Railway/Fly.io 또는 동급 |
| Sentry SDK | P0 예정 | frontend·backend exception 관측, package 미설치 |
| uptime monitor | 미확정 | 1분 간격 공개 URL 감시 |
| fallback Kaia RPC | P1 조건부 | primary RPC 장애 대응 |

운영 공급업체와 요금제는 개발 착수 전에 확정한다. 무료 sleep instance는 제출 URL 운영에 사용하지 않는다.

### Signer와 simulator 경계

- signer private key는 backend worker 환경변수에만 둔다.
- 대상 contract allowlist를 적용한다.
- 조작 강도와 호출 횟수에 rate limit을 둔다.
- transaction receipt가 성공하기 전에 UI 상태를 바꾸지 않는다.
- 실제 자금과 mainnet을 사용하지 않는다.

### D 담당 실행 명령

```powershell
cd services/backend
.\.venv\Scripts\python -m pip install -e ".[chain,valuation,dev]"

cd ..\..\
docker compose -f infra/docker-compose.yml up --build
```

### D가 사용하지 않을 기술

- 브라우저 직접 RPC event orchestration
- receipt 없는 optimistic LIVE 표시
- mainnet contract와 실제 자금
- LLM 기반 가격 생성
- P1 장애를 숨기는 자동 정상 표시

---

## 7. 공통 계약과 도구

### 데이터 계약

| 원본·산출물 | 기술 | 관리자 | 소비자 |
|---|---|---|---|
| Runtime model | Pydantic 2 | B | B, C, D |
| REST contract | FastAPI OpenAPI | B | A |
| Bootstrap schema | JSON Schema | 전 팀 | 전 팀 |
| Frontend type | `openapi-typescript` 생성물 | B 생성, A 소비 | A |
| Example fixture | versioned JSON | 생산 트랙 | 전 팀 |

계약 변경 순서는 `Pydantic → OpenAPI/JSON Schema → example payload → TypeScript client → consumer test`다.

### 저장소와 CI

| 기술 | 상태 | 검사 |
|---|---|---|
| GitHub | 현재 | remote source repository |
| GitHub Actions | 현재 | pull request와 main push |
| npm lock file | 현재 | Web exact dependency resolution |
| Python version range | 현재 | `pyproject.toml`과 CI 3.12 |
| Foundry CI toolchain | 현재 | fmt, build, test |
| PowerShell verify script | 현재 | JSON, backend, Web, Foundry 통합 검사 |

### 전체 검증

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
```

CI 필수 gate:

- Web: typecheck, ESLint, Vitest, production build
- Backend: pytest, Ruff, Mypy
- Contract: Forge format, build, test
- Contract examples: JSON parse와 schema/contract test

---

## 8. 환경변수 소유권

| 변수 그룹 | 소유자 | 브라우저 노출 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL`, 기본 evidence mode | A | 공개 가능 값만 허용 |
| `DATABASE_URL`, `ANTHROPIC_API_KEY`, server origin | B | 금지 |
| Solidity compiler·rule version | C | version metadata만 공개 가능 |
| Kaia RPC, signer key, allowlist, explorer | D | RPC·explorer URL만 제한적으로 공개 |
| Supabase service role, Sentry server DSN | B, D | service role은 절대 금지 |

실제 값은 `.env`와 배포 secret store에만 둔다. `.env.example`에는 변수명과 합성 기본값만 유지한다.

---

## 9. 개발 전 남은 기술 결정

다음 항목은 아직 저장소 의존성 또는 공급업체가 확정되지 않았다. 네 트랙 개발 전 기획 브랜치에서 결정한다.

1. `openapi-typescript`와 `openapi-fetch`의 정확한 version 및 생성 script
2. Supabase Storage 접근 방식과 Python package 사용 여부
3. always-on Docker 운영 공급업체와 유료 plan
4. uptime monitor 공급업체와 장애 알림 수신자
5. Sentry SDK package와 frontend/backend release tagging
6. 최종 font asset의 self-host 여부와 license 기록
7. Kaia primary·fallback RPC endpoint 운영 정책

새 framework나 운영 부품을 추가할 때는 “어느 수용 기준을 해결하는가, P0 장애 면적을 늘리지 않는가, 네 명이 유지할 수 있는가”를 PR에 기록한다.

---

## 10. 역할별 기술 스택 한눈에 보기

| 역할 | 주언어 | 핵심 stack | 핵심 산출물 | 배포·실행 경계 |
|---|---|---|---|---|
| A 제품·프론트 | TypeScript | Next.js, React, React Aria, Tailwind, TanStack Query, Shiki, ECharts(P1) | 5개 화면, Evidence Spine, diff, report UI | Vercel·Browser |
| B 문서 AI·백엔드 | Python | FastAPI, Pydantic, PyMuPDF, Anthropic SDK, SQLAlchemy, PostgreSQL job | ControlSpec, OpenAPI, job, EvidenceReport | Docker API·worker |
| C 컨트랙트 보안 | Solidity·Python | Foundry, solc AST, Slither, custom detectors | fixture, CodeFinding, MismatchFinding, rescan diff | Docker analysis worker·CI |
| D 온체인·운영 | Python·Solidity | web3.py, Kaia Kairos, PostgreSQL, pandas, scikit-learn, Docker, Supabase | OnchainEvidence, band, alert, simulator, runtime | chain worker·infra |

기술 선택의 목적은 도구 수를 늘리는 것이 아니다. 네 트랙이 같은 계약과 합성 fixture를 사용해 하나의 재현 가능한 Evidence Report를 만드는 것이 최종 기준이다.
