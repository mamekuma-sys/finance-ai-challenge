# RWA Guard 기술 스택 및 시각 방향

| 항목 | 결정 |
|---|---|
| 제품 인상 | AI 챗봇이 아닌 금융 증거 관제 콘솔 |
| 기술 선택 기준 | 4인 병렬 구현성, 9월 7일 제출 안정성, 온체인 증거, 감사 가능성, 독자적 시각 언어 |
| 대표 화면 | 관제 홈, 컨트랙트 검증, 자산 상세, 경보 리포트, 시뮬레이터 |
| 대표 시각 장치 | Evidence Spine: 문서 조항→코드 라인→온체인 이벤트 연결 |
| 개발 전제 | 총 59~86인일 규모. P0 제출 계약과 P1 라이브 기능을 분리하고 9월 3일 승격 게이트를 적용 |

---

## 1. 최종 권장 스택

```text
Web
└─ Next.js App Router + TypeScript
   ├─ React Aria Components
   ├─ Tailwind CSS + CSS custom properties
   ├─ Apache ECharts
   ├─ TanStack Query
   └─ Shiki

API / Analysis
└─ FastAPI + Pydantic + SQLAlchemy
   ├─ Anthropic SDK / Claude Structured Outputs
   ├─ Slither + custom detectors
   ├─ Foundry unit tests / invariant tests(P1)
   ├─ scikit-learn quantile models(P1)
   └─ PyMuPDF document extraction

Worker / Chain(P1 live, P0 replay fixture)
└─ Python worker
   ├─ PostgreSQL job queue
   ├─ web3.py event polling
   └─ Kaia Kairos RPC

Data / Runtime
├─ Supabase PostgreSQL + Storage + limited Realtime(P1)
├─ Vercel: Next.js
├─ Always-on Docker runtime: API + worker
└─ Sentry + uptime monitor
```

### 핵심 결정

- **Next.js는 화면과 BFF 역할만 담당한다.** Slither, solc, PDF 처리, AI 분석은 Python 컨테이너에서 실행한다.
- **AI 분석을 Serverless Function 안에서 돌리지 않는다.** 30~60초 작업과 Solidity 컴파일은 항상 켜진 worker가 처리한다.
- **대형 에이전트 프레임워크를 쓰지 않는다.** 명시적인 4단계 파이프라인과 Pydantic 스키마로 구현한다.
- **라이브 화면은 DB 변경을 구독한다.** 브라우저가 블록체인과 AI 작업을 직접 조율하지 않는다.
- **시뮬레이터 서명키는 백엔드에만 둔다.** 프론트엔드에는 트랜잭션 요청과 결과만 노출한다.

### 1.1 제출 우선순위별 기술 경계

| 계층 | P0 제출 계약 | P1 라이브 경쟁력 | P2 발표심사·PoC |
|---|---|---|---|
| Web | 문서 검토, 3종 검사, Evidence Spine, 재검사 diff, HTML/JSON 리포트, 명시적 Replay | 가격 밴드 차트, 실시간 경보 갱신, 시뮬레이터 제어 | 다중 자산·기관 권한 UI |
| Analysis | PyMuPDF, Claude 구조화 추출, Slither/AST/커스텀 룰, 결정적 병합 | 기준가 quantile 모델, Foundry invariant 보강 | 추가 취약점 룰팩·범용 프록시 분석 |
| Chain | 검증된 Replay fixture와 체인 증거 스키마 | Kairos polling, receipt, allowlist 시뮬레이터 | 복수 네트워크·상용 오라클 |
| Runtime | Next.js, FastAPI, PostgreSQL job table, Storage | Realtime, chain worker, 대체 RPC | 엔터프라이즈 workflow·외부 알림 |

P1 구성요소의 장애는 P0 분석 job과 리포트 생성을 중단시켜서는 안 된다. 프로덕션에서 RPC 또는 Realtime 연결이 끊기면 마지막 라이브 값을 정상으로 위장하지 않고 `연결 지연`을 표시하며, Replay 전환 시 `REPLAY` 라벨과 fixture 버전을 노출한다.

### 1.2 공통 계약과 모듈 경계

```text
Document pipeline ── ControlSpec ──┐
                                   ├─ MismatchFinding ── EvidenceReport
Contract pipeline ─ CodeFinding ───┤                         ▲
                                   │                         │
Chain pipeline ─ OnchainEvidence ──┴─ Alert / RiskSnapshot ─┘
                         ▲
                      ScanRun
```

