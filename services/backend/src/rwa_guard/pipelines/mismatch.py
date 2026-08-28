from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Final

from rwa_guard.domain.contracts import (
    CodeFinding,
    ControlSpec,
    EvidenceKind,
    EvidenceLink,
    FindingStatus,
    ImplementationStatus,
    MismatchFinding,
    Severity,
)

FIELD_RULE_MAP: Final[dict[str, str]] = {
    "max_supply": "MINT_COLLATERAL_CAP_MISSING",
    "collateral_verified": "MINT_COLLATERAL_CAP_MISSING",
    "issuer_role": "MINT_ACCESS_CONTROL_MISSING",
    "oracle_max_age": "ORACLE_VALIDATION_MISSING",
}


@dataclass(frozen=True)
class MismatchAssembly:
    mismatches: tuple[MismatchFinding, ...]
    unresolved_constraint_ids: tuple[str, ...]

    @property
    def confirmed_critical_high_count(self) -> int:
        return sum(
            mismatch.implementation_status is ImplementationStatus.MISSING
            and mismatch.severity in {Severity.CRITICAL, Severity.HIGH}
            for mismatch in self.mismatches
        )


def assemble_mismatches(
    controls: list[ControlSpec] | tuple[ControlSpec, ...],
    findings: list[CodeFinding] | tuple[CodeFinding, ...],
) -> MismatchAssembly:
    by_rule: dict[str, list[CodeFinding]] = {}
    for finding in findings:
        by_rule.setdefault(finding.rule_id, []).append(finding)
    for candidates in by_rule.values():
        candidates.sort(
            key=lambda item: (
                0 if item.status is FindingStatus.CONFIRMED else 1,
                item.finding_id,
            )
        )

    mismatches: list[MismatchFinding] = []
    unresolved: list[str] = []
    matched_pairs: set[tuple[str, str]] = set()

    def append_mismatch(control: ControlSpec, finding: CodeFinding) -> None:
        pair = (control.constraint_id, finding.finding_id)
        if pair in matched_pairs:
            return
        matched_pairs.add(pair)
        confirmed = finding.status is FindingStatus.CONFIRMED
        identity = f"{control.constraint_id}|{finding.finding_id}"
        mismatches.append(
            MismatchFinding(
                mismatch_id=f"mismatch_{hashlib.sha256(identity.encode()).hexdigest()[:20]}",
                constraint_id=control.constraint_id,
                finding_id=finding.finding_id,
                implementation_status=(
                    ImplementationStatus.MISSING if confirmed else ImplementationStatus.UNKNOWN
                ),
                severity=finding.severity if confirmed else Severity.INFO,
                evidence_links=[
                    EvidenceLink(kind=EvidenceKind.DOCUMENT, ref=control.constraint_id),
                    EvidenceLink(kind=EvidenceKind.CODE, ref=finding.finding_id),
                ],
            )
        )

    for control in controls:
        rule_id = FIELD_RULE_MAP.get(control.field)
        candidates = by_rule.get(rule_id or "", [])
        if not control.confirmed or rule_id is None or not candidates:
            unresolved.append(control.constraint_id)
            continue
        append_mismatch(control, candidates[0])

    # Policy: retain one baseline mismatch per confirmed ControlSpec, then attach each
    # remaining confirmed Critical/High finding to the lexicographically first matching
    # control. This covers every deterministic finding without a control×finding product.
    controls_by_rule: dict[str, list[ControlSpec]] = {}
    for control in controls:
        rule_id = FIELD_RULE_MAP.get(control.field)
        if control.confirmed and rule_id is not None:
            controls_by_rule.setdefault(rule_id, []).append(control)
    linked_finding_ids = {finding_id for _, finding_id in matched_pairs}
    for finding in sorted(findings, key=lambda item: (item.rule_id, item.finding_id)):
        if (
            finding.finding_id in linked_finding_ids
            or finding.status is not FindingStatus.CONFIRMED
            or finding.severity not in {Severity.CRITICAL, Severity.HIGH}
        ):
            continue
        matching_controls = sorted(
            controls_by_rule.get(finding.rule_id, []),
            key=lambda item: item.constraint_id,
        )
        if matching_controls:
            append_mismatch(matching_controls[0], finding)
            linked_finding_ids.add(finding.finding_id)
    return MismatchAssembly(
        mismatches=tuple(mismatches),
        unresolved_constraint_ids=tuple(sorted(unresolved)),
    )
