# Pydantic → OpenAPI → TypeScript 타입 생성 — 항목 3 최소 산출물

| 항목 | 내용 |
|---|---|
| 항목 3 주담당 | **종인이(B)** |
| 이 문서 작성 | 태성이(A) |
| A가 소유하는 범위 | `apps/web/` 소비측 — `npm run gen:api`, `api-client.ts`, `contracts.ts` 재수출 |
| B가 소유하는 범위 | `services/backend/scripts/export_openapi.py`와 `contracts/generated/` 생성 책임 |
| 기준일 | 2026-08-26 |
| 상태 | **동작 확인 완료** — 아래 명령이 현재 저장소에서 실제로 통과한다 |
| 성격 | A가 소비측을 먼저 깔아둔 것. B가 생성측을 다른 방식으로 확정하면 그쪽을 따른다 |

---

## 1. 단일 방향

```text
services/backend/src/rwa_guard/domain/contracts.py   ← Pydantic, 유일한 원본
  → contracts/generated/openapi.json                 ← B가 생성, 커밋
  → apps/web/src/types/api.ts                        ← A가 생성, 커밋
  → apps/web/src/types/contracts.ts                  ← 재수출 지점
  → 화면 component
```

역방향은 없다. 프론트에서 계약 타입을 손으로 정의하면 A 완료 기준 위반이다.

---

## 2. 생성 명령

### B — OpenAPI 내보내기

```powershell
cd services/backend
.\.venv\Scripts\python scripts\export_openapi.py   # → contracts/generated/openapi.json
.\.venv\Scripts\python scripts\export_schemas.py   # → contracts/generated/*.schema.json
```

### A — TypeScript 생성

```powershell
cd apps/web
npm run gen:api        # openapi-typescript ../../contracts/generated/openapi.json -o src/types/api.ts
npm run typecheck
```

### 사용 package

| package | 버전 | 위치 |
|---|---|---|
| `openapi-typescript` | 7.13.0 (exact) | `apps/web` devDependency |
| `openapi-fetch` | 0.17.0 (exact) | `apps/web` dependency |

exact pin이다. 계약 생성기의 patch 변동으로 생성물이 흔들리면 안 된다.

---

## 3. example 1개 — 실제 통과 확인

`GET /v1/demo/evidence-report`는 AI·RPC 없이 결정론적 `EvidenceReport`를 돌려주는 현행 endpoint다. P0 E2E 시드로 이걸 쓴다.

**생성 결과 (2026-08-26 실행):**

```text
openapi 3.1.0
paths   /health, /v1/demo/evidence-report
schemas CodeFinding, CodeLocation, ControlSpec, EvidenceMode, EvidenceReport,
        EvidenceSpan, FindingStatus, HealthResponse, ImplementationStatus,
        MismatchFinding, OnchainEvidence, ScanRun, ScanStatus, Severity
→ apps/web/src/types/api.ts (320줄)
```

**소비 코드:**

```ts
// apps/web/src/lib/api-client.ts
import createClient from "openapi-fetch";
import type { paths } from "@/types/api";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
export const api = createClient<paths>({ baseUrl });
```

```ts
// 호출부 — 경로 오타와 응답 형태가 컴파일 타임에 잡힌다
const { data, error } = await api.GET("/v1/demo/evidence-report");
if (error) return renderError(error);
data.onchain_evidence[0].mode;   // "LIVE" | "REPLAY"
```

```ts
// apps/web/src/types/contracts.ts — 계약 타입은 생성물 재수출만
import type { components } from "@/types/api";
type Schemas = components["schemas"];

export type EvidenceMode = Schemas["EvidenceMode"];
export type Severity = Schemas["Severity"];
export type EvidenceReport = Schemas["EvidenceReport"];
// SpineNode, DemoFinding 같은 화면 전용 view model만 직접 정의
```

**검증:** `npm run verify` (typecheck → lint → vitest → next build) 전 구간 통과.

---

## 4. 계약 변경 절차

`contracts/README.md`의 순서를 그대로 따른다.

1. B가 Pydantic 모델 변경
2. `export_openapi.py` + `export_schemas.py` 재실행, `contracts/generated/` 커밋
3. `examples/evidence-report.sample.json` 갱신
4. A가 `npm run gen:api` 후 `npm run typecheck` — **깨진 소비처를 같은 PR에서 고친다**
5. enum은 조용히 추가하지 않는다

## 5. CI gate

생성물이 원본과 어긋난 채 merge되는 것을 막는다. GitHub Actions에 추가할 단계:

```yaml
- run: python services/backend/scripts/export_openapi.py
- run: npm --prefix apps/web run gen:api
- run: git diff --exit-code contracts/generated apps/web/src/types/api.ts
```

diff가 나오면 누군가 생성을 건너뛴 것이므로 실패시킨다.

## 6. 남은 확인

- `openapi.json`을 커밋할지 CI에서만 만들지 — **커밋 권장.** A가 B의 Python 환경 없이 타입을 생성할 수 있어야 한다
- B의 endpoint가 붙기 전까지 A는 `/v1/demo/evidence-report` 타입으로 화면 골격을 만든다