- `ControlSpec`: `constraint_id`, 정규화 값, 단위, 문서 page/span, 사용자 확정 상태
- `CodeFinding`: `rule_id`, 심각도, source hash, 파일·라인, 결정적 증거, AI 후보 상태
- `OnchainEvidence`: chain/tx/log/block 식별자, 이전값·변경값, `LIVE | REPLAY`
- `MismatchFinding`: constraint와 finding의 연결, 구현/부분/미구현/확인불가 상태
- `ScanRun`: 입력 hash, 도구·룰 버전, job 상태, 시작·완료 시각
- `EvidenceReport`: 위 계약의 immutable snapshot과 전체 lineage

Pydantic 모델을 원본 계약으로 두고 OpenAPI에서 TypeScript 타입을 생성한다. 프론트엔드가 임의의 별도 타입을 만들거나 AI 원문 JSON을 직접 해석하지 않는다.

---

## 2. 프론트엔드

### 2.1 Next.js App Router + TypeScript

**사용 이유**

- 관제 홈과 리포트의 초기 데이터를 서버에서 렌더링해 첫 화면을 안정적으로 제공한다.
- 차트, 코드 하이라이트, 시뮬레이터만 Client Component로 격리할 수 있다.
- Vercel 배포와 오류 페이지, 로딩 경계를 빠르게 구성할 수 있다.

**구현 원칙**

- `page.tsx`와 데이터 요약은 Server Component를 기본으로 한다.
- `RiskChart`, `EvidenceSpine`, `SimulationControls`만 `'use client'`로 둔다.
- API 비밀키와 관리자 로직은 `server-only` 모듈로 격리한다.
- URL에 `asset`, `alert`, `scan` 선택 상태를 유지해 심사자가 화면을 직접 공유할 수 있게 한다.

### 2.2 React Aria Components

`shadcn/ui`의 기본 카드·다이얼로그 외형을 가져오지 않는다. React Aria의 동작과 접근성만 사용하고 모든 외형은 직접 설계한다.

**사용 대상**

- Button, Dialog, Tabs, Tooltip, Select, Table, FileTrigger
- 키보드 포커스, aria 속성, 열기/닫기 동작

**직접 구현할 것**

- Risk Ruler
- Evidence Spine
- Ledger Row
- Alert Notch
- Contract Diff
- Block Receipt

### 2.3 스타일링: Tailwind CSS + 자체 토큰

Tailwind는 레이아웃과 반복 속도를 위해 사용하지만, 외부 테마와 복사한 컴포넌트는 사용하지 않는다.

```css
:root {
  --paper: #e8ece9;
  --surface: #f7f8f6;
  --ink: #172126;
  --muted: #66716f;
  --rule: #b8c2bd;
  --verify: #2d5bff;
  --safe: #27725b;
  --warning: #aa6817;
  --breach: #c43d32;
}
```

**금지**

- 보라색·파란색 그라디언트 배경
- 광택이 도는 glassmorphism
- 모든 정보를 둥근 카드로 분할
- 과도한 pill badge
- 의미 없는 glow와 입자 애니메이션
- AI 별 모양 아이콘

### 2.4 Apache ECharts(P1)

Recharts 대신 ECharts를 사용한다.

**필요한 표현**

- 기준가 하단·상단 밴드를 하나의 구간으로 표시
- 온체인 가격과 괴리율을 연결된 축에서 표시
- 경보 발생 지점에 세로 notch와 트랜잭션 마커 표시
- 범위 확대, 시점 선택, 툴팁 동기화
- 위험도에 따른 구간별 색상 매핑

ECharts 인스턴스는 Client Component 하나에만 두고, 서버에서 정규화한 시계열을 `dataset` 형태로 전달한다.

### 2.5 코드 뷰어: Shiki

Monaco Editor는 MVP의 읽기 전용 리포트에 비해 무겁다. Shiki로 서버에서 Solidity를 하이라이트하고 줄 단위 DOM을 생성한다.

**지원 동작**

- 발견사항 선택 시 해당 코드 라인으로 이동
- 취약 라인과 수정 라인 비교
- 코드 라인 permalink
- 원문 복사

### 2.6 서버 상태

- TanStack Query: scan 진행상태, 시뮬레이션 mutation, 재시도
- Supabase Realtime(P1): `alerts`, `risk_snapshots` INSERT만 구독
- 일반 목록과 리포트: 서버 렌더링 또는 API 조회

