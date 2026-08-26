from collections.abc import Mapping

from rwa_guard.domain.contracts import FindingStatus
from rwa_guard.pipelines.contract import (
    CompilationError,
    CompiledSources,
    FoundryCompiler,
    analyze_compiled_sources,
    analyze_contract_sources,
)


class FailingCompiler:
    def compile(self, sources: Mapping[str, str]) -> CompiledSources:
        raise CompilationError(f"synthetic compile failure for {len(sources)} source")


def test_text_and_comments_cannot_create_confirmed_findings() -> None:
    sources = {
        "CommentOnly.sol": """
            // MINT_ACCESS_CONTROL_MISSING onlyIssuer maxSupply collateralVerified
            pragma solidity ^0.8.24;
            contract CommentOnly { function ping() external pure returns (bool) { return true; } }
        """
    }

    compiled = FoundryCompiler().compile(sources)
    findings = analyze_compiled_sources(
        scan_id="scan_comment_only", compiled=compiled, target_contract="CommentOnly"
    )

    assert findings == ()


def test_compiler_ast_confirms_unguarded_supply_mutation() -> None:
    sources = {
        "Vulnerable.sol": """
            pragma solidity ^0.8.24;
            contract Vulnerable {
                uint256 public totalSupply;
                function mint(uint256 amount) external { totalSupply += amount; }
            }
        """
    }

    compiled = FoundryCompiler().compile(sources)
    findings = analyze_compiled_sources(
        scan_id="scan_vulnerable", compiled=compiled, target_contract="Vulnerable"
    )

    assert {finding.rule_id for finding in findings} == {
        "MINT_ACCESS_CONTROL_MISSING",
        "MINT_COLLATERAL_CAP_MISSING",
    }
    assert all(finding.status is FindingStatus.CONFIRMED for finding in findings)
    assert all(finding.code_location.start_line == 5 for finding in findings)


def test_compile_failure_is_unknown_and_never_confirmed() -> None:
    findings = analyze_contract_sources(
        scan_id="scan_compile_failure",
        sources={"Broken.sol": "pragma solidity ^0.8.24; contract Broken {"},
        compiler=FailingCompiler(),
    )

    assert len(findings) == 3
    assert all(finding.status is FindingStatus.UNKNOWN for finding in findings)
    assert all(finding.code_location.file == "Broken.sol" for finding in findings)
