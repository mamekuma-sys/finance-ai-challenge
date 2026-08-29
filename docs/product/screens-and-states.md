# 화면 5개와 모든 상태 — 항목 1 최소 산출물

| 항목 | 내용 |
|---|---|
| 주담당 | 태성이(A) |
| 같이 확인 | 전원 |
| 기준일 | 2026-08-26 |
| 상위 계약 | `docs/product/prd.md` §9, `contracts/schemas/` |
| 소비처 | 항목 2 API 계약, 항목 3 타입 생성 |

이 문서는 P0 제출 화면의 URL, 상태, 화면이 요구하는 계약 필드를 고정한다. 필드 이름은 전부 `contracts/schemas/`에 이미 존재하는 것만 사용하며, 새 필드가 필요하면 이 문서가 아니라 Pydantic 모델을 먼저 바꾼다.

---

## 1. PRD 화면 7개 → 제출 URL 5개 매핑

PRD §9는 S1~S7을 정의하지만 P0 제출 URL은 5개다. 아래가 그 대응이며, 독립 URL을 받지 않는 화면은 어디에 흡수되는지 명시한다.

| PRD | 화면 | P0 URL | 비고 |
|---|---|---|---|
| S1 | 관제 홈 | `/` | |
| S2 | 신규 자산 등록 | `/` 내 dialog → `/assets/{id}/document` | 독립 URL 없음. 등록 완료 시 문서 화면으로 이동 |
| S3 | 발행조건 검토 | `/assets/{id}/document` | |
| S4 | 컨트랙트 검증 결과 | `/assets/{id}/scan` | |
| S5 | 자산 상세 | `/assets/{id}` | |
| S6 | 경보 상세·리포트 | `/reports/{id}` | P0는 리포트, P1 승격 시 경보 진입점 추가 |
| S7 | 조작 시뮬레이터 | `/assets/{id}?panel=simulator` | **P1 조건부.** 승격 실패 시 패널 자체를 렌더링하지 않는다 |

**S2·S7에 독립 URL을 주지 않는 이유 — 미결이 아니라 확정이다.**

handoff가 P0 제출 화면을 위 5개 URL로 이미 고정했다. `/assets/new`나 `/simulator`를 신설하면 6번째·7번째 화면이 되어 그 고정과 충돌한다. 따라서 두 화면은 흡수하는 것 외에 선택지가 없다.

- **S2 자산 등록** → `/`의 dialog. 등록 성공 시 `/assets/{id}/document`로 이동하며, 등록 job의 진행·실패 상태는 dialog 안에서 처리한다.
- **S7 시뮬레이터** → `/assets/{id}`의 패널. **P1 승격(2026-09-03) 실패 시 패널을 렌더링하지 않는다.** 비활성 버튼으로도 남기지 않는다.

6번째 URL이 필요하다는 판단이 나오면 그것은 A 단독 결정이 아니라 handoff의 화면 목록 변경이므로 전원 합의가 필요하다.

---

## 2. URL 상태 파라미터

심사자가 화면을 그대로 공유할 수 있어야 하므로(아키텍처 문서 §102) 선택 상태는 URL에 유지한다.

| 파라미터 | 적용 URL | 값 | 용도 |
|---|---|---|---|
| `scan` | `/assets/{id}`, `/assets/{id}/scan` | `scan_id` | 볼 Scan Run 고정 |
| `base` | `/assets/{id}/scan` | `scan_id` | 재검사 전후 비교 기준 |
| `finding` | `/assets/{id}/scan`, `/reports/{id}` | `finding_id` | Evidence Spine 선택 노드 |
| `constraint` | `/assets/{id}/document` | `constraint_id` | 문서 span 강조 |
| `panel` | `/assets/{id}` | `simulator` | P1 시뮬레이터 |

파라미터가 가리키는 대상이 없으면 404로 넘기지 않고 **해당 화면의 빈 상태 + 잘못된 링크 안내**로 처리한다.

---

## 3. 공통 상태 정의

모든 화면이 아래 6개 상태를 갖는다. 화면별 표는 이 정의를 구체화한 것이다.

| 상태 | 트리거 | 표시 원칙 |
|---|---|---|
| 정상 | 200, 데이터 있음 | |
| 로딩 | 최초 fetch, `ScanRun.status ∈ {QUEUED, RUNNING}` | skeleton. spinner만 두지 않고 무엇을 기다리는지 문구로 표시 |
| 빈 상태 | 200, 컬렉션 길이 0 | 다음 행동 1개를 제시 |
| 부분 실패 | `ScanRun.status = PARTIAL`, 또는 P1 섹션만 실패 | **성공 구간은 그대로 보여주고** 실패 구간만 명시. 전체를 오류로 덮지 않음 |
| 분석 불가 | `FindingStatus ∈ {NEEDS_REVIEW, UNKNOWN}`, `implementation_status = UNKNOWN` | `확인 필요`로 표기. 값을 추측해 채우지 않음 |
| REPLAY | `OnchainEvidence.mode = REPLAY` | 온체인 값 옆에 `REPLAY` 배지 + `fixture_version`. 실시간으로 위장 금지 |

