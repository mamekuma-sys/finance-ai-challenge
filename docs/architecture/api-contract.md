# 화면이 API에 요구하는 것 — 항목 1이 항목 2로 넘기는 입력

| 항목 | 내용 |
|---|---|
| 항목 2 주담당 | **종인이(B)** — endpoint와 error 형식의 확정 권한은 B에게 있다 |
| 이 문서 작성 | 태성이(A) |
| 성격 | **A의 요구사항 명세이지 B의 계약이 아니다.** 화면 5개에서 역산한 것 |
| 같이 확인 | 석연이형(D) |
| 기준일 | 2026-08-26 |
| 입력 | `docs/product/screens-and-states.md` |

**읽는 법:** 여기 적힌 endpoint와 error 형태는 *제안*이다. 종인이가 다른 형태로 확정하면 그쪽이 맞고, 이 문서는 "그래도 화면이 이 정보는 있어야 그려진다"는 요구만 남긴다. §4의 스키마 변경 요청 5개가 이 문서의 진짜 알맹이다.

**이 문서는 계약의 원본이 아니다.** 원본은 Pydantic 모델이고, 확정 시 `contracts/generated/openapi.json`이 사실이 된다. 여기 적힌 것과 OpenAPI가 다르면 OpenAPI가 맞다.

---

## 1. 공통 규약

| 항목 | 값 |
|---|---|
| Base path | `/v1` (`/health` 제외) |
| 표현 | `application/json`, UTF-8 |
| 시각 | RFC 3339 UTC (`2026-08-26T04:12:00Z`) |
| ID | `{prefix}_{ulid}` 문자열. 프론트는 형식을 파싱하지 않는다 |
| 인증 | P0 없음. 제출 데모는 read-mostly 공개 |
| CORS | `PUBLIC_WEB_ORIGIN`만 허용 (현행 `api/main.py`와 동일) |

### 상태코드 사용

| 코드 | 사용 |
|---|---|
| 200 | 조회 성공. **부분 실패 포함** |
| 201 | 자산·문서·scan·report 생성 |
| 202 | job 수락, 결과는 polling |
| 400 | 요청 형식 오류 |
| 404 | 대상 없음 |
| 409 | 상태 충돌 (예: `RUNNING` scan 중복 생성) |
| 413 | 문서 크기 초과 |
| 422 | Pydantic 검증 실패 |
| 429 | 시뮬레이터 rate limit |
| 503 | 외부 의존(AI·RPC) 불가, 재시도 가능 |

**핵심:** 부분 실패는 오류가 아니다. `ScanRun.status = PARTIAL`을 담은 **200**으로 응답한다. 화면이 성공 구간을 계속 보여줘야 하기 때문이다(불변식 7).

---

## 2. 공통 오류 envelope — 확정 대상 1개

```json
{
  "error": {
    "code": "AI_EXTRACTION_UNAVAILABLE",
    "message": "문서 추출 서비스에 연결할 수 없습니다.",
    "retryable": true,
    "detail": {
      "stage": "extract_controls",
      "document_id": "doc_01J9Z2QK7F3M8YB4T6VNXR",
      "failed_fields": ["max_supply", "collateral_ratio"]
    },
    "trace_id": "req_01J9Z2QK7F3M8YB4T6VNXS"
  }
}
```

| 필드 | 타입 | 필수 | 의미 |
|---|---|---|---|
| `error.code` | string enum | ✓ | 기계 판독용. 화면 분기는 이 값만 본다 |
| `error.message` | string | ✓ | 한국어 사용자 문구. 그대로 노출 가능해야 한다 |
| `error.retryable` | boolean | ✓ | true면 프론트가 재시도 버튼을 노출한다 |
| `error.detail` | object | | code별 추가 정보. 없으면 생략 |
| `error.trace_id` | string | ✓ | Sentry·서버 로그 상관키 |

**규칙**

1. 모든 4xx·5xx는 예외 없이 이 형태다. FastAPI 기본 `{"detail": ...}`를 그대로 내보내지 않는다 — exception handler로 감싼다.
2. `message`에 stack trace, SQL, 내부 경로, 모델 프롬프트를 넣지 않는다.
3. `retryable = true`인데 프론트가 자동 재시도하는 것은 GET만. POST 재시도는 사용자 클릭으로만.
4. TanStack Query `retry`는 `retryable` 값을 따른다.

### 오류 코드

| code | 상태 | retryable | 발생 |
|---|---|---|---|
| `VALIDATION_FAILED` | 422 | false | 요청 스키마 불일치 |
| `RESOURCE_NOT_FOUND` | 404 | false | asset/scan/report 없음 |
| `SCAN_ALREADY_RUNNING` | 409 | false | 진행 중 scan 중복 요청 |
| `DOCUMENT_TOO_LARGE` | 413 | false | 업로드 크기 초과 |
| `DOCUMENT_PARSE_FAILED` | 200/400 | false | PDF 구조 파싱 불가 |
| `AI_EXTRACTION_UNAVAILABLE` | 503 | true | Anthropic 호출 실패·timeout |
| `ANALYSIS_TOOLCHAIN_FAILED` | 200 | false | Slither/solc 실패 → `PARTIAL`로 흡수 |
| `CHAIN_RPC_UNAVAILABLE` | 503 | true | **P1만.** P0 경로를 막지 않는다 |
| `SIMULATION_RATE_LIMITED` | 429 | true | P1 시뮬레이터 |
| `INTERNAL_ERROR` | 500 | true | 미분류 |

