# RWA Guard 4인 팀 개발 운영 계약

| 항목 | 내용 |
|---|---|
| 문서 상태 | 팀 공유·개발 착수 기준 |
| 기준일 | 2026-08-25 |
| 현재 단계 | 개발 전 계약 확정 |
| 현재 작업 브랜치 | `codex/planning-development-contract-v1` |
| 제품 단일 진실 | `docs/product/prd.md` |
| 기술·시각 단일 진실 | `docs/architecture/stack-and-visual-direction.md` |

이 문서는 RWA Guard의 화면, AI 역할, 4인 역할 분담, 브랜치 운영, 풀스택 계약을 한곳에서 확인하기 위한 팀 운영 기준이다. 기능 범위와 수용 기준이 충돌할 때는 PRD를 우선하고, 기술 경계는 아키텍처 문서를 우선한다.

역할별 package, 실행 명령, CI, 배포 경계와 미확정 기술은 [`team-technical-stack.md`](team-technical-stack.md)를 따른다.

---

## 1. 우리가 함께 완성할 한 개의 제품 흐름

네 명이 서로 다른 데모를 만드는 것이 아니라 다음 수직 경로 하나를 함께 완성한다.

```text
합성 자산 선택
  → 발행 문서 업로드
  → AI 통제조건 추출
  → 담당자 근거 확인·확정
  → 스마트컨트랙트 결정론적 검사
  → 문서–코드 불일치 확인
  → 취약본→수정본 재검사
  → LIVE 또는 REPLAY 온체인 증거 연결
  → Evidence Report 생성
```

제품의 기술적 깊이는 기능 수가 아니라 `문서 page/span → 코드 file/line → chain tx/log 또는 Replay → 경보`가 하나의 Evidence Spine에서 끊김 없이 연결되는가로 판단한다.

---

## 2. 현재 단계와 개발 착수 게이트

지금은 네 개의 기능 브랜치를 동시에 여는 단계가 아니다. 현재 기획 브랜치 하나에서 아래 계약을 먼저 동결한다.

- 핵심 화면과 사용자 흐름
- 화면별 로딩·빈 상태·실패·부분 실패·제한 상태
- 전체 API 목록과 요청·응답 예시
- Pydantic·OpenAPI·TypeScript 타입 생성 흐름
- AI 입력·출력·근거·실패 처리·평가셋
- 핵심 결함 3종의 결정론적 검사 규칙
- DB 엔터티와 job 상태 전이
- 공통 오류 envelope와 재시도 규칙
- fixture 기반 계약 테스트와 수직 E2E 시나리오
- 역할별 소유 경로와 PR 리뷰 규칙

다음 조건을 모두 충족해야 네 개 개발 트랙을 시작한다.

1. 모든 P0 기능에 사용자 행동, API, 저장 데이터, 화면 상태, 테스트가 연결돼 있다.
2. 공통 JSON example이 JSON Schema와 Pydantic 검증을 통과한다.
3. OpenAPI에서 프론트 TypeScript 클라이언트를 생성하는 명령이 정해져 있다.
4. AI 결과와 결정론적 확정 결과가 스키마와 UI에서 구분된다.
5. P1 장애가 P0 문서–코드 검사와 리포트를 중단시키지 않는다.
6. 네 명이 같은 합성 fixture로 첫 수직 통합을 수행할 수 있다.

---

## 3. 범위 잠금

### P0 — 제출 계약

- 합성 상업용 부동산 수익증권 1종
- 발행 문서에서 통제조건 6개 추출·확정
- Solidity 핵심 결함 3종 검사
- 문서–코드 불일치와 Evidence Spine
- 취약본→수정본 재검사 diff
- HTML 리포트와 JSON 증적
- 명시적인 REPLAY 온체인 사건
- 로그인 없는 공개 데모와 health check

### P1 — 9월 3일 승격 대상

- 기준가 밴드와 온체인 가격 차트
- Kaia Kairos 이벤트 polling
- 가격 무결성 경보
- allowlist 기반 테스트넷 조작 시뮬레이터