### 상태 표기 어휘 고정

| 계약 값 | 화면 문구 |
|---|---|
| `CONFIRMED` | 확정 |
| `PROBABLE` | 유력 |
| `NEEDS_REVIEW` | 확인 필요 |
| `UNKNOWN` | 판단 불가 |
| `LIVE` / `REPLAY` | 실시간 / 재현 |
| `IMPLEMENTED` / `PARTIAL` / `MISSING` / `UNKNOWN` | 구현됨 / 부분 구현 / 미구현 / 판단 불가 |

AGENTS.md §266에 따라 `AI 판정`이라는 표현을 쓰지 않는다. `의미 분석`, `근거 결합`, `확인 필요`를 쓴다.

---

## 4. 화면별 상태표

### S1 — 관제 홈 `/`

**목적:** 심사자가 10초 안에 위험 자산과 원인을 찾는다.

| 상태 | 화면 |
|---|---|
| 정상 | 자산 카드 그리드 + 상단 Critical 경보 + 신호등(정상/주의/위험) + 최신성 상태 |
| 로딩 | 카드 skeleton 3개. 집계 수치 자리 유지 |
| 빈 상태 | "등록된 자산이 없습니다" + `자산 등록` 단일 CTA |
| 부분 실패 | 자산 목록은 정상, P1 Price Integrity 열만 `측정 불가`. 카드 자체는 계속 클릭 가능 |
| 분석 불가 | Exploit Risk 미산출 자산은 점수 자리에 `확인 필요`. 0점으로 표기하지 않음 |
| REPLAY | 최신성 상태 영역에 `재현 데이터 기준` 배지 + fixture version |

**요구 필드:** `asset_id`, 자산명, `ScanRun.status`, `ScanRun.completed_at`, 자산별 최고 `Severity`, Critical/High 건수, `OnchainEvidence.mode`, `fixture_version`

**수용 기준:** 카드 클릭 → `/assets/{id}`. 최신 Critical이 최상단.

#### S2 등록 dialog (`/` 내부)

| 상태 | 화면 |
|---|---|
| 정상 | 자산명·문서·컨트랙트 입력. 저장 시 201 → `/assets/{id}/document`로 이동 |
| 로딩 | 저장 버튼 비활성 + 진행 표시. **dialog를 닫아도 job은 계속된다** |
| 빈 상태 | 해당 없음 (항상 입력 폼) |
| 부분 실패 | 자산은 생성됐으나 문서 업로드 실패 → 자산 상세로 보내고 문서 재업로드를 안내. 자산 생성을 롤백하지 않는다 |
| 분석 불가 | 해당 없음 |
| REPLAY | 해당 없음 |

**요구 필드:** 자산명, 문서 파일, 컨트랙트 주소 또는 source, 생성 응답의 `asset_id`·`document_id`

---

### S3 — 발행조건 검토 `/assets/{id}/document`

**목적:** 추출된 통제조건 6개를 근거와 함께 확인·수정·확정한다.

| 상태 | 화면 |
|---|---|
| 정상 | 좌: PDF page 뷰 + span 하이라이트 / 우: `ControlSpec` 목록. 행 선택 시 해당 page·span으로 스크롤 |
| 로딩 | 업로드 후 추출 job 진행. `문서 3페이지 중 2페이지 분석` 형태로 단계 표시 |
| 빈 상태 | 문서 미업로드 → 업로드 영역만. 허용 형식·최대 크기 명시 |
| 부분 실패 | 6개 중 일부만 추출됨. **추출된 항목은 확정 가능**하고 실패 항목만 `추출 실패 — 수동 입력` |
| 분석 불가 | `confirmed = false`이고 값을 못 찾은 항목은 빈 값 + `확인 필요`. 임의 값 생성 금지 |
| REPLAY | 해당 없음 |

**요구 필드:** `ControlSpec` 전체(`constraint_id`, `field`, `value`, `unit`, `evidence_span.{page,start,end,quote}`, `confirmed`), `document_id`, 원문 PDF 접근 URL

**수용 기준:** 모든 조건에서 문서 page/span으로 이동 가능. 확정 버튼이 `confirmed`를 true로 바꾸고 결과가 재조회에도 유지된다.

---

### S4 — 컨트랙트 검증 결과 `/assets/{id}/scan`

**목적:** Risk, 문서–코드 불일치, 코드 근거를 한 화면에서 잇는다. Evidence Spine의 본진.

| 상태 | 화면 |
|---|---|
| 정상 | Risk Ruler + `MismatchFinding` 목록 + 선택 시 Evidence Spine(문서 span → 코드 line → 온체인 → 경보) + Shiki 코드 뷰 |
| 로딩 | `QUEUED`는 "대기 중", `RUNNING`은 진행 단계 표시. TanStack Query polling |
| 빈 상태 | 컨트랙트 미연결 → 연결 CTA. 검사 완료·결함 0건은 `자동검사 통과 — 담당자 검토 필요`(FR-15) |
| 부분 실패 | `status = PARTIAL`. 완료된 rule 결과는 표시하고 실패 rule은 `검사 실패` 행으로 분리. `tool_versions`로 어떤 도구가 죽었는지 표기 |
| 분석 불가 | `NEEDS_REVIEW`/`UNKNOWN`은 Critical/High 집계에서 제외하고 별도 구획. **확정 승격 UI 없음**(AGENTS.md 불변식 4) |
| REPLAY | Spine의 CHAIN 노드에 `REPLAY` 배지. `tx_hash`는 표시하되 explorer 링크는 LIVE에서만 활성 |

