import { describe, expect, it } from "vitest";

import { toSpineNodes } from "../evidence-report";
import type { EvidenceReport } from "@/types/contracts";

const REPORT = {
  report_id: "report_demo_01",
  scan_run: {
    scan_id: "scan_demo_vulnerable_01",
    asset_id: "asset_synthetic_hanriver_01",
    status: "COMPLETED",
    input_hashes: { document: "sha256:doc" },
    rule_versions: { "mint-controls": "0.1.0" },
    started_at: "2026-08-25T03:00:00Z",
    completed_at: "2026-08-25T03:00:08Z",
    is_synthetic: true,
  },
  controls: [
    {
      asset_id: "asset_synthetic_hanriver_01",
      document_id: "doc_synthetic_issuance_01",
      constraint_id: "control_max_supply",
      field: "max_supply",
      value: 100000,
      unit: "TOKEN",
      evidence_span: {
        document_id: "doc_synthetic_issuance_01",
        page: 4,
        start: 128,
        end: 181,
        quote: "총 발행량은 100,000 토큰을 초과할 수 없다.",
      },
      confirmed: true,
      is_synthetic: true,
    },
  ],
  code_findings: [
    {
      scan_id: "scan_demo_vulnerable_01",
      finding_id: "finding_mint_cap_missing",
      rule_id: "MINT_CAP_MISSING",
      severity: "CRITICAL",
      status: "CONFIRMED",
      title: "mint 실행경로에 발행 한도 검사가 없습니다.",
      source_hash: "sha256:src",
      code_location: {
        file: "fixtures/VulnerableRwaToken.sol",
        start_line: 23,
        end_line: 25,
        excerpt: "function mint(...)",
      },
      deterministic_evidence: ["External mint entrypoint"],
      tool_versions: { custom_rules: "0.1.0" },
      is_synthetic: true,
    },
  ],
  mismatches: [
    {
      mismatch_id: "mismatch_max_supply_01",
      constraint_id: "control_max_supply",
      finding_id: "finding_mint_cap_missing",
      implementation_status: "MISSING",
      severity: "CRITICAL",
      evidence_links: ["control_max_supply", "finding_mint_cap_missing"],
      is_synthetic: true,
    },
  ],
  onchain_evidence: [
    {
      asset_id: "asset_synthetic_hanriver_01",
      mode: "REPLAY",
      chain_id: 1001,
      tx_hash: "0xsynthetic0001",
      log_index: 0,
      block_number: 18402119,
      event_name: "Minted",
      previous_value: "100000",
      changed_value: "120000",
      fixture_version: "0.1.0",
      is_synthetic: true,
    },
  ],
  lineage: {},
  generated_at: "2026-08-25T03:00:10Z",
  is_synthetic: true,
} as unknown as EvidenceReport;

describe("toSpineNodes", () => {
  it("links document, code, chain and alert in that reading order", () => {
    const nodes = toSpineNodes(REPORT, "mismatch_max_supply_01");

    expect(nodes.map((node) => node.kind)).toEqual(["SPEC", "CODE", "CHAIN", "ALERT"]);
  });

  it("carries the document page into the SPEC locator", () => {
    const [spec] = toSpineNodes(REPORT, "mismatch_max_supply_01");

    expect(spec.title).toContain("max_supply");
    expect(spec.locator).toContain("p.4");
  });

  it("carries file and line into the CODE locator so the code view can anchor", () => {
    const [, code] = toSpineNodes(REPORT, "mismatch_max_supply_01");

    expect(code.locator).toBe("fixtures/VulnerableRwaToken.sol:23–25");
  });

  it("shows the on-chain value change and never hides that it is replayed", () => {
    const [, , chain] = toSpineNodes(REPORT, "mismatch_max_supply_01");

    expect(chain.title).toContain("120,000");
    expect(chain.locator).toContain("REPLAY");
  });

  it("names the rule and severity in the ALERT node", () => {
    const [, , , alert] = toSpineNodes(REPORT, "mismatch_max_supply_01");

    expect(alert.locator).toContain("CRITICAL");
    expect(alert.locator).toContain("MINT_CAP_MISSING");
  });

  it("returns nothing for a mismatch id that is not in the report", () => {
    expect(toSpineNodes(REPORT, "mismatch_missing")).toEqual([]);
  });

  it("omits the CHAIN node when the report carries no on-chain evidence", () => {
    const withoutChain = { ...REPORT, onchain_evidence: [] } as EvidenceReport;

    expect(toSpineNodes(withoutChain, "mismatch_max_supply_01").map((n) => n.kind)).toEqual([
      "SPEC",
      "CODE",
      "ALERT",
    ]);
  });
});
