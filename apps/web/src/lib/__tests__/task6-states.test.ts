import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/adapters/errors";
import { errorPresentation, safeErrorMessage } from "@/lib/error-presentation";
import { isPollingStatus, scanProgress } from "@/lib/polling-state";
import { allowDevelopmentState } from "@/lib/screen-state";
import { summaryOf } from "@/lib/stage-report";
import type { EvidenceReport } from "@/types/ui";

describe("Task6 route state helpers", () => {
  it("allows state staging only in development", () => {
    expect(allowDevelopmentState("partial", "development")).toBe("partial");
    expect(allowDevelopmentState("partial", "production")).toBeUndefined();
  });

  it.each([
    ["QUEUED", true],
    ["RUNNING", true],
    ["PARTIAL", false],
    ["FAILED", false],
    ["COMPLETED", false],
  ] as const)("polls %s only while non-terminal", (status, expected) => {
    expect(isPollingStatus(status)).toBe(expected);
  });

  it("reports progress, failed rules, and tool versions without measured claims", () => {
    expect(scanProgress({
      status: "PARTIAL",
      failed_stages: [{ stage: "contract_analysis", rule_id: "RULE_A", reason: "timeout" }],
      rule_versions: { RULE_B: "1.2.0" },
    })).toEqual({
      label: "부분 완료",
      failedRules: ["RULE_A"],
      toolVersions: ["RULE_B 1.2.0"],
    });
  });

  it("does not disguise absent chain evidence as REPLAY", () => {
    const report = {
      report_id: "report",
      scan_run: { asset_id: "asset" },
      controls: [],
      code_findings: [],
      mismatches: [],
      onchain_evidence: [],
    } as unknown as EvidenceReport;
    expect(summaryOf(report).mode).toBeNull();
  });

  it("never exposes arbitrary exception messages", () => {
    expect(safeErrorMessage(new Error("C:\\internal\\secret.py"), "작업 실패"))
      .toBe("작업 실패");
    expect(safeErrorMessage(new AppError("network", null), "작업 실패"))
      .toBe(errorPresentation("network").detail);
  });
});

describe("Task6 safe error copy", () => {
  it.each([
    ["not_found", "홈으로"],
    ["conflict", "새로고침"],
    ["unauthorized", "잠금 해제"],
    ["validation", "입력 확인"],
    ["server", "다시 시도"],
    ["network", "다시 시도"],
  ] as const)("distinguishes %s and provides one action", (kind, action) => {
    const result = errorPresentation(kind);
    expect(result.actionLabel).toBe(action);
    expect(result.detail).not.toMatch(/stack|C:\\|\/Users\//i);
  });
});