전체 테이블을 실시간 구독하지 않는다. 라이브 느낌은 경보와 위험점수 변화에만 사용한다.

---

## 3. 백엔드와 분석

### 3.1 FastAPI + Pydantic

Python 생태계의 Solidity 분석, 문서 처리, 통계 모델을 한 서비스에서 사용하기 위해 FastAPI를 선택한다.

**역할**

- 파일 업로드와 자산 API
- scan job 생성
- 분석 결과 조회
- 시뮬레이터 트랜잭션 요청
- 리포트 데이터 조립
- health/readiness endpoint

Pydantic 모델을 API 응답과 Claude Structured Output 스키마의 단일 기준으로 사용한다.

### 3.2 별도 worker 프로세스

Slither, solc, LLM 호출을 FastAPI 요청 프로세스의 단순 BackgroundTask로 실행하지 않는다.

**권장 구조**

```text
POST /scans
  └─ jobs 테이블에 queued 레코드 생성
      └─ worker가 SELECT ... FOR UPDATE SKIP LOCKED
          ├─ compile
          ├─ slither
          ├─ policy comparison
          ├─ Claude analysis
          └─ result commit
```

API와 worker는 같은 Docker image를 사용하고 실행 명령만 분리한다.

- API command: `fastapi run app/main.py`
- Worker command: `python -m app.worker`

MVP에서는 Celery와 Redis를 추가하지 않는다. PostgreSQL job table이면 작업 수가 적은 심사 환경에서 충분하며 운영 부품도 줄어든다.

### 3.3 컨트랙트 분석

**결정론적 계층**

- Slither JSON output
- Solidity AST
- 커스텀 Python detectors
- Foundry unit/invariant test 결과

**AI 계층**

- 발행조건과 코드 실행경로 비교
- 비즈니스 로직 결함 후보 설명
- 근거가 확인된 결과의 수정 가이드 작성

**증거 병합 규칙**

- 룰 또는 테스트 증거 있음: Confirmed
- 정적분석과 AI가 동의하나 테스트 미확인: Probable
- AI만 주장: Needs review
- 분석 불가: Unknown

### 3.4 Claude 연동

LangChain, CrewAI, AutoGen을 사용하지 않는다. 아래의 고정 파이프라인이면 충분하다.

```text
01 Parse document
02 Extract policy constraints
03 Compare policy with AST/static findings
04 Generate evidence-bound report
```

각 단계는 Claude Structured Outputs와 작은 JSON Schema를 사용한다.

**모델 사용 권장**

- 문서 추출·분류: 비용과 속도가 낮은 모델
- 코드 의미 분석: 중급 추론 모델
- 리포트: 동일 근거를 재서술하는 빠른 모델

모델 이름을 UI 브랜드로 노출하지 않는다. 화면에는 `AI 판정` 대신 `의미 분석`, `근거 결합`, `확인 필요`를 사용한다.

### 3.5 기준가 모델(P1)

LLM이 가격을 생성하지 않는다.

**MVP 권장**

- pandas: 비교거래 전처리
- scikit-learn `GradientBoostingRegressor(loss="quantile")`
- 하단 10%, 중앙 50%, 상단 90% 모델을 각각 학습
- 학습 데이터 시점과 모델 버전을 결과에 저장

데이터가 작고 설명력이 더 중요하면 statsmodels 기반 헤도닉 회귀로 단순화한다. 복잡한 딥러닝 가격모형은 MVP 범위에서 제외한다.

### 3.6 문서 처리

- PDF 텍스트 추출: PyMuPDF
- 표·문단을 페이지 번호와 함께 chunking
- 이미지형 스캔 PDF OCR은 P1
- 원문 전체가 아니라 관련 chunk만 Claude에 전달
- 추출 근거는 `document_id + page + span`으로 저장

---

## 4. 블록체인

### 4.1 Foundry

- 목업 RWA ERC-20
- 취약/수정 컨트랙트 fixture
- 목업 오라클
- 배포 script
- 핵심 3종 unit test(P0)
- 불변조건·퍼징 보강(P1)

Hardhat와 Foundry를 함께 사용하지 않는다. 분석 fixture와 배포를 Foundry로 통일한다.

### 4.2 이벤트 수집: web3.py polling(P1)

테스트넷 WebSocket 연결 하나에 데모 성공을 의존하지 않는다.

