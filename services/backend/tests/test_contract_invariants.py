"""P0 계약 불변식 — 스키마가 근거 없는 확정을 막는지 검증한다."""

import pytest
from pydantic import ValidationError

from rwa_guard.domain.contracts import (
    AssetSummary,
    DiffChange,
    EvidenceKind,
    EvidenceLink,
    FailedStage,
    FindingDiff,
    ImplementationStatus,
    MismatchFinding,
    ScanRun,
    ScanStatus,
    Severity,
)


def _links(*kinds: EvidenceKind) -> list[EvidenceLink]:
    return [EvidenceLink(kind=kind, ref=f"ref_{kind.value.lower()}") for kind in kinds]


def _mismatch(links: list[EvidenceLink]) -> MismatchFinding:
    return MismatchFinding(
        mismatch_id="mismatch_01",
        constraint_id="control_max_supply",
        finding_id="finding_mint_collateral_cap_missing",
        implementation_status=ImplementationStatus.MISSING,
        severity=Severity.CRITICAL,
        evidence_links=links,
    )


def test_mismatch_requires_document_and_code_evidence() -> None:
    """AGENTS 불변식 5: 모든 Critical/High는 문서와 코드 근거를 함께 가진다."""

    assert _mismatch(_links(EvidenceKind.DOCUMENT, EvidenceKind.CODE)).severity is Severity.CRITICAL


def test_mismatch_rejects_missing_code_evidence() -> None:
    with pytest.raises(ValidationError, match="CODE"):
        _mismatch(_links(EvidenceKind.DOCUMENT, EvidenceKind.CHAIN))


def test_mismatch_rejects_missing_document_evidence() -> None:
    with pytest.raises(ValidationError, match="DOCUMENT"):
        _mismatch(_links(EvidenceKind.CODE, EvidenceKind.CHAIN))


def _scan(status: ScanStatus, failed: list[FailedStage] | None = None) -> ScanRun:
    return ScanRun(
        scan_id="scan_01",
        asset_id="asset_01",
        status=status,
        input_hashes={"source": "sha256:x"},
        rule_versions={"MINT_COLLATERAL_CAP_MISSING": "1.0.0"},
        failed_stages=failed or [],
        started_at="2026-08-26T00:00:00Z",  # type: ignore[arg-type]
    )


def test_partial_scan_must_name_what_failed() -> None:
    """화면이 PARTIAL을 그리려면 무엇이 실패했는지 알아야 한다."""

    with pytest.raises(ValidationError, match="PARTIAL"):
        _scan(ScanStatus.PARTIAL)


def test_partial_scan_with_failed_stage_is_valid() -> None:
    scan = _scan(
        ScanStatus.PARTIAL,
        [
            FailedStage(
                stage="contract_analysis",
                rule_id="ORACLE_VALIDATION_MISSING",
                reason="toolchain timeout",
            )
        ],
    )

    assert scan.failed_stages[0].stage == "contract_analysis"


def test_completed_scan_needs_no_failed_stage() -> None:
    assert _scan(ScanStatus.COMPLETED).failed_stages == []


def test_asset_summary_is_empty_not_zero_before_first_scan() -> None:
    """검사 전 자산은 0점이 아니라 미산출이다."""

    summary = AssetSummary(asset_id="asset_01", name="Han River Office 01")

    assert summary.highest_severity is None
    assert summary.latest_scan is None
    assert summary.evidence_mode is None
    assert summary.freshness is None


def test_finding_diff_carries_both_scan_ids() -> None:
    diff = FindingDiff(
        finding_id="finding_mint_collateral_cap_missing",
        change=DiffChange.RESOLVED,
        base_scan_id="scan_vulnerable",
        head_scan_id="scan_fixed",
        severity=Severity.CRITICAL,
    )

    assert diff.change is DiffChange.RESOLVED
