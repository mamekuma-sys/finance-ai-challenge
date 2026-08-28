import { describe, expect, it } from "vitest";

import { coverageOf } from "../control-coverage";
import type { EvidenceReport } from "@/types/ui";

function report(
  controls: string[],
  mismatches: Array<[string, "IMPLEMENTED" | "PARTIAL" | "MISSING" | "UNKNOWN"]>,
): EvidenceReport {
  return {
    controls: controls.map((id) => ({ constraint_id: id })),
    mismatches: mismatches.map(([id, status], index) => ({
      mismatch_id: `m${index}`,
      constraint_id: id,
      implementation_status: status,
    })),
  } as unknown as EvidenceReport;
}

describe("coverageOf — 통제조건 구현 집계", () => {
  it("counts every extracted control, judged or not", () => {
    const result = coverageOf(report(["a", "b", "c"], [["a", "IMPLEMENTED"]]));
    expect(result.total).toBe(3);
  });

  it("buckets each control by how the code implements it", () => {
    const result = coverageOf(
      report(
        ["a", "b", "c", "d"],
        [
          ["a", "IMPLEMENTED"],
          ["b", "PARTIAL"],
          ["c", "MISSING"],
          ["d", "UNKNOWN"],
        ],
      ),
    );

    expect(result).toMatchObject({
      implemented: 1,
      partial: 1,
      missing: 1,
      unjudged: 1,
      total: 4,
    });
  });

  it("treats a control with no mismatch row as not yet checked", () => {
    // 검사 대상이 아니었던 조건을 구현됨으로 세면 커버리지가 부풀려진다.
    const result = coverageOf(report(["a", "b"], [["a", "IMPLEMENTED"]]));

    expect(result.implemented).toBe(1);
    expect(result.unjudged).toBe(1);
  });

  it("counts one finding that breaks two controls as two gaps", () => {
    // MINT_COLLATERAL_CAP_MISSING 하나가 최대발행량과 담보확인을 함께 깬다.
    const result = coverageOf(
      report(
        ["max_supply", "collateral", "issuer_role"],
        [
          ["max_supply", "MISSING"],
          ["collateral", "MISSING"],
          ["issuer_role", "IMPLEMENTED"],
        ],
      ),
    );

    expect(result.missing).toBe(2);
  });

  it("counts anything short of full implementation as a mismatch", () => {
    const result = coverageOf(
      report(
        ["a", "b", "c"],
        [
          ["a", "IMPLEMENTED"],
          ["b", "PARTIAL"],
          ["c", "MISSING"],
        ],
      ),
    );

    expect(result.mismatched).toBe(2);
  });

  it("returns an empty coverage rather than dividing by nothing", () => {
    expect(coverageOf(report([], []))).toMatchObject({ total: 0, mismatched: 0 });
  });
});
