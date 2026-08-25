import type { DemoFinding } from "@/types/contracts";

export const demoFinding: DemoFinding = {
  assetName: "Han River Office 01",
  assetId: "asset_synthetic_hanriver_01",
  title: "발행 한도와 담보 확인이 mint 실행경로에 없습니다.",
  severity: "CRITICAL",
  status: "CONFIRMED",
  risk: 84,
  mode: "REPLAY",
  ruleVersion: "mint-controls/0.1.0",
  documentQuote: "총 발행량은 100,000 토큰을 초과할 수 없으며, 담보 확인 이후에만 발행한다.",
  documentLocator: "synthetic-issuance-terms.pdf · p.4 · span 128–181",
  codeExcerpt: "function mint(address to, uint256 amount) external {\n  _mint(to, amount);\n}",
  codeLocator: "VulnerableRwaToken.sol:23–25",
  spine: [
    { kind: "SPEC", title: "최대 발행량 100,000", locator: "문서 p.4" },
    { kind: "CODE", title: "cap·collateral 검사 없음", locator: "Token.sol:23" },
    { kind: "CHAIN", title: "공급량 120,000", locator: "replay block #18,402,119" },
    { kind: "ALERT", title: "발행 통제 위반", locator: "CRITICAL · MINT_CAP_MISSING" },
  ],
};
