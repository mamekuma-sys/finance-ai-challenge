from dataclasses import dataclass


@dataclass(frozen=True)
class RuleCandidate:
    rule_id: str
    matched: bool
    evidence: tuple[str, ...]


def screen_mint_controls(source: str) -> tuple[RuleCandidate, ...]:
    """Scaffold-only deterministic screening for the three P0 control families.

    This is intentionally conservative and must be replaced by AST/Slither-backed rules before
    it can emit production CONFIRMED findings.
    """

    compact = "".join(source.split()).lower()
    has_mint = "functionmint(" in compact
    return (
        RuleCandidate(
            rule_id="MINT_ACCESS_CONTROL_CANDIDATE",
            matched=has_mint and not any(token in compact for token in ("onlyissuer", "onlyrole")),
            evidence=("text pre-screen only",),
        ),
        RuleCandidate(
            rule_id="MINT_CAP_CANDIDATE",
            matched=has_mint and "maxsupply" not in compact,
            evidence=("text pre-screen only",),
        ),
        RuleCandidate(
            rule_id="COLLATERAL_GATE_CANDIDATE",
            matched=has_mint and "collateralverified" not in compact,
            evidence=("text pre-screen only",),
        ),
    )
