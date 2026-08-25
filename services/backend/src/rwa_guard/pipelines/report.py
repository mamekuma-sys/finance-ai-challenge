from rwa_guard.domain.contracts import CodeFinding, ControlSpec, MismatchFinding


def validate_confirmed_evidence(
    controls: list[ControlSpec],
    findings: list[CodeFinding],
    mismatches: list[MismatchFinding],
) -> None:
    control_ids = {item.constraint_id for item in controls}
    finding_ids = {item.finding_id for item in findings}
    for mismatch in mismatches:
        if mismatch.constraint_id not in control_ids:
            raise ValueError(f"Unknown control evidence: {mismatch.constraint_id}")
        if mismatch.finding_id not in finding_ids:
            raise ValueError(f"Unknown code evidence: {mismatch.finding_id}")