**방식**

1. worker가 `chain_cursors`의 마지막 처리 블록을 읽는다.
2. 2~3초마다 새 블록 범위를 조회한다.
3. `PriceUpdated`, `Minted`, `Paused` 로그를 저장한다.
4. `(chain_id, tx_hash, log_index)` unique key로 중복 제거한다.
5. 동일 transaction 안에서 risk snapshot과 alert를 생성한다.

### 4.3 시뮬레이터(P1)

- 서버측 테스트넷 전용 signer
- 대상 contract allowlist
- 조작 강도 제한
- 사용자별 rate limit
- 성공 receipt 확인 후에만 UI 갱신
- tx hash와 Kaiascan 링크 반환

---

## 5. 데이터와 실시간 화면

### 5.1 Supabase PostgreSQL

**사용 기능**

- PostgreSQL: 업무 데이터, JSONB 증거, job queue
- Storage: 발행 문서와 JSON 리포트
- Realtime(P1): 새 경보와 risk snapshot
- RLS: 공개 샘플은 read-only, 관리자 mutation은 서버만 가능

`pgvector`는 P0에 사용하지 않는다. 샘플 문서가 작으므로 페이지·문단 검색과 명시적 chunk 선택으로 충분하다.

### 5.2 실시간 데이터 흐름(P1)

```text
Kaia block
  → Python event worker
  → onchain_events insert
  → risk_snapshots / alerts insert
  → Supabase Realtime
  → Evidence Spine pulse + chart marker
```

---

## 6. 배포

### 6.1 권장 배치

| 구성 | 배포 위치 | 주의사항 |
|---|---|---|
| Next.js | Vercel | 공개 심사 URL, 에러 경계, read-only demo |
| FastAPI | always-on Docker service | 무료 sleep 인스턴스 사용 금지 |
| Worker | always-on Docker service | API와 동일 image, 별도 command |
| PostgreSQL/Storage | Supabase | RLS, migration, seed script |
| Contracts | Kaia Kairos | 주소와 배포 tx를 환경설정에 고정 |

always-on Docker 런타임은 팀이 익숙한 Railway, Fly.io 또는 동급 서비스를 사용한다. 공모전 기간에는 소액 유료 플랜을 써서 cold start와 sleep을 제거한다.

### 6.2 배포 안전장치

- `/health/live`: 프로세스 생존
- `/health/ready`: DB, RPC 연결 확인
- 외부 uptime monitor: 1분 간격
- Sentry: 프론트·백엔드 예외
- 대체 Kaia RPC 1개
- 데모 seed reset endpoint는 비공개 관리자 키로만 실행
- Replay 모드는 `실시간`으로 위장하지 않고 화면에 명시

---

## 7. 시각 방향: Assurance Ledger

### 7.1 디자인 명제

**AI가 말하는 화면이 아니라, 증거가 서로 맞물리는 화면이다.**

은행 앱, 코인 거래소, SaaS AI 랜딩페이지를 닮지 않는다. 감사인이 원장과 코드와 블록 기록을 동시에 대조하는 작업대를 제품의 시각 언어로 삼는다.

### 7.2 첫 화면의 단일 목적

증권사 보안·준법 담당자가 10초 안에 다음을 확인한다.

1. 지금 가장 위험한 자산은 무엇인가?
2. 문제는 계약 코드인가, 가격인가, 데이터인가?
3. 그 판정의 근거는 어디에 있는가?

### 7.3 레이아웃

```text
┌──────────────────────────────────────────────────────────────┐
│ RWA GUARD  BLOCK 18,402,119  RPC LIVE       2026-08-23 14:32 │
├──────────────┬─────────────────────────────┬─────────────────┤
│ ASSET LEDGER │ RISK FIELD / PRICE BAND     │ EVIDENCE SPINE  │
│              │                             │                 │
│ ● Han River  │  reference band             │ SPEC  §4.2      │
│ ▲ Urban-01   │  ────────────────            │   │             │
│ ○ Solar-02   │       ╲ oracle price        │ CODE  L.84      │
│              │        ╲  ! alert           │   │             │
│              │                             │ CHAIN  #18402119│
├──────────────┴─────────────────────────────┴─────────────────┤
│ EVENT LEDGER  14:32 PriceUpdated  +22.4%  tx 0x91a…c32      │
└──────────────────────────────────────────────────────────────┘
```

