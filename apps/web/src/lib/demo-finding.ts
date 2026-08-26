import type { components } from "@/types/generated/api";
import type { DemoFinding } from "@/types/ui";

export const demoScanRun = {
  scan_id: "scan_demo_vulnerable_01",
  asset_id: "asset_synthetic_hanriver_01",
  status: "COMPLETED",
  input_hashes: {
    document: "sha256:synthetic-document",
    source: "sha256:synthetic-vulnerable-source",
  },
  rule_versions: { MINT_COLLATERAL_CAP_MISSING: "1.0.0" },
  failed_stages: [],
  started_at: "2026-08-25T03:00:00Z",
  completed_at: "2026-08-25T03:00:08Z",
  is_synthetic: true,
} satisfies components["schemas"]["ScanRun"];

export const demoCodeFinding = {
  scan_id: demoScanRun.scan_id,
  finding_id: "finding_mint_collateral_cap_missing",
  rule_id: "MINT_COLLATERAL_CAP_MISSING",
  severity: "CRITICAL",
  status: "CONFIRMED",
  title: "발행 한도와 담보 확인이 mint 실행경로에 없습니다.",
  source_hash: demoScanRun.input_hashes.source,
  code_location: {
    file: "chain/src/fixtures/VulnerableRwaToken.sol",
    start_line: 12,
    end_line: 12,
    excerpt: "        totalSupply += amount;",
  },
  deterministic_evidence: [
    "analysis=solc_ast_control_flow",
    "entrypoint=VulnerableRwaToken.mint",
    "guard.collateral_guard=missing",
    "guard.cap_guard=missing",
  ],
  tool_versions: {
    rwa_guard_contract: "1.0.0",
    rule: "1.0.0",
    solc: "0.8.24+commit.e11b9ed9",
  },
  is_synthetic: true,
} satisfies components["schemas"]["CodeFinding"];

export const demoMismatchFinding = {
  mismatch_id: "mismatch_max_supply_01",
  constraint_id: "control_max_supply",
  finding_id: demoCodeFinding.finding_id,
  implementation_status: "MISSING",
  severity: "CRITICAL",
  evidence_links: [
    { kind: "DOCUMENT", ref: "control_max_supply" },
    { kind: "CODE", ref: demoCodeFinding.finding_id },
  ],
  is_synthetic: true,
} satisfies components["schemas"]["MismatchFinding"];

export const demoFinding: DemoFinding = {
  assetName: "Han River Office 01",
  assetId: "asset_synthetic_hanriver_01",
  title: demoCodeFinding.title,
  severity: demoCodeFinding.severity,
  status: demoCodeFinding.status,
  risk: 84,
  mode: "REPLAY",
  ruleVersion: "MINT_COLLATERAL_CAP_MISSING/1.0.0",
  documentQuote: "총 발행량은 100,000 토큰을 초과할 수 없으며, 담보 확인 이후에만 발행한다.",
  documentLocator: "synthetic-issuance-terms.pdf · p.4 · span 128–181",
  codeExcerpt: demoCodeFinding.code_location.excerpt.trim(),
  codeLocator: `${demoCodeFinding.code_location.file.split("/").at(-1)}:${demoCodeFinding.code_location.start_line}`,
  spine: [
    { kind: "SPEC", title: "최대 발행량 100,000", locator: "문서 p.4" },
    { kind: "CODE", title: "cap·collateral 검사 없음", locator: "VulnerableRwaToken.sol:12" },
    { kind: "CHAIN", title: "공급량 120,000", locator: "replay block #18,402,119" },
    {
      kind: "ALERT",
      title: "발행 통제 위반",
      locator: "CRITICAL · MINT_COLLATERAL_CAP_MISSING",
    },
  ],
};
