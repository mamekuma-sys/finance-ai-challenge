import { describe, expect, it } from "vitest";

import {
  controlDraft,
  hasConfirmedP0Controls,
  manualControlValidity,
  policyPatch,
  P0_CONTROL_FIELDS,
  recoveryNextStep,
} from "@/lib/document-review-state";
import {
  implementationByConstraint,
  reportState,
  scanVerdict,
} from "@/lib/scan-view";
import type { CodeFinding, ControlSpec, MismatchFinding } from "@/types/ui";

const control = {
  asset_id: "asset_1",
  document_id: "doc_1",
  constraint_id: "control_1",
  field: "max_supply",
  value: 100_000,
  unit: "TOKEN",
  evidence_span: {
    document_id: "doc_1",
    page: 1,
    start: 10,
    end: 20,
    quote: "100,000",
  },
  confirmed: true,
  version: 1,
  is_synthetic: true,
} satisfies ControlSpec;

describe("document review state", () => {
  it("untouched control save preserves the server value and confirmation", () => {
    const draft = controlDraft(control, undefined);
    expect(policyPatch(control, draft)).toMatchObject({
      value: 100_000,
      confirmed: true,
      unit: "TOKEN",
    });
  });
});

describe("asset implementation state", () => {
  it("uses persisted mismatch status and leaves unscanned controls unchecked", () => {
    const mismatch = {
      mismatch_id: "mismatch_1",
      constraint_id: "control_1",
      finding_id: "finding_1",
      implementation_status: "MISSING",
      severity: "CRITICAL",
      evidence_links: [
        { kind: "DOCUMENT", ref: "control_1" },
        { kind: "CODE", ref: "finding_1" },
      ],
      is_synthetic: true as const,
    } satisfies MismatchFinding;
    expect(implementationByConstraint([mismatch]).get("control_1")).toBe("MISSING");
    expect(implementationByConstraint([]).get("control_1")).toBeUndefined();
  });
});

const confirmedControls = P0_CONTROL_FIELDS.map((field, index) => ({
    ...control,
    constraint_id: `control_${index}`,
    field,
    confirmed: true,
}));

describe("scan verdict gate", () => {
  const controls = confirmedControls;
  const base = {
    status: "COMPLETED" as const,
    controls,
    findings: [] as CodeFinding[],
    mismatches: [] as MismatchFinding[],
  };

  it("passes only a complete, confirmed, clean deterministic result", () => {
    expect(scanVerdict(base)).toBe("PASS");
    expect(scanVerdict({ ...base, controls: controls.map((item, index) => ({ ...item, confirmed: index > 0 })) })).toBe("CONTROL_REVIEW_REQUIRED");
  });

  it("separates review findings and unmapped confirmed findings", () => {
    const finding = {
      scan_id: "scan_1",
      finding_id: "finding_1",
      rule_id: "RULE",
      severity: "HIGH",
      status: "NEEDS_REVIEW",
      title: "review",
      source_hash: `sha256:${"a".repeat(64)}`,
      code_location: { file: "x.sol", start_line: 1, end_line: 1, excerpt: "x" },
      is_synthetic: true,
    } satisfies CodeFinding;
    expect(scanVerdict({ ...base, findings: [finding] })).toBe("FINDING_REVIEW_REQUIRED");
    expect(scanVerdict({ ...base, findings: [{ ...finding, status: "PROBABLE" }] })).toBe("PROBABLE_REVIEW_REQUIRED");
    expect(scanVerdict({ ...base, findings: [{ ...finding, status: "CONFIRMED" }] })).toBe("UNMAPPED_FINDING");
    expect(scanVerdict({
      ...base,
      findings: [{ ...finding, status: "CONFIRMED" }],
      mismatches: [{
        finding_id: finding.finding_id,
        implementation_status: "UNKNOWN",
      }],
    })).toBe("FINDING_REVIEW_REQUIRED");
    expect(scanVerdict({
      ...base,
      findings: [{ ...finding, status: "CONFIRMED", severity: "INFO" }],
      mismatches: [{
        finding_id: finding.finding_id,
        implementation_status: "IMPLEMENTED",
      }],
    })).toBe("CONFIRMED_RISK");
  });
});

describe("manual PDF and report states", () => {
  it("blocks confirmed manual evidence when the original source is unavailable", () => {
    expect(
      manualControlValidity({ value: "100", page: 2, quote: "수동 확인 문구" }, null),
    ).toBe(false);
    expect(
      manualControlValidity(
        { value: "100", page: 2, quote: "수동 확인 문구" },
        null,
        true,
      ),
    ).toBe(true);
  });

  it("does not describe FAILED reports as generating", () => {
    expect(reportState("FAILED")).toBe("FAILED");
    expect(reportState("QUEUED")).toBe("PROGRESS");
  });

  it("uses the same six-control gate for document and asset recovery", () => {
    expect(hasConfirmedP0Controls(confirmedControls)).toBe(true);
    expect(recoveryNextStep(false)).toBe("document");
    expect(recoveryNextStep(true)).toBe("scan");
  });
});