P1은 실제 receipt, 중복 제거, 장애 격리, 10회 중 9회 성공 조건을 모두 충족한 경우에만 `LIVE`로 노출한다. 조건을 충족하지 못하면 삭제가 아니라 명시적 `REPLAY` 경로로 축소한다.

### P2 — 제출 후 확장

- 추가 보안 룰팩
- 다중 자산·다중 네트워크
- 범용 프록시 분석
- PDF 리포트
- 외부 알림과 기관 승인 워크플로

---

## 4. AI 역할과 판정 경계

RWA Guard에는 AI가 명확히 존재한다. 다만 AI가 최종 보안 판정을 독점하지 않는다.

### AI가 담당하는 일

1. PDF·텍스트 발행 문서에서 6개 통제조건을 구조화한다.
2. 각 조건에 문서 페이지와 원문 span을 연결한다.
3. 문서 조건과 Solidity 변수·함수·실행경로의 의미적 매핑 후보를 만든다.
4. 확인된 증거를 바탕으로 발견사항과 수정 방향을 설명한다.
5. Evidence Report의 근거 기반 설명을 작성한다.

### 결정론적 엔진이 담당하는 일

1. 접근권한 누락을 AST·Slither·커스텀 룰·테스트로 확인한다.
2. 담보 및 발행한도 검증이 실행경로에 존재하는지 확인한다.
3. 오라클 입력값과 최신성 검증을 확인한다.
4. 가격 밴드, 지속 횟수, event dedupe를 재현 가능한 로직으로 계산한다.
5. 확정 Critical/High와 재검사 diff를 생성한다.

AI 단독 주장은 `NEEDS_REVIEW`이며 `CONFIRMED`로 승격할 수 없다. 모든 Critical/High는 결정론적 근거와 문서·코드 위치를 가져야 한다. 모델명은 제품 전면에 내세우지 않고 화면에는 `의미 분석`, `근거 결합`, `확인 필요`를 사용한다.

---

## 5. 프론트엔드 화면 계약

### 현재 화면의 상태

현재 `/` 화면은 Assurance Ledger의 구조와 Evidence Spine 개념을 확인하기 위한 정적 프로토타입이다. `apps/web/src/lib/demo-finding.ts`의 합성 데이터를 사용하며 실제 API, AI 분석, scan job과 아직 연결되지 않았다. 디자인 완성본이나 제출 가능한 전체 사용자 여정으로 간주하지 않는다.

### 최종 핵심 화면 5개

| 화면 | 경로 | 사용자의 핵심 질문 | 필수 상태 |
|---|---|---|---|
| 관제 홈 | `/` | 지금 가장 위험한 자산과 원인은 무엇인가? | 정상, 빈 상태, 데이터 지연, REPLAY |
| 문서 AI 검토 | `/assets/{id}/document` | AI가 어떤 조건을 어떤 원문에서 추출했는가? | 추출 중, 확인 필요, 사용자 수정, 확정, AI 실패 |
| 컨트랙트 검증 | `/assets/{id}/scan` | 문서의 약속이 코드에 구현되었는가? | queued, running, 부분 실패, 완료, 분석 불가, 재검사 diff |
| 자산 상세 | `/assets/{id}` | 가격·이벤트·경보가 현재 어떤 상태인가? | LIVE, 연결 지연, REPLAY, 경보 없음, 경보 발생 |
| 증거 리포트 | `/reports/{id}` | 판정의 전체 증거와 버전을 재검증할 수 있는가? | HTML 조회, JSON 다운로드, 제한·실패 고지 |

합성 자산 선택과 신규 검토 시작은 관제 홈의 dialog 또는 단계형 panel로 처리해 별도 화면 수를 늘리지 않는다.

### 시각 방향

- AI 챗봇이 아니라 금융 증거 관제 콘솔로 보이게 한다.
- Evidence Spine을 유일한 대표 시각 장치로 유지한다.
- 모든 정보를 둥근 카드로 분리하거나 보라색 gradient, glassmorphism, 의미 없는 glow를 사용하지 않는다.
- 위험은 색만이 아니라 텍스트, icon, 선, notch를 함께 사용해 표현한다.
- 현재 하드코딩 화면을 폐기하지 않고 컨트랙트 검증 결과 화면의 뼈대로 발전시킨다.

