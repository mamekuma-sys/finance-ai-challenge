/**
 * 화면이 쓰는 타입의 단일 진입점.
 *
 * 계약 타입은 손으로 쓰지 않는다. Pydantic → OpenAPI → `generated/api.ts`로
 * 생성된 것만 재수출한다. 갱신은 `npm run gen:api`.
 *
 * 화면 전용 view model만 이 파일에서 직접 정의한다.
 */
import type { components } from "./generated/api";

type Schemas = components["schemas"];

// ── 생성된 계약 타입 재수출 ──
export type EvidenceMode = Schemas["EvidenceMode"];
export type FindingStatus = Schemas["FindingStatus"];
export type Severity = Schemas["Severity"];
export type ImplementationStatus = Schemas["ImplementationStatus"];
export type ScanStatus = Schemas["ScanStatus"];

export type AssetSummary = Schemas["AssetSummary"];
export type AlertSummary = Schemas["AlertSummary"];
export type CodeFinding = Schemas["CodeFinding"];
export type CodeLocation = Schemas["CodeLocation"];
export type ControlSpec = Schemas["ControlSpec"];
export type EvidenceLink = Schemas["EvidenceLink"];
export type EvidenceReport = Schemas["EvidenceReport"];
export type EvidenceSpan = Schemas["EvidenceSpan"];
export type ExploitRisk = Schemas["ExploitRisk"];
export type FailedStage = Schemas["FailedStage"];
export type FindingDiff = Schemas["FindingDiff"];
export type LatestScanRef = Schemas["LatestScanRef"];
export type MismatchFinding = Schemas["MismatchFinding"];
export type OnchainEvidence = Schemas["OnchainEvidence"];
export type RiskContributor = Schemas["RiskContributor"];
export type RiskGrade = Schemas["RiskGrade"];
export type ScanRun = Schemas["ScanRun"];
