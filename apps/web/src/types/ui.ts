import type { components } from "./generated/api";

export type EvidenceMode = components["schemas"]["EvidenceMode"];
export type FindingStatus = components["schemas"]["FindingStatus"];
export type Severity = components["schemas"]["Severity"];

export interface SpineNode {
  kind: "SPEC" | "CODE" | "CHAIN" | "ALERT";
  title: string;
  locator: string;
}

export interface DemoFinding {
  assetName: string;
  assetId: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  risk: number;
  mode: EvidenceMode;
  ruleVersion: string;
  documentQuote: string;
  documentLocator: string;
  codeExcerpt: string;
  codeLocator: string;
  spine: SpineNode[];
}
