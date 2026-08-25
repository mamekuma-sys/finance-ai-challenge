export type EvidenceMode = "LIVE" | "REPLAY";
export type FindingStatus = "CONFIRMED" | "PROBABLE" | "NEEDS_REVIEW" | "UNKNOWN";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

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
