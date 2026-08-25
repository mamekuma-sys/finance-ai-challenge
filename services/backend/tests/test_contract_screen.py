from rwa_guard.pipelines.contract import screen_mint_controls


def test_vulnerable_mint_is_only_a_candidate_at_scaffold_stage() -> None:
    source = "function mint(address to, uint amount) external { _mint(to, amount); }"

    results = screen_mint_controls(source)

    assert all(result.matched for result in results)
    assert all(result.rule_id.endswith("_CANDIDATE") for result in results)
