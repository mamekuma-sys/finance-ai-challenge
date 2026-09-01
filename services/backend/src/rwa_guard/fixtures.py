import hashlib
import re
from collections.abc import Sequence
from datetime import UTC, datetime

from rwa_guard.config import Settings
from rwa_guard.domain.contracts import (
    CodeFinding,
    CodeLocation,
    ControlField,
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
from rwa_guard.fixture_store import FixtureStore, fixture_store_for_settings
from rwa_guard.pipelines.report import build_evidence_report

DOCUMENT_FILE = "data/synthetic/documents/issuance-terms-01.txt"
TOKEN_FILE = "chain/src/fixtures/VulnerableRwaToken.sol"
ORACLE_FILE = "chain/src/fixtures/VulnerableOracle.sol"
ASSET_ID = "asset_synthetic_hanriver_01"
DOCUMENT_ID = "doc_synthetic_issuance_01"
CONTRACT_ID = "contract_demo_vulnerable_02"
SCAN_ID = "scan_demo_vulnerable_02"
REPORT_ID = "report_demo_02"
DERIVED_COMPILATION_UNIT_HASH = "derived:demo_contract_compilation_unit"


def _sha256(content: bytes) -> str:
    return f"sha256:{hashlib.sha256(content).hexdigest()}"


def _read(store: FixtureStore, relative: str) -> bytes:
    return store.read_bytes(relative)


def _control(
    *,
    constraint_id: str,
    field: str,
    value: str | int | float | bool,
    unit: str | None,
    quote: str,
    confirmed: bool,
    document_text: str,
) -> ControlSpec:
    start = document_text.index(quote)
    return ControlSpec(
        asset_id=ASSET_ID,
        document_id=DOCUMENT_ID,
        constraint_id=constraint_id,
        field=ControlField(field),
        value=value,
        unit=unit,
        evidence_span=EvidenceSpan(
            document_id=DOCUMENT_ID,
            page=1,
            start=start,
            end=start + len(quote),
            quote=quote,
        ),
        confirmed=confirmed,
    )


def _location(
    store: FixtureStore, relative: str, start_line: int, end_line: int
) -> CodeLocation:
    lines = _read(store, relative).decode().splitlines()
    return CodeLocation(
        file=relative,
        start_line=start_line,
        end_line=end_line,
        excerpt="\n".join(lines[start_line - 1 : end_line]),
    )


_SPDX_LINE = re.compile(r"^[ \t]*//[ \t]*SPDX-License-Identifier:.*$", re.MULTILINE)


def merge_solidity_sources(
    *sources: str, source_paths: Sequence[str] | None = None
) -> str:
    """여러 .sol 파일을 하나의 컴파일 단위로 합친다.

    파일마다 SPDX 헤더가 있으므로 그대로 이어붙이면 solc가 거부한다.

        Error (3716): Multiple SPDX license identifiers found in source file.

    SPDX 헤더는 모두 제거한 뒤 첫 헤더 하나만 컴파일 단위 앞에 복원한다.

    version pragma는 **지우지 않는다.** 중복 pragma는 solc가 허용하며, 지우면 뒤
    파일이 선언한 컴파일러 버전 제약이 조용히 사라져 호환되지 않는 소스가 통과한다.

    데모 부트스트랩이 저장하는 소스와 그 소스의 hash를 같은 바이트에서 뽑기 위해
    라우터가 아니라 여기에 둔다.
    """

    if source_paths is not None and len(source_paths) != len(sources):
        raise ValueError("source_paths must match the number of Solidity sources")
    license_header = next(
        (
            match.group(0).strip()
            for source in sources
            if (match := _SPDX_LINE.search(source)) is not None
        ),
        None,
    )
    scrubbed = [_SPDX_LINE.sub("", source).strip() for source in sources]
    if not any(scrubbed):
        return ""
    labels = tuple(source_paths) if source_paths is not None else tuple(
        f"input[{index}]" for index in range(len(sources))
    )
    parts = [
        *(header for header in (license_header,) if header is not None),
        "// RWA Guard derived compilation unit; not a canonical source file.",
    ]
    parts.extend(
        f"// BEGIN SOURCE: {label}\n{body}\n// END SOURCE: {label}"
        for label, body in zip(labels, scrubbed, strict=True)
        if body
    )
    return "\n\n".join(parts) + "\n"


def build_demo_contract_source(store: FixtureStore) -> str:
    """Build the explicitly derived Solidity compilation unit used by rescans."""

    return merge_solidity_sources(
        store.read_text(TOKEN_FILE),
        store.read_text(ORACLE_FILE),
        source_paths=(TOKEN_FILE, ORACLE_FILE),
    )


def build_demo_report(store: FixtureStore | None = None) -> EvidenceReport:
    active_store = store or fixture_store_for_settings(Settings(app_env="development"))
    document_bytes = _read(active_store, DOCUMENT_FILE)
    document_text = document_bytes.decode()
    token_bytes = _read(active_store, TOKEN_FILE)
    oracle_bytes = _read(active_store, ORACLE_FILE)
    contract_source_bytes = build_demo_contract_source(active_store).encode()
    token_hash = _sha256(token_bytes)
    oracle_hash = _sha256(oracle_bytes)

    controls = [
        _control(
            constraint_id="control_max_supply",
            field="max_supply",
            value=100_000,
            unit="TOKEN",
            quote="총 발행량은 100,000 토큰을 초과할 수 없다.",
            confirmed=True,
            document_text=document_text,
        ),
        _control(
            constraint_id="control_issuer_role",
            field="issuer_role",
            value="ISSUER_ROLE",
            unit=None,
            quote="ISSUER_ROLE을 가진 주소만 토큰을 발행할 수 있다.",
            confirmed=True,
            document_text=document_text,
        ),
        _control(
            constraint_id="control_collateral_verified",
            field="collateral_verified",
            value=True,
            unit=None,
            quote="기초자산 확인 상태가 collateralVerified=true로 확정된 이후에만 발행한다.",
            confirmed=True,
            document_text=document_text,
        ),
        _control(
            constraint_id="control_oracle_max_age",
            field="oracle_max_age",
            value=60,
            unit="MINUTE",
            quote="가격은 60분 이내에 갱신되어야 한다.",
            confirmed=True,
            document_text=document_text,
        ),
        _control(
            constraint_id="control_price_band_breach",
            field="price_band_breach",
            value=2,
            unit="CONSECUTIVE",
            quote="모델 기반 기준가 밴드 이탈이 연속 2회 확인되면 담당자 검토 경보를 생성한다.",
            confirmed=True,
            document_text=document_text,
        ),
        _control(
            constraint_id="control_pauser_role",
            field="pauser_role",
            value="PAUSER_ROLE",
            unit=None,
            quote="PAUSER_ROLE을 가진 주소만 발행과 이전을 일시정지하거나 재개할 수 있다.",
            confirmed=True,
            document_text=document_text,
        ),
    ]
    access_finding = CodeFinding(
        scan_id=SCAN_ID,
        finding_id="finding_mint_access_control_missing",
        rule_id="MINT_ACCESS_CONTROL_MISSING",
        severity=Severity.CRITICAL,
        status=FindingStatus.CONFIRMED,
        title="mint 실행경로에 접근권한 검사가 없습니다.",
        source_hash=token_hash,
        code_location=_location(active_store, TOKEN_FILE, 12, 12),
        deterministic_evidence=[
            "analysis=solc_ast_control_flow",
            "entrypoint=VulnerableRwaToken.mint",
            "guard.authorization=missing",
        ],
        tool_versions={"rwa_guard_contract": "1.0.0", "rule": "1.0.0", "solc": "0.8.24"},
    )
    mint_finding = CodeFinding(
        scan_id=SCAN_ID,
        finding_id="finding_mint_collateral_cap_missing",
        rule_id="MINT_COLLATERAL_CAP_MISSING",
        severity=Severity.CRITICAL,
        status=FindingStatus.CONFIRMED,
        title="mint 실행경로에 담보 또는 발행한도 검사가 없습니다.",
        source_hash=token_hash,
        code_location=_location(active_store, TOKEN_FILE, 12, 12),
        deterministic_evidence=[
            "analysis=solc_ast_control_flow",
            "entrypoint=VulnerableRwaToken.mint",
            "guard.collateral_guard=missing",
            "guard.cap_guard=missing",
        ],
        tool_versions={"rwa_guard_contract": "1.0.0", "rule": "1.0.0", "solc": "0.8.24"},
    )
    oracle_finding = CodeFinding(
        scan_id=SCAN_ID,
        finding_id="finding_oracle_range_missing",
        rule_id="ORACLE_VALIDATION_MISSING",
        severity=Severity.HIGH,
        status=FindingStatus.CONFIRMED,
        title="오라클 응답의 값 범위 검증이 없습니다.",
        source_hash=oracle_hash,
        code_location=_location(active_store, ORACLE_FILE, 13, 14),
        deterministic_evidence=[
            "analysis=solc_ast_control_flow",
            "entrypoint=VulnerableOracle.update",
            "guard.range_guard=missing",
        ],
        tool_versions={"rwa_guard_contract": "1.0.0", "rule": "1.0.0", "solc": "0.8.24"},
    )
    tx_hash = "0x" + "1".zfill(64)
    event = OnchainEvidence(
        asset_id=ASSET_ID,
        mode=EvidenceMode.REPLAY,
        chain_id=1001,
        tx_hash=tx_hash,
        log_index=0,
        block_number=18_402_119,
        event_name="Minted",
        previous_value="100000",
        changed_value="120000",
        fixture_version=active_store.version,
    )

    def mismatch(
        mismatch_id: str,
        control: ControlSpec,
        finding: CodeFinding,
        status: ImplementationStatus,
        severity: Severity,
        *,
        chain: bool = False,
    ) -> MismatchFinding:
        links = [
            EvidenceLink(kind=EvidenceKind.DOCUMENT, ref=control.constraint_id),
            EvidenceLink(kind=EvidenceKind.CODE, ref=finding.finding_id),
        ]
        if chain:
            links.append(EvidenceLink(kind=EvidenceKind.CHAIN, ref=f"{tx_hash}:0"))
        return MismatchFinding(
            mismatch_id=mismatch_id,
            constraint_id=control.constraint_id,
            finding_id=finding.finding_id,
            implementation_status=status,
            severity=severity,
            evidence_links=links,
        )

    findings = [access_finding, mint_finding, oracle_finding]
    scan = ScanRun(
        scan_id=SCAN_ID,
        asset_id=ASSET_ID,
        status=ScanStatus.COMPLETED,
        input_hashes={
            "document": _sha256(document_bytes),
            DERIVED_COMPILATION_UNIT_HASH: _sha256(contract_source_bytes),
            f"source:{TOKEN_FILE}": token_hash,
            f"source:{ORACLE_FILE}": oracle_hash,
        },
        rule_versions={
            "MINT_ACCESS_CONTROL_MISSING": "1.0.0",
            "MINT_COLLATERAL_CAP_MISSING": "1.0.0",
            "ORACLE_VALIDATION_MISSING": "1.0.0",
        },
        started_at=datetime(2026, 8, 25, 3, 0, tzinfo=UTC),
        completed_at=datetime(2026, 8, 25, 3, 0, 8, tzinfo=UTC),
    )
    return build_evidence_report(
        report_id=REPORT_ID,
        scan_run=scan,
        controls=controls,
        findings=findings,
        mismatches=[
            mismatch(
                "mismatch_max_supply_01",
                controls[0],
                mint_finding,
                ImplementationStatus.MISSING,
                Severity.CRITICAL,
                chain=True,
            ),
            mismatch(
                "mismatch_collateral_01",
                controls[2],
                mint_finding,
                ImplementationStatus.MISSING,
                Severity.CRITICAL,
            ),
            mismatch(
                "mismatch_issuer_role_01",
                controls[1],
                access_finding,
                ImplementationStatus.MISSING,
                Severity.CRITICAL,
            ),
            mismatch(
                "mismatch_oracle_max_age_01",
                controls[3],
                oracle_finding,
                ImplementationStatus.MISSING,
                Severity.HIGH,
            ),
        ],
        onchain_evidence=[event],
        tool_versions={"fixture_builder": "1.1.0"},
        model_versions={},
        limitations=[
            "합성 fixture 전용",
            "계약 source는 두 canonical fixture에서 파생한 컴파일 단위입니다.",
            "온체인 이벤트는 REPLAY이며 실제 receipt가 아닙니다.",
        ],
        document_extractor="deterministic-synthetic-parser@1.0.0",
        generated_at=scan.completed_at,
    )