---

## 6. 4인 역할 분담

### A — 제품·프론트엔드

**대표 브랜치:** `feat/a-ai-evidence-console`
**기본 소유 경로:** `apps/web/`

**임무:** 분석 결과를 심사자가 빠르게 이해하고 신뢰할 수 있는 제품 경험으로 만든다.

**담당 작업**

- 자체 디자인 token과 Assurance Ledger layout
- 핵심 화면 5개와 URL 상태
- OpenAPI 생성 client와 TanStack Query 연결
- Evidence Spine, Risk Ruler, Contract Diff, Block Receipt
- 문서 근거와 코드 라인 탐색
- 취약본→수정본 재검사 비교
- HTML 리포트와 JSON 다운로드 UI
- P1 승격 시 가격 차트와 시뮬레이터 제어
- 로딩·빈 상태·오류·부분 실패·검증 제한 상태
- `LIVE | REPLAY`, `CONFIRMED | NEEDS_REVIEW | UNKNOWN`의 정직한 표시
- 접근성과 심사 노트북 기준 반응형

**완료 기준**

- 하드코딩 타입이 아니라 생성된 API client를 사용한다.
- 샘플 선택부터 Evidence Report까지 화면에서 완주한다.
- 심사자가 첫 화면에서 10초 안에 위험 자산과 원인을 찾을 수 있다.
- 모든 Critical/High에서 문서 조항과 코드 라인으로 이동할 수 있다.
- 정상·실패·부분 실패·Replay 상태 테스트가 있다.

**통합 책임:** 제품 용어, 메뉴명, 3분 발표 동선, 기능명세서와 화면의 일치.

### B — 문서 AI·백엔드

**대표 브랜치:** `feat/b-document-ai-extraction`
**기본 소유 경로:** `services/backend/` 중 API, domain, document, report, job 기반

**임무:** 발행 문서를 근거 있는 구조화 데이터로 만들고 전체 분석 흐름의 API·DB·job 기반을 제공한다.

**담당 작업**

- FastAPI와 공통 오류 envelope
- Pydantic 원본 계약과 OpenAPI export
- PyMuPDF 기반 page/span 보존 추출
- Claude Structured Output 기반 6개 통제조건 추출
- prompt injection 방어와 입력 검증
- 추출 결과 수정·확정 API
- PostgreSQL job table, worker 기반, 재시도, timeout, 부분 실패
- Asset, Document, Scan, Report 데이터 모델
- DB migration과 합성 seed
- Evidence Report 조립과 immutable snapshot
- 모델·prompt·입력 hash·실행시각 기록
- AI 장애 시 결정론적 분석과 저장된 report를 유지하는 fallback

**완료 기준**

- 추출 조건에 값·단위·page·span·확정 상태가 있다.
- 찾지 못한 값은 임의 생성하지 않고 확인 필요로 반환한다.
- 모든 AI 출력이 Pydantic 검증을 통과한다.
- API timeout이 전체 화면 실패로 전파되지 않는다.
- OpenAPI와 example payload가 실제 응답과 일치한다.
- 최소 문서 평가셋을 실행하고 측정값을 기록한다.

**통합 책임:** 공통 데이터 계약, OpenAPI, DB migration, Evidence Report 조립.

### C — 스마트컨트랙트 보안

**대표 브랜치:** `feat/c-contract-assurance-engine`
**기본 소유 경로:** `chain/`, `services/backend/src/rwa_guard/pipelines/contract.py`, 관련 테스트

**임무:** AI 후보를 결정론적으로 검증하고 문서의 약속이 코드에 구현되었는지 증명한다.

**담당 작업**

- 핵심 결함별 취약 2개·안전 2개 fixture와 예상 결과
- Foundry build와 unit test
- solc·Slither JSON·Solidity AST 정규화
- 접근권한 누락 detector
- 담보·발행한도 검증 누락 detector
- 오라클 값·최신성 검증 누락 detector
- source hash, file/line, rule/tool version을 가진 `CodeFinding`
- `ControlSpec`과 코드 증거의 결정론적 연결
- `IMPLEMENTED | PARTIAL | MISSING | UNKNOWN` 판정
- AI 의미 후보와 확정 결과 분리
- 취약본→수정본의 `RESOLVED | REMAINS | NEW` 비교
- Precision·Recall 평가와 회귀 테스트

