import { describe, expect, it } from "vitest";

import { demoCodeFinding, demoMismatchFinding, demoScanRun } from "./demo-finding";

describe("generated API demo contract", () => {
  it("uses the final C-track rule and exact mutation evidence", () => {
    expect(demoCodeFinding.rule_id).toBe("MINT_COLLATERAL_CAP_MISSING");
    expect(demoCodeFinding.code_location).toMatchObject({
      file: "chain/src/fixtures/VulnerableRwaToken.sol",
      start_line: 12,
      end_line: 12,
      excerpt: "        totalSupply += amount;",
    });
    expect(demoScanRun.failed_stages).toEqual([]);
  });

  it("links both document and code evidence", () => {
    expect(demoMismatchFinding.evidence_links).toEqual([
      { kind: "DOCUMENT", ref: "control_max_supply" },
      { kind: "CODE", ref: demoCodeFinding.finding_id },
    ]);
  });
});
