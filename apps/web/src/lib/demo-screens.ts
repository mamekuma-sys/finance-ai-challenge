/**
 * 스켈레톤 단계의 데모 상수.
 *
 * backend endpoint가 붙기 전까지 화면 구조를 세우는 데 쓰는 고정값이다.
 * 실제 값은 OnchainEvidence와 CodeFinding에서 온다.
 */
import type { EvidenceMode } from "@/types/contracts";

export const DEMO_FIXTURE_VERSION = "replay-fixture/0.1.0";

export const DEMO_MODE: EvidenceMode = "REPLAY";

export const DEMO_BLOCK_NUMBER = 18_402_119;

export const DEMO_CODE = {
  file: "VulnerableRwaToken.sol",
  startLine: 21,
  highlight: { start: 22, end: 24 },
  source: `contract VulnerableRwaToken {
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}`,
};