**완료 기준**

- 문자열 검색만으로 `CONFIRMED`를 만들지 않는다.
- 모든 확정 finding에 rule ID, source hash, file/line, tool version이 있다.
- 취약 fixture와 안전 fixture의 예상 결과가 자동 검증된다.
- AI 단독 결과는 항상 `NEEDS_REVIEW`다.
- 같은 입력과 rule version에서 같은 핵심 결과를 반환한다.

**통합 책임:** 판정 재현성, 결정론적 근거 품질, 재검사 diff의 정확성.

### D — 온체인·가격·운영

**대표 브랜치:** `feat/d-chain-replay-monitor`
**기본 소유 경로:** `data/synthetic/`, `infra/`, backend chain worker·valuation·simulation 모듈

**임무:** 온체인 사건과 가격 증거를 수집하고 외부 장애 중에도 제출용 P0가 안정적으로 작동하게 한다.

**담당 작업**

- Kaia Kairos 목업 토큰·오라클 배포
- 배포 주소와 transaction 기록
- `PriceUpdated`, `Minted`, `Paused` event polling
- 마지막 처리 block cursor와 재수집
- `(chain_id, tx_hash, log_index)` 중복 제거
- 실제 receipt 검증과 `OnchainEvidence` 생성
- LIVE와 같은 schema를 사용하는 Replay fixture와 version
- 기준가 snapshot, 모델 version, 데이터 품질 상태
- 가격 밴드와 지속 횟수 기반 무결성 경보
- allowlist·rate limit·receipt 기반 시뮬레이터
- Docker, 배포 runbook, 대체 RPC, Sentry, uptime monitor
- `/health/live`, `/health/ready` 운영 검증
- 9월 7일 11시부터 9월 11일 23시 59분까지 URL 모니터링

**완료 기준**

- P0 Replay는 RPC 없이도 재현된다.
- receipt가 없는 사건을 LIVE로 표시하지 않는다.
- event 중복 수집이 중복 경보를 만들지 않는다.
- worker 재시작 후 마지막 block부터 복구한다.
- RPC 장애가 문서–코드 분석과 report 생성을 막지 않는다.
- P1 LIVE는 10회 중 9회 이상 전체 흐름이 성공할 때만 승격한다.

**통합 책임:** 배포 안정성, LIVE/REPLAY 진실성, signer·secret 경계, 심사 기간 운영.

---

## 7. 풀스택 계약

### 단일 타입 흐름

```text
Pydantic
  → OpenAPI
  → 생성된 TypeScript client
  → TanStack Query
  → UI
```

프론트가 AI 원문 JSON을 직접 해석하거나 별도 DTO를 수기로 만들지 않는다.

### P0·P1 API 목록

| Method | Endpoint | 우선순위 | 주생산자 | 주소비자 |
|---|---|---:|---|---|
| POST | `/v1/assets` | P0 | B | A |
| POST | `/v1/assets/{id}/documents` | P0 | B | A |
| GET | `/v1/document-jobs/{id}` | P0 | B | A |
| PATCH | `/v1/assets/{id}/controls` | P0 | B | A, C |
| POST | `/v1/assets/{id}/scans` | P0 | B, C | A |
| GET | `/v1/scans/{id}` | P0 | B, C | A |
| POST | `/v1/scans/{id}/rescan` | P0 | B, C | A |
| GET | `/v1/assets/{id}/events` | P0/P1 | D | A, B |
| GET | `/v1/assets/{id}/timeseries` | P1 | D | A |
| GET | `/v1/alerts` | P0/P1 | D, B | A |
| PATCH | `/v1/alerts/{id}` | P0/P1 | B | A |
| POST | `/v1/simulations/oracle-shock` | P1 | D | A |
| GET | `/v1/reports/{id}` | P0 | B | A |
| GET | `/health/live` | P0 | B, D | 운영 |
| GET | `/health/ready` | P0 | B, D | 운영 |

### 공통 오류 envelope

모든 실패 응답은 최소한 다음 의미를 일관되게 제공한다.

