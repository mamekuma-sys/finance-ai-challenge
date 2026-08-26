/**
 * 팀 계약 타입의 단일 진입점.
 *
 * 계약 타입(Severity, FindingStatus, EvidenceMode, ControlSpec ...)은 손으로 쓰지 않는다.
 * Pydantic → OpenAPI → `src/types/api.ts` 로 생성된 것만 재수출한다.
 * 갱신: `npm run gen:api` (사전에 backend `scripts/export_openapi.py` 실행)
 *
 * 화면 전용 view model만 이 파일에서 직접 정의한다.
 */
import type { components } from "@/types/api";

type Schemas = components["schemas"];

// --- 생성된 계약 타입 재수출 ---
export type EvidenceMode = Schemas["EvidenceMode"];
export type FindingStatus = Schemas["FindingStatus"];
export type Severity = Schemas["Severity"];
export type ImplementationStatus = Schemas["ImplementationStatus"];
export type ScanStatus = Schemas["ScanStatus"];

export type ControlSpec = Schemas["ControlSpec"];
export type CodeFinding = Schemas["CodeFinding"];
export type MismatchFinding = Schemas["MismatchFinding"];
export type OnchainEvidence = Schemas["OnchainEvidence"];
export type ScanRun = Schemas["ScanRun"];
export type EvidenceReport = Schemas["EvidenceReport"];

// --- 화면 전용 view model (API 계약 아님) ---
export interface SpineNode {
  kind: "SPEC" | "CODE" | "CHAIN" | "ALERT";
  title: string;
  locator: string;
}
