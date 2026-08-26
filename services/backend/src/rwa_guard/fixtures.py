from datetime import UTC, datetime

from rwa_guard.domain.contracts import (
    CodeFinding,
    CodeLocation,
    ControlSpec,
    EvidenceKind,
    EvidenceLink,
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
        finding_id="finding_mint_collateral_cap_missing",
        rule_id="MINT_COLLATERAL_CAP_MISSING",
        severity=Severity.CRITICAL,
        status=FindingStatus.CONFIRMED,
        title="mint 실행경로에 담보 또는 발행한도 검사가 없습니다.",
        source_hash="sha256:synthetic-vulnerable-source",
        code_location=CodeLocation(
            file="chain/src/fixtures/VulnerableRwaToken.sol",
            start_line=12,
            end_line=12,
            excerpt="        totalSupply += amount;",
        ),
        deterministic_evidence=[
            "analysis=solc_ast_control_flow",
            "entrypoint=VulnerableRwaToken.mint",
            "guard.collateral_guard=missing",
            "guard.cap_guard=missing",
        ],
        tool_versions={
            "rwa_guard_contract": "1.0.0",
            "rule": "1.0.0",
            "solc": "0.8.24+commit.e11b9ed9",
        },
    )
    mismatch = MismatchFinding(
        mismatch_id="mismatch_max_supply_01",
        constraint_id=control.constraint_id,
        finding_id=finding.finding_id,
        implementation_status=ImplementationStatus.MISSING,
        severity=Severity.CRITICAL,
        evidence_links=[
            EvidenceLink(kind=EvidenceKind.DOCUMENT, ref=control.constraint_id),
            EvidenceLink(kind=EvidenceKind.CODE, ref=finding.finding_id),
        ],
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
        rule_versions={"MINT_COLLATERAL_CAP_MISSING": "1.0.0"},
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
            "document": "doc_synthetic_issuance_01#p4:128-181",
            "code": "chain/src/fixtures/VulnerableRwaToken.sol:12",
            "chain": "REPLAY:0.1.0:block-18402119",
        },
    )