```json
{
  "code": "SCAN_TOOL_UNAVAILABLE",
  "message": "컨트랙트 분석 도구를 사용할 수 없습니다.",
  "retryable": true,
  "trace_id": "synthetic-trace-id",
  "details": {}
}
```

실제 필드와 enum은 계약 동결 시 Pydantic과 JSON Schema에 확정한다.

### 계약 변경 규칙

공통 계약을 바꾸는 PR은 다음을 같은 변경에서 갱신한다.

1. Pydantic model
2. JSON Schema 또는 OpenAPI
3. example payload
4. 생산자 test
5. 소비자 test
6. frontend 상태 표현

`contracts/`는 전 팀 공통 소유이며 네 트랙 리뷰 없이 단독 변경하지 않는다.

---

## 8. 브랜치와 PR 운영

### 개발 전

```text
main
  └─ codex/planning-development-contract-v1
```

현재는 위 기획 브랜치 하나만 사용한다. 개발 착수 게이트를 통과한 후 `main`에 squash merge한다.

### 개발 시작 후 첫 네 트랙

```text
main
  ├─ feat/a-ai-evidence-console
  ├─ feat/b-document-ai-extraction
  ├─ feat/c-contract-assurance-engine
  └─ feat/d-chain-replay-monitor
```

위 이름은 역할별 첫 작업 묶음이다. 제출일까지 유지하는 장기 통합 브랜치가 아니다. 첫 PR 이후에는 다음과 같이 1~2일 크기로 더 작게 자른다.

- A: `feat/a-dashboard-shell` → `feat/a-evidence-report`
- B: `feat/b-document-pipeline` → `feat/b-scan-api`
- C: `feat/c-core-rules` → `feat/c-rescan-diff`
- D: `feat/d-replay-pipeline` → `feat/d-kairos-live`

Codex가 브랜치를 생성할 때는 저장소 도구 규칙에 따라 `codex/` prefix를 붙인다.

### PR 규칙

- `main`은 항상 실행·배포 가능한 상태로 유지한다.
- PR은 squash merge하고 병합 후 feature branch를 삭제한다.
- 한 PR은 한 가지 사용자 가치 또는 계약 변경만 담는다.
- 담당 경로 밖 파일을 수정할 때 소유자에게 리뷰를 요청한다.
- DB migration은 B와 D가 함께 확인한다.
- API 계약 변경은 생산자와 A 소비 화면을 함께 확인한다.
- 실제 secret, signer key, 금융정보, 개인정보를 커밋하지 않는다.
- 공통 fixture가 깨진 PR은 병합하지 않는다.

---

## 9. 매일 통합 루틴

1. 오전에 `main`을 기준으로 각 작업 브랜치를 최신화한다.
2. 정오까지 계약 변경을 공유하고 example payload를 먼저 갱신한다.
3. 오후에 공통 fixture로 다음 경로를 실행한다.

```text
ControlSpec
  → CodeFinding
  → MismatchFinding
  → OnchainEvidence(LIVE|REPLAY)
  → EvidenceReport
  → Web rendering
```

4. Web이 `UNKNOWN`, `NEEDS_REVIEW`, `REPLAY`를 정상·확정·LIVE로 표시하지 않는지 확인한다.
5. 취약 fixture와 수정 fixture의 결과 차이가 유지되는지 확인한다.
6. AI와 RPC를 각각 차단해도 P0 샘플 경로와 저장된 report가 열리는지 확인한다.
7. 1~2일 크기의 PR을 당일 또는 다음 날 `main`에 병합한다.

---

## 10. 역할별 한 문장

- **A는 심사자가 보고 이해하게 만든다.**
- **B는 문서와 시스템을 구조화해 연결한다.**
- **C는 보안 판정이 사실임을 증명한다.**
- **D는 체인 데이터와 배포가 실제로 계속 작동하게 만든다.**

기능 완료는 화면이나 API가 따로 존재하는 상태가 아니다. 합성 fixture를 사용해 네 역할의 산출물이 하나의 Evidence Spine과 Evidence Report로 연결되고, 실패·제한·LIVE/REPLAY 상태가 정직하게 표시되는 상태다.