- 왼쪽 220px: 자산 원장
- 중앙 유동폭: 차트, Risk Ruler, 코드 diff
- 오른쪽 320px: Evidence Spine
- 하단 또는 중앙 하단: 이벤트 원장

모바일은 데모 핵심 대상이 아니지만, 1024px 이하에서 오른쪽 Evidence Spine을 drawer로 전환한다.

### 7.4 Evidence Spine

제품을 기억하게 만드는 유일한 시각 장치다.

```text
SPEC    최대 발행량 100,000       §4.2
  │
CODE    cap validation 없음       Token.sol:84
  │
CHAIN   supply 120,000             block #18,402,119
  │
ALERT   Issuance limit exceeded    CRITICAL
```

**상호작용**

- 각 노드를 누르면 해당 문서, 코드, 트랜잭션으로 이동한다.
- 하나의 경보가 어떤 증거 체인을 거쳤는지 위에서 아래로 읽힌다.
- 새 블록 수신 시 Spine에 한 번만 짧은 pulse가 이동한다.
- Critical 발생 시 빨간색이 화면 전체를 덮지 않고 해당 연결선과 notch만 바뀐다.

### 7.5 타이포그래피

| 역할 | 서체 | 사용 |
|---|---|---|
| 제목·섹션 | IBM Plex Sans KR | 기관적이고 기술적인 표제 |
| 본문·컨트롤 | Wanted Sans Variable | 작은 크기에서도 읽기 쉬운 한국어 UI |
| 수치·해시·코드 | IBM Plex Mono | 점수, 블록, 주소, 코드 라인 |

- 대형 64px 마케팅 헤드라인을 사용하지 않는다.
- 화면 제목 24~28px, 섹션 제목 13~15px, 본문 14px를 기본으로 한다.
- 숫자는 `tabular-nums`를 적용해 갱신 시 흔들리지 않게 한다.

### 7.6 색상

| 이름 | 값 | 용도 |
|---|---|---|
| Ledger paper | `#E8ECE9` | 전체 배경 |
| Report surface | `#F7F8F6` | 읽기 영역 |
| Carbon ink | `#172126` | 본문·구조선 |
| Verification blue | `#2D5BFF` | 선택·검증 근거 |
| Safe green | `#27725B` | 정상·확인 완료 |
| Warning ochre | `#AA6817` | 경고·데이터 노후 |
| Breach red | `#C43D32` | Critical·이탈 지점 |

그라디언트 대신 선의 굵기, 패턴, notch, 텍스트 라벨로 상태를 구분한다. 색각 이상을 고려해 색만으로 의미를 전달하지 않는다.

### 7.7 Risk Score 표현

원형 게이지를 쓰지 않는다. 0~100 임계값이 보이는 **Risk Ruler**를 사용한다.

```text
EXPLOIT RISK  84
0────────20────────40────────60────────80────100
                                       ▲
                          MINT_COLLATERAL_CAP_MISSING
```

점수 아래에 상위 원인 2개와 점수 기여도를 표시한다. 숫자를 장식하지 않고 계산 가능한 판정으로 보이게 한다.

### 7.8 모션

- 새 블록: 헤더 block number가 한 번 교체되고 Evidence Spine pulse 400ms
- 새 경보: event ledger에 위에서 삽입, 해당 notch만 2회 점멸
- 화면 전환: 120~180ms opacity/translate, 대규모 spring 금지
- `prefers-reduced-motion`에서 모든 pulse 제거

---

## 8. 흔한 AI 사이트가 되지 않기 위한 제품 카피

### 사용하지 않을 표현

- AI가 모든 위험을 완벽하게 찾아드립니다
- 차세대 지능형 금융 혁신
- 멀티에이전트가 실시간으로 생각 중입니다
- AI-powered insights
- Ask anything

### 사용할 표현

- 발행조건 6개 중 2개가 코드에서 확인되지 않았습니다.
- 가격이 기준가 상단을 18.4% 벗어난 상태가 2회 지속됐습니다.
- 이 판정은 문서 §4.2, Token.sol:84, block #18,402,119에 근거합니다.
- 자동검사가 완료됐습니다. 담당자 검토가 필요합니다.
- 오라클 데이터가 73분 동안 갱신되지 않았습니다.

AI는 브랜드가 아니라 처리 방식이다. 사용자는 모델이 아니라 판정 근거와 다음 행동을 본다.

---

## 9. 사용하지 않을 기술과 이유

