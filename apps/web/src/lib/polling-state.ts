import type { ScanStatus } from "@/types/ui";

type ProgressInput = {
  status: ScanStatus;
  failed_stages?: { stage: string; rule_id?: string | null; reason: string }[];
  rule_versions?: Record<string, string>;
};

export function isPollingStatus(status: ScanStatus): boolean {
  return status === "QUEUED" || status === "RUNNING";
}

export function scanProgress(input: ProgressInput) {
  const labels: Record<ScanStatus, string> = {
    QUEUED: "검사 대기 중",
    RUNNING: "결정론적 룰 검사 중",
    PARTIAL: "부분 완료",
    FAILED: "검사 실패",
    COMPLETED: "검사 완료",
  };
  return {
    label: labels[input.status],
    failedRules: (input.failed_stages ?? []).map((item) => item.rule_id ?? item.stage),
    toolVersions: Object.entries(input.rule_versions ?? {}).map(
      ([tool, version]) => `${tool} ${version}`,
    ),
  };
}
