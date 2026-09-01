from __future__ import annotations

from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal

from rwa_guard.domain.contracts import (
    CONFIRMED_CRITICAL_FLOOR,
    EXPLOIT_RISK_RULE_ID,
    EXPLOIT_RISK_RULE_VERSION,
    FINDING_STATUS_CONFIDENCE,
    SEVERITY_WEIGHTS,
    CodeFinding,
    ExploitRisk,
    FindingStatus,
    RiskContributor,
    Severity,
    grade_for_score,
)


def calculate_exploit_risk(
    *,
    scan_id: str,
    findings: list[CodeFinding] | tuple[CodeFinding, ...],
    calculated_at: datetime | None = None,
    scan_rule_versions: dict[str, str] | None = None,
) -> ExploitRisk:
    """Calculate the versioned FR-06 score from persisted finding facts."""

    versions = scan_rule_versions or {}
    contributors: list[RiskContributor] = []
    for finding in findings:
        confidence = FINDING_STATUS_CONFIDENCE[finding.status]
        weight = SEVERITY_WEIGHTS[finding.severity]
        contribution = weight * confidence
        if contribution <= 0:
            continue
        contributors.append(
            RiskContributor(
                finding_id=finding.finding_id,
                rule_id=finding.rule_id,
                severity=finding.severity,
                status=finding.status,
                weight=weight,
                confidence=confidence,
                contribution=contribution,
            )
        )

    contributors.sort(
        key=lambda item: (-item.contribution, item.rule_id, item.finding_id)
    )
    raw = sum(
        (Decimal(str(item.contribution)) for item in contributors),
        start=Decimal(0),
    )
    rounded = int(raw.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    has_confirmed_critical = any(
        item.severity is Severity.CRITICAL and item.status is FindingStatus.CONFIRMED
        for item in contributors
    )
    floor_applied = has_confirmed_critical and rounded < CONFIRMED_CRITICAL_FLOOR
    score = min(
        100,
        max(rounded, CONFIRMED_CRITICAL_FLOOR if has_confirmed_critical else rounded),
    )
    contributor_versions = {
        item.rule_id: (
            next(
                (
                    finding.tool_versions.get("rule")
                    for finding in findings
                    if finding.finding_id == item.finding_id
                ),
                None,
            )
            or versions.get(item.rule_id)
            or "unknown"
        )
        for item in contributors
    }
    return ExploitRisk(
        scan_id=scan_id,
        score=score,
        grade=grade_for_score(score),
        contributors=contributors,
        has_confirmed_critical=has_confirmed_critical,
        floor_applied=floor_applied,
        rule_versions={
            EXPLOIT_RISK_RULE_ID: EXPLOIT_RISK_RULE_VERSION,
            **contributor_versions,
        },
        calculated_at=calculated_at or datetime.now(UTC),
    )
