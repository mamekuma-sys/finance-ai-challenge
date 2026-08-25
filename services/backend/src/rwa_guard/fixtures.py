from datetime import UTC, datetime

from rwa_guard.domain.contracts import (
    CodeFinding,
    CodeLocation,
    ControlSpec,
    EvidenceMode,
    EvidenceReport,
    EvidenceSpan,
    FindingStatus,
    ImplementationStatus,
    MismatchFinding,
    OnchainEvidence,
    ScanRun,
    ScanStatus,
    Severity,
)


def build_demo_report() -> EvidenceReport:
    control = ControlSpec(
        asset_id="asset_synthetic_hanriver_01",
        document_id="doc_synthetic_issuance_01",
        constraint_id="control_max_supply",
        field="max_supply",
        value=100_000,
        unit="TOKEN",
        evidence_span=EvidenceSpan(
            document_id="doc_synthetic_issuance_01",
            page=4,
            start=128,
            end=181,
            quote="총 발행량은 100,000 토큰을 초과할 수 없다.",
        ),
        confirmed=True,
    )
    finding = CodeFinding(
        scan_id="scan_demo_vulnerable_01",
        finding_id="finding_mint_cap_missing",
        rule_id="MINT_CAP_MISSING",
        severity=Severity.CRITICAL,
        status=FindingStatus.CONFIRMED,
        title="mint 실행경로에 발행 한도 검사가 없습니다.",
        source_hash="sha256:synthetic-vulnerable-source",
        code_location=CodeLocation(
            file="fixtures/VulnerableRwaToken.sol",
            start_line=23,
            end_line=25,
            excerpt="function mint(address to, uint256 amount) external { _mint(to, amount); }",
        ),
        deterministic_evidence=["External mint entrypoint", "No maxSupply comparison"],
        tool_versions={"custom_rules": "0.1.0"},
    )
    mismatch = MismatchFinding(
        mismatch_id="mismatch_max_supply_01",
        constraint_id=control.constraint_id,
        finding_id=finding.finding_id,
        implementation_status=ImplementationStatus.MISSING,
        severity=Severity.CRITICAL,
        evidence_links=["control_max_supply", "finding_mint_cap_missing"],
    )
    event = OnchainEvidence(
        asset_id=control.asset_id,
        mode=EvidenceMode.REPLAY,
        chain_id=1001,
        tx_hash="0xsynthetic000000000000000000000000000000000000000000000000000001",
        log_index=0,
        block_number=18_402_119,
        event_name="Minted",
        previous_value="100000",
        changed_value="120000",
        fixture_version="0.1.0",
    )
    scan = ScanRun(
        scan_id=finding.scan_id,
        asset_id=control.asset_id,
        status=ScanStatus.COMPLETED,
        input_hashes={"document": "sha256:synthetic-document", "source": finding.source_hash},
        rule_versions={"mint-controls": "0.1.0"},
        started_at=datetime(2026, 8, 25, 3, 0, tzinfo=UTC),
        completed_at=datetime(2026, 8, 25, 3, 0, 8, tzinfo=UTC),
    )
    return EvidenceReport(
        report_id="report_demo_01",
        scan_run=scan,
        controls=[control],
        code_findings=[finding],
        mismatches=[mismatch],
        onchain_evidence=[event],
        lineage={
            "document": control.evidence_span.model_dump(),
            "code": finding.code_location.model_dump(),
            "chain": {"mode": event.mode, "tx_hash": event.tx_hash},
        },
    )