| 제외 | 이유 | 대안 |
|---|---|---|
| shadcn 기본 테마 복사 | AI SaaS와 동일한 카드·배지 인상 | React Aria + 자체 컴포넌트 |
| Recharts | 빠르지만 복합 금융 시계열 상호작용 한계 | Apache ECharts |
| Monaco Editor | 읽기 전용 코드 증거에 과도한 번들 | Shiki |
| LangChain/CrewAI/AutoGen | 흐름과 비용·증거 추적이 불투명해짐 | 명시적 4단계 함수 파이프라인 |
| Celery/Redis | MVP 트래픽에 비해 운영 부품 과다 | PostgreSQL job table |
| 프론트→체인 직접 이벤트 구독 | RPC 단절과 복구 로직이 브라우저에 분산 | Python block cursor worker |
| 서버리스 Slither 실행 | 실행시간·바이너리·컴파일러 제약 | always-on Docker worker |
| 실시간 뉴스 기반 적정가 | 데모 재현성과 수치 책임이 약함 | 검증된 데이터 snapshot + 통계 모델 |
| 원형 Risk gauge | 흔하고 임계값·원인 표현이 약함 | Risk Ruler |
| 챗봇 메인 화면 | 관제 업무의 핵심 행동과 맞지 않음 | Evidence-led console |

---

## 10. 구현 순서

구현은 순차 개발이 아니라 네 트랙을 병렬로 진행한다. 각 트랙의 주책임자는 모듈을 완성하는 것뿐 아니라 공통 fixture가 다음 트랙에서 소비되는 것까지 책임진다.

### 트랙 A — 제품·프론트엔드

1. 공통 OpenAPI 타입과 합성 fixture로 화면 골격 구현
2. 문서 근거, 코드 라인, finding을 연결한 Evidence Spine
3. 취약본→수정본 diff와 HTML/JSON 리포트
4. 로딩·부분실패·`LIVE/REPLAY/검증 제한` 상태
5. P1 데이터가 들어오면 차트·경보·시뮬레이터 제어 연결

### 트랙 B — 문서 AI·백엔드

1. Pydantic 공통 계약, migration, seed, OpenAPI 고정
2. PyMuPDF page/span 추출과 prompt injection 방어
3. Claude 구조화 추출과 사용자 확정 API
4. PostgreSQL job table, 재시도, 부분실패 상태
5. EvidenceReport 조립과 immutable snapshot

### 트랙 C — 스마트컨트랙트 보안

1. 핵심 결함 3종별 취약 2·안전 2 fixture와 기대 결과 고정
2. solc/Slither JSON/AST 정규화
3. 접근권한, 담보·발행한도, 오라클 검증 커스텀 룰
4. 문서 조건과 코드 증거의 결정적 매핑 및 AI 후보 분리
5. 재검사 diff와 Precision·Recall 평가

### 트랙 D — 온체인·가격·운영

1. Kairos 목업 토큰·오라클 배포와 주소 고정
2. `LIVE | REPLAY`가 동일 스키마를 사용하는 이벤트 fixture
3. block cursor polling, 중복 제거, receipt 검증
4. 기준가 snapshot·모델 버전·가격 무결성 경보
5. allowlist 시뮬레이터, 배포 health, 대체 RPC, uptime monitor

### 공통 통합 게이트

| 시점 | 게이트 | 실패 시 처리 |
|---|---|---|
| 매일 | 공통 fixture 계약 테스트 | 생산자와 소비자가 같은 날 스키마를 복구한다. |
| 8/30 | `ControlSpec → CodeFinding → MismatchFinding → EvidenceReport` 첫 E2E | UI mock을 늘리지 않고 끊어진 계약을 우선 수정한다. |
| 9/3 | P1 라이브 승격 | receipt·중복제거·장애격리가 미달이면 `REPLAY`로 명시하거나 비노출한다. |
| 9/4 | P0 수용 기준 | 신규 기능 개발을 중단하고 실패 케이스만 수정한다. |
| 9/5 | 기능 동결 | 배포·보안·복구·문서 동기화만 허용한다. |
| 9/6 | 10회 리허설 | 9회 미만 성공 시 라이브 의존 구간을 Replay 경로로 고정한다. |

기술적 깊이는 기능 수가 아니라 **문서 원문 span, 결정적 코드 근거, 체인 receipt, 재검사 diff가 하나의 Evidence Spine에서 끊김 없이 연결되는가**로 판단한다.