**요구 필드:** `ScanRun` 전체, `CodeFinding` 전체(`rule_id`, `severity`, `status`, `code_location.{file,start_line,end_line,excerpt}`, `deterministic_evidence`, `source_hash`, `tool_versions`), `MismatchFinding` 전체(`implementation_status`, `evidence_links` 최소 2개), 연결된 `OnchainEvidence`

**재검사 비교(`?base=`):** 발견사항별 `해결 / 잔존 / 신규`와 Risk 변화. 기존 Scan Run은 보존.

**수용 기준:** 모든 Critical/High에서 문서 조항과 코드 라인 양쪽으로 이동 가능.

---

### S5 — 자산 상세 `/assets/{id}`

**목적:** 자산 하나의 전체 맥락. P0는 통제·검사 이력, P1은 가격·경보 추이.

| 상태 | 화면 |
|---|---|
| 정상 | 자산 요약 + 발행조건 구현 상태 + Scan 이력 + (P1) 기준가 밴드 차트·경보 타임라인·최신 온체인 이벤트 |
| 로딩 | 섹션별 독립 skeleton. 한 섹션 지연이 다른 섹션을 막지 않음 |
| 빈 상태 | 검사 이력 없음 → `검증 시작` CTA |
| 부분 실패 | **P1 차트 실패가 P0 섹션을 막지 않는다**(불변식 7). 차트 자리에 `가격 데이터 수집 실패` 배너, 통제·검사 섹션은 정상 |
| 분석 불가 | 데이터 최신성 `FRESH / AGING / STALE / INVALID` 표기. `STALE` 이상이면 위험점수 옆에 신뢰 저하 표시 |
| REPLAY | 차트·이벤트 영역 상단에 `재현 데이터` 배지와 `fixture_version`. LIVE 미승격 시 기본값 |

**요구 필드:** 자산 메타, `ControlSpec[].{constraint_id, confirmed}`, `MismatchFinding[].implementation_status`, `ScanRun[]`, (P1) 밴드 시계열·`OnchainEvidence[]`·경보

**P1 시뮬레이터(`?panel=simulator`):** 실행 전 테스트넷·대상 주소 확인, receipt 성공 전 UI 상태 변경 금지, 반복 실행 제한.

---

### S6 — 리포트 `/reports/{id}`

**목적:** 제출·심사용 증적. 화면에서 읽히고 JSON으로 떨어진다.

| 상태 | 화면 |
|---|---|
| 정상 | HTML 리포트 전문 + `JSON 다운로드` + lineage(입력 해시, rule version, 생성시각, 제한사항) |
| 로딩 | 조립 job 진행 표시 |
| 빈 상태 | 리포트 미생성 → `리포트 생성` CTA |
| 부분 실패 | 원본 Scan이 `PARTIAL`이면 리포트 상단에 **검사 범위 제한 고지**를 고정 배치하고 누락 rule을 나열 |
| 분석 불가 | 근거 링크 없는 서술은 Critical/High 근거로 쓰지 않음. 해당 항목은 `확인 필요` 구획 |
| REPLAY | 온체인 증적 섹션 전체에 `REPLAY` 배지 + `fixture_version`. LIVE와 REPLAY 항목을 한 표에 섞지 않음 |

**요구 필드:** `EvidenceReport` 전체(`report_id`, `scan_run`, `controls`, `code_findings`, `mismatches`, `onchain_evidence`, `lineage`, `generated_at`), HTML/JSON 다운로드 URL

**수용 기준:** 화면에서 읽는 HTML과 다운로드 JSON이 같은 증적을 담는다. 제한사항·사람 검토 필요 문구가 항상 포함된다.

---

## 5. 항목 2로 넘기는 요구사항

위 표에서 API가 반드시 제공해야 하는 것:

1. `ScanRun.status`가 `PARTIAL`일 때 **어떤 rule이 실패했는지** 식별 가능해야 한다. 현재 `scan-run.schema.json`에는 실패 rule 목록 필드가 없다. → **추가 필요**
2. 데이터 최신성 `FRESH / AGING / STALE / INVALID`가 계약에 없다. 기술스택 문서에만 존재한다. → **추가 필요**
3. `/reports/{id}` HTML과 JSON의 URL 규칙.
4. 자산 목록 응답에 자산별 최고 severity와 Critical/High 건수 집계 포함 여부. 프론트 집계로 두면 목록이 findings 전체를 받아야 한다. → **서버 집계 권장**
5. 재검사 diff(`해결/잔존/신규`)를 서버가 계산하는지 프론트가 두 Scan을 비교하는지. → **서버 계산 권장**(rule version이 다르면 프론트가 판단 불가)