---

## 3. P0 endpoint

| Method | Path | 응답 | 소비 화면 |
|---|---|---|---|
| GET | `/health` | `HealthResponse` | 운영 |
| GET | `/v1/assets` | `AssetSummary[]` | S1 `/` |
| POST | `/v1/assets` | 201 `Asset` | S2 dialog |
| GET | `/v1/assets/{asset_id}` | `AssetDetail` | S5 `/assets/{id}` |
| POST | `/v1/assets/{asset_id}/documents` | 202 `{document_id, job_id}` | S3 |
| GET | `/v1/documents/{document_id}` | `Document` + page 메타 | S3 |
| GET | `/v1/documents/{document_id}/file` | PDF bytes | S3 뷰어 |
| GET | `/v1/assets/{asset_id}/controls` | `ControlSpec[]` | S3 |
| PATCH | `/v1/controls/{constraint_id}` | `ControlSpec` | S3 수정·확정 |
| POST | `/v1/assets/{asset_id}/contracts` | 201 `{contract_id, source_hash}` | S4 |
| POST | `/v1/assets/{asset_id}/scans` | 202 `ScanRun` | S4 |
| GET | `/v1/scans/{scan_id}` | `ScanRun` | S4 polling |
| GET | `/v1/scans/{scan_id}/findings` | `CodeFinding[]` | S4 |
| GET | `/v1/scans/{scan_id}/mismatches` | `MismatchFinding[]` | S4 |
| GET | `/v1/scans/{scan_id}/diff?base={scan_id}` | `FindingDiff[]` | S4 재검사 |
| POST | `/v1/scans/{scan_id}/report` | 201 `{report_id}` | S6 |
| GET | `/v1/reports/{report_id}` | `EvidenceReport` | S6 |
| GET | `/v1/reports/{report_id}/export.json` | JSON 첨부 | S6 다운로드 |
| GET | `/v1/reports/{report_id}/export.html` | HTML | S6 |
| GET | `/v1/demo/evidence-report` | `EvidenceReport` | **현행 유지.** RPC·AI 없는 E2E 시드 |

### P1 endpoint

| Method | Path | 응답 |
|---|---|---|
| GET | `/v1/assets/{asset_id}/price-band?from=&to=` | 밴드 시계열 |
| GET | `/v1/assets/{asset_id}/onchain-events` | `OnchainEvidence[]` |
| GET | `/v1/alerts` / `/v1/alerts/{alert_id}` | 경보 |
| POST | `/v1/assets/{asset_id}/simulate` | 202 `{job_id}` |

P1 endpoint가 전부 503이어도 P0 화면 5개는 완주해야 한다.

---

## 4. 화면 요구에서 나온 스키마 변경 요청

`docs/product/screens-and-states.md` §5에서 올라온 것. **Pydantic → schema → example → TS 순서로** 종인이가 반영한다.

### 4.1 `ScanRun`에 실패 rule 추가 — 필수

`status = PARTIAL`일 때 화면이 무엇이 실패했는지 표시할 수 없다.

```json
"failed_stages": [
  { "stage": "slither", "rule_id": "ORACLE_VALIDATION_001", "reason": "toolchain timeout" }
]
```

`status = PARTIAL`이면 `minItems: 1`을 요구한다.

### 4.2 데이터 최신성 enum 추가 — 필수

`FRESH | AGING | STALE | INVALID`가 기술스택 문서에만 있고 계약에 없다. `OnchainEvidence` 또는 자산 응답에 `freshness` 필드로 넣는다.

### 4.3 `AssetSummary` 서버 집계 — 권장

목록 화면이 findings 전체를 받지 않도록 서버가 집계한다.

```json
{
  "asset_id": "asset_...", "name": "Han River Office 01",
  "highest_severity": "CRITICAL", "critical_count": 1, "high_count": 2,
  "latest_scan": { "scan_id": "scan_...", "status": "COMPLETED", "completed_at": "..." },
  "evidence_mode": "REPLAY", "freshness": "FRESH", "is_synthetic": true
}
```

### 4.4 `FindingDiff` 신설 — 권장

rule version이 다르면 프론트가 `해결/잔존/신규`를 판단할 수 없다. 서버가 계산한다.

```json
{ "finding_id": "cf_...", "change": "RESOLVED | REMAINS | NEW",
  "base_scan_id": "scan_...", "head_scan_id": "scan_...", "severity": "CRITICAL" }
```

### 4.5 `MismatchFinding.evidence_links` 표현

현재 `string[] (minItems 2)`라 프론트가 링크 종류를 구분할 수 없다. 최소한 문서 근거 1개 + 코드 근거 1개가 보장되는지 B 확인 필요. 구조화(`{kind, ref}`)가 안전하다.
