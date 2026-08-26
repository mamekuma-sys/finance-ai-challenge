# RWA Guard 팀 Handoff

기준일: 2026-08-26

기준 브랜치: `codex/planning-development-contract-v1`

이 문서는 개발 전에 꼭 정해야 하는 9개 항목의 주담당만 고정한다. 세부 구현은 각 개발 브랜치에서 진행하며, 이 기획 브랜치에서 모든 코드를 미리 설계하지 않는다.

## 역할

| 트랙 | 담당자 | 기본 소유 영역 |
|---|---|---|
| A | 태성이 | `apps/web/` 제품·프론트엔드 |
| B | 종인이 | `services/backend/` 문서 AI·API·DB |
| C | 본인 | `chain/` 및 결정론적 컨트랙트 검사 |
| D | 석연이형 | `data/synthetic/`, chain worker, `infra/` |

## 9개 항목 배치

| 번호 | 결정할 내용 | 주담당 | 같이 확인할 사람 | 최소 산출물 |
|---:|---|---|---|---|
| 1 | 핵심 화면 5개와 모든 상태 | 태성이(A) | 전원 | 화면·URL·로딩/실패/Replay 상태표 |
| 2 | P0/P1 API 및 공통 오류 형식 | 종인이(B) | 태성이(A), 석연이형(D) | endpoint 목록과 error JSON 1개 |
| 3 | Pydantic → OpenAPI → TypeScript 타입 생성 | 종인이(B) | 태성이(A) | 생성 명령과 example 1개 |
| 4 | AI 입력·근거·실패 처리와 평가셋 | 종인이(B) | 본인(C) | 6개 추출 필드, 실패 원칙, 최소 평가 케이스 |
| 5 | 결정론적 결함 검사 3종 | 본인(C) | 종인이(B) | rule ID, 확정 근거, 취약/안전 fixture 기준 |
| 6 | DB 엔터티와 job 상태 전이 | 종인이(B) | 석연이형(D) | 핵심 테이블과 `QUEUED → RUNNING → 완료/부분실패/실패` |
| 7 | 공통 fixture와 수직 E2E | 본인(C) | 전원 | 한 개의 고정 시나리오와 실행 순서 |
| 8 | 4인 역할·브랜치·PR 운영 규칙 | 본인(C) | 전원 | 아래 브랜치명과 PR 규칙 합의 |
| 9 | 배포 서비스, Sentry, RPC 등 미확정 기술 | 석연이형(D) | 종인이(B) | 공급업체 선택표와 fallback 한 줄 |

종인이에게 2·3·4·6이 모이는 이유는 API 원본, AI pipeline, DB/job이 같은 backend 계약이기 때문이다. 석연이형은 2의 P1 API, 6의 event 저장, 7의 Replay payload를 함께 확인한다.

## 각자 바로 할 일

### 태성이 — A

1. `/`, `/assets/{id}/document`, `/assets/{id}/scan`, `/assets/{id}`, `/reports/{id}` 5개 화면을 표로 정리한다.
2. 각 화면의 정상·로딩·빈 상태·부분 실패·분석 불가·REPLAY 상태를 적는다.
3. 종인이가 만든 OpenAPI 타입이 화면에서 필요한 필드를 충족하는지 확인한다.

### 종인이 — B

1. P0/P1 endpoint와 공통 error envelope를 확정한다.
2. Pydantic을 원본으로 OpenAPI와 TypeScript client 생성 명령을 정한다.
3. 문서 AI의 6개 추출 필드, page/span 근거, AI 실패 시 `NEEDS_REVIEW` 원칙을 적는다.
4. 핵심 DB 엔터티와 job 상태 전이를 확정한다.

### 본인 — C

1. 접근권한, 담보·발행한도, 오라클 검증 3개 rule의 ID와 `CONFIRMED` 근거를 정한다.
2. 취약 fixture와 수정 fixture의 기대 결과를 고정한다.
3. 공통 E2E 실행 순서와 브랜치·PR 규칙을 정리한다.

### 석연이형 — D

1. Replay payload와 LIVE payload가 같은 `OnchainEvidence` 계약을 쓰는지 확인한다.
2. Supabase, Docker host, Sentry, uptime monitor, primary/fallback RPC 선택안을 정한다.
3. receipt 없는 데이터는 LIVE로 표시하지 않는 운영 원칙과 P0 fallback을 적는다.

## 공통 E2E 한 개만 먼저 고정

```text
합성 발행 문서
  → ControlSpec
  → 취약 Solidity의 CodeFinding
  → MismatchFinding
  → REPLAY OnchainEvidence
  → EvidenceReport
  → Web Evidence Spine
```

첫 E2E는 AI API와 Kaia RPC 없이 재현되어야 한다. AI와 LIVE 체인은 이 경로가 통과한 뒤 붙인다.

## 첫 개발 브랜치

| 담당 | 브랜치 |
|---|---|
| 태성이 | `codex/feat/a-ai-evidence-console` |
| 종인이 | `codex/feat/b-document-ai-extraction` |
| 본인 | `codex/feat/c-contract-assurance-engine` |
| 석연이형 | `codex/feat/d-chain-replay-monitor` |

## PR 규칙

- `main`은 항상 실행 가능한 상태로 둔다.
- 한 PR은 한 가지 사용자 가치 또는 계약 변경만 담는다.
- 공통 계약 변경은 Pydantic, schema/OpenAPI, example, 소비 test를 같이 바꾼다.
- AI 단독 결과는 `CONFIRMED`가 될 수 없고 receipt 없는 데이터는 `LIVE`가 될 수 없다.

## 기획 종료 조건

위 표의 최소 산출물 9개가 한 번씩 합의되면 기획을 끝내고 네 개발 브랜치로 나눈다. 배포 공급업체처럼 바로 확정하기 어려운 항목은 후보·결정일·기본 fallback만 남기고 구현을 막지 않는다.
