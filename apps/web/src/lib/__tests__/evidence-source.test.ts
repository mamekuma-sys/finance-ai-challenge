import { describe, expect, it } from "vitest";

import { sourceOfControl, sourceOfFinding } from "../evidence-source";
import type { CodeFinding, ControlSpec } from "@/types/ui";

const control = (confirmed: boolean): ControlSpec =>
  ({ constraint_id: "c", field: "max_supply", confirmed }) as ControlSpec;

const finding = (status: CodeFinding["status"]): CodeFinding =>
  ({ finding_id: "f", rule_id: "R", status }) as CodeFinding;

describe("sourceOfControl — 문서에서 뽑은 값의 출처", () => {
  it("is machine analysis until a person signs it off", () => {
    expect(sourceOfControl(control(false))).toEqual({
      kind: "ANALYSIS",
      label: "의미 분석",
      needsReview: true,
    });
  });

  it("becomes a human confirmation once the reviewer confirms it", () => {
    expect(sourceOfControl(control(true))).toEqual({
      kind: "REVIEWED",
      label: "담당자 확정",
      needsReview: false,
    });
  });

  it("never calls a document extraction a deterministic result", () => {
    for (const confirmed of [true, false]) {
      expect(sourceOfControl(control(confirmed)).kind).not.toBe("DETERMINISTIC");
    }
  });
});

describe("sourceOfFinding — 코드 판정의 출처", () => {
  it("labels a confirmed finding as rule-backed", () => {
    expect(sourceOfFinding(finding("CONFIRMED"))).toEqual({
      kind: "DETERMINISTIC",
      label: "AST 룰 확정",
      needsReview: false,
    });
  });

  it("keeps a probable finding out of the confirmed bucket", () => {
    const source = sourceOfFinding(finding("PROBABLE"));

    expect(source.kind).not.toBe("DETERMINISTIC");
    expect(source.needsReview).toBe(true);
  });

  it("marks a review-needed finding for a person", () => {
    expect(sourceOfFinding(finding("NEEDS_REVIEW"))).toEqual({
      kind: "ANALYSIS",
      label: "의미 분석",
      needsReview: true,
    });
  });

  it("says outright when nothing could be judged", () => {
    expect(sourceOfFinding(finding("UNKNOWN"))).toEqual({
      kind: "UNJUDGED",
      label: "판단 불가",
      needsReview: true,
    });
  });
});
