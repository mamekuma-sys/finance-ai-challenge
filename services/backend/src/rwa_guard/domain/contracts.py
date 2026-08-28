import hashlib
import json
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_serializer, model_validator


class EvidenceMode(StrEnum):
    LIVE = "LIVE"
    REPLAY = "REPLAY"


class ActorType(StrEnum):
    SYSTEM = "SYSTEM"
    OPERATOR = "OPERATOR"
    INSECURE_DEMO = "INSECURE_DEMO"


class FindingStatus(StrEnum):
    CONFIRMED = "CONFIRMED"
    PROBABLE = "PROBABLE"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    UNKNOWN = "UNKNOWN"


class Severity(StrEnum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class ImplementationStatus(StrEnum):
    IMPLEMENTED = "IMPLEMENTED"
    PARTIAL = "PARTIAL"
    MISSING = "MISSING"
    UNKNOWN = "UNKNOWN"


class ScanStatus(StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class AssetStatus(StrEnum):
    UNVERIFIED = "UNVERIFIED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    VERIFIED = "VERIFIED"


class DocumentStatus(StrEnum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class ContractSourceKind(StrEnum):
    SOURCE = "SOURCE"
    ADDRESS = "ADDRESS"
    SOURCE_AND_ADDRESS = "SOURCE_AND_ADDRESS"


class AlertStatus(StrEnum):
    NEW = "NEW"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    FALSE_POSITIVE = "FALSE_POSITIVE"


class ReportStatus(StrEnum):
    QUEUED = "QUEUED"
    READY = "READY"
    FAILED = "FAILED"


class ReportFormat(StrEnum):
    HTML = "html"
    JSON = "json"


class DataFreshness(StrEnum):
    """Derived from the current clock, so it never belongs on immutable evidence."""

    FRESH = "FRESH"
    AGING = "AGING"
    STALE = "STALE"
    INVALID = "INVALID"


class EvidenceKind(StrEnum):
    DOCUMENT = "DOCUMENT"
    CODE = "CODE"
    CHAIN = "CHAIN"


class DiffChange(StrEnum):
    RESOLVED = "RESOLVED"
    REMAINS = "REMAINS"
    NEW = "NEW"


class EvidenceSpan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str
    page: int = Field(ge=1)
    start: int = Field(
        ge=0,
        description="Zero-based Unicode character offset within extracted page text.",
    )
    end: int = Field(
        gt=0,
        description="Exclusive Unicode character offset within extracted page text.",
    )
    quote: str = Field(min_length=1)


class ControlSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: str
    document_id: str
    constraint_id: str
    field: str
    value: str | int | float | bool
    unit: str | None = None
    evidence_span: EvidenceSpan
    confirmed: bool = False
    version: int = Field(default=1, ge=1)
    is_synthetic: Literal[True] = True


class CodeLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file: str
    start_line: int = Field(ge=1)
    end_line: int = Field(ge=1)
    excerpt: str


class CodeFinding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scan_id: str
    finding_id: str
    rule_id: str
    severity: Severity
    status: FindingStatus
    title: str
    source_hash: str
    code_location: CodeLocation
    deterministic_evidence: list[str] = Field(default_factory=list)
    tool_versions: dict[str, str] = Field(default_factory=dict)
    is_synthetic: Literal[True] = True


class OnchainEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: str
    mode: EvidenceMode
    chain_id: int
    tx_hash: str = Field(pattern=r"^0x[0-9a-fA-F]{64}$")
    log_index: int = Field(ge=0)
    block_number: int = Field(ge=0)
    block_hash: str | None = Field(default=None, pattern=r"^0x[0-9a-fA-F]{64}$")
    receipt_status: Literal["SUCCESS"] | None = None
    verified_at: datetime | None = None
    event_name: str
    previous_value: str | None = None
    changed_value: str | None = None
    fixture_version: str | None = None
    is_synthetic: Literal[True] = True

    @model_validator(mode="after")
    def require_live_receipt(self) -> "OnchainEvidence":
        if self.mode is EvidenceMode.LIVE and (
            self.chain_id != 1001
            or self.receipt_status != "SUCCESS"
            or self.block_hash is None
            or self.verified_at is None
        ):
            raise ValueError("LIVE evidence requires a verified successful receipt")
        return self


class EvidenceLink(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: EvidenceKind
    ref: str = Field(min_length=1)


class MismatchFinding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mismatch_id: str
    constraint_id: str
    finding_id: str
    implementation_status: ImplementationStatus
    severity: Severity
    evidence_links: list[EvidenceLink] = Field(
        min_length=2,
        json_schema_extra={
            "allOf": [
                {
                    "contains": {
                        "properties": {"kind": {"const": "DOCUMENT"}},
                        "required": ["kind"],
                    }
                },
                {
                    "contains": {
                        "properties": {"kind": {"const": "CODE"}},
                        "required": ["kind"],
                    }
                },
            ]
        },
    )
    is_synthetic: Literal[True] = True

    @model_validator(mode="after")
    def require_document_and_code_evidence(self) -> "MismatchFinding":
        kinds = {link.kind for link in self.evidence_links}
        missing = {EvidenceKind.DOCUMENT, EvidenceKind.CODE} - kinds
        if missing:
            names = ", ".join(sorted(kind.value for kind in missing))
            raise ValueError(f"MismatchFinding requires evidence of kind: {names}")
        return self


class FailedStage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage: str = Field(min_length=1)
    rule_id: str | None = None
    reason: str = Field(min_length=1)


class ScanRun(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "allOf": [
                {
                    "if": {
                        "properties": {"status": {"const": "PARTIAL"}},
                        "required": ["status"],
                    },
                    "then": {"properties": {"failed_stages": {"minItems": 1}}},
                }
            ]
        },
    )

    scan_id: str
    asset_id: str
    status: ScanStatus
    input_hashes: dict[str, str]
    rule_versions: dict[str, str]
    failed_stages: list[FailedStage] = Field(default_factory=list)
    started_at: datetime
    completed_at: datetime | None = None
    is_synthetic: Literal[True] = True

    @model_validator(mode="after")
    def partial_requires_failed_stages(self) -> "ScanRun":
        if self.status is ScanStatus.PARTIAL and not self.failed_stages:
            raise ValueError("ScanRun with status PARTIAL must list at least one failed stage")
        return self


class LatestScanRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scan_id: str
    status: ScanStatus
    completed_at: datetime | None = None


class AssetSummary(BaseModel):
    """Ledger row for the console home. The server aggregates so the list never ships findings.

    Optional fields are null before an asset has been scanned; the console renders its empty
    state from that instead of showing a zero score.
    """

    model_config = ConfigDict(extra="forbid")

    asset_id: str
    name: str
    highest_severity: Severity | None = None
    critical_count: int = Field(default=0, ge=0)
    high_count: int = Field(default=0, ge=0)
    latest_scan: LatestScanRef | None = None
    evidence_mode: EvidenceMode | None = None
    fixture_version: str | None = None
    freshness: DataFreshness | None = None
    is_synthetic: Literal[True] = True


class FindingDiff(BaseModel):
    """Server-computed rescan comparison. Rule versions may differ between the two runs, so the
    consumer cannot derive this by diffing two finding lists.
    """

    model_config = ConfigDict(extra="forbid")

    finding_id: str
    rule_id: str
    change: DiffChange
    base_scan_id: str
    head_scan_id: str
    severity: Severity
    base_rule_version: str | None
    head_rule_version: str | None
    is_synthetic: Literal[True] = True

    @property
    def status(self) -> DiffChange:
        """Compatibility alias for Task 1 contract-pipeline callers."""

        return self.change


class ReportLineage(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    input_hashes: dict[str, str]
    document_extractor: str
    ai_model: str | None = None
    model_versions: dict[str, str] = Field(default_factory=dict)
    rule_versions: dict[str, str]
    tool_versions: dict[str, str]
    generated_at: datetime
    limitations: tuple[str, ...]

    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)


class EvidenceReport(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    report_id: str
    report_hash: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    scan_run: ScanRun
    controls: tuple[ControlSpec, ...]
    code_findings: tuple[CodeFinding, ...]
    mismatches: tuple[MismatchFinding, ...]
    onchain_evidence: tuple[OnchainEvidence, ...]
    lineage: ReportLineage
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    is_synthetic: Literal[True] = True

    @model_validator(mode="after")
    def report_hash_matches_snapshot(self) -> "EvidenceReport":
        self.verify_hash()
        return self

    @model_serializer(mode="wrap")
    def serialize_verified(self, handler: Any) -> Any:
        self.verify_hash()
        return handler(self)

    def verify_hash(self) -> None:
        canonical = json.dumps(
            self.snapshot_payload(),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        expected = f"sha256:{hashlib.sha256(canonical).hexdigest()}"
        if self.report_hash != expected:
            raise ValueError("report hash does not match immutable snapshot")

    def snapshot_payload(self) -> dict[str, Any]:
        return {
            "report_id": self.report_id,
            "scan_run": self.scan_run.model_dump(mode="json"),
            "controls": [item.model_dump(mode="json") for item in self.controls],
            "code_findings": [
                item.model_dump(mode="json") for item in self.code_findings
            ],
            "mismatches": [item.model_dump(mode="json") for item in self.mismatches],
            "onchain_evidence": [
                item.model_dump(mode="json") for item in self.onchain_evidence
            ],
            "lineage": self.lineage.model_dump(mode="json"),
            "generated_at": self.generated_at.isoformat().replace("+00:00", "Z"),
            "is_synthetic": self.is_synthetic,
        }


class SyntheticContract(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_synthetic: Literal[True] = True


class CreateAssetRequest(SyntheticContract):
    name: str = Field(min_length=1)
    asset_type: Literal["SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE"]
    underlying_description: str = Field(min_length=1)
    total_planned_supply: int = Field(gt=0)
    network: Literal["KAIA_KAIROS"]
    currency: str = Field(min_length=1)
    token_unit: str = Field(min_length=1)


class CreateAssetResponse(SyntheticContract):
    asset_id: str
    status: AssetStatus
    document_id: str | None = None
    created_at: datetime


class DocumentResponse(SyntheticContract):
    document_id: str
    asset_id: str
    status: DocumentStatus
    file_hash: str
    version: str
    media_type: str
    size_bytes: int = Field(ge=0)
    page_count: int | None = Field(default=None, ge=1)
    failed_pages: list[int] = Field(default_factory=list)
    controls: list[ControlSpec] = Field(default_factory=list)
    uploaded_at: datetime
    processed_at: datetime | None = None
    error_code: str | None = None


class DocumentContentResponse(SyntheticContract):
    document_id: str
    media_type: Literal["application/pdf", "text/plain"]
    text: str | None = None
    content_base64: str | None = None

    @model_validator(mode="after")
    def require_matching_content(self) -> "DocumentContentResponse":
        if self.media_type == "text/plain" and self.text is None:
            raise ValueError("TXT content requires text")
        if self.media_type == "application/pdf" and self.content_base64 is None:
            raise ValueError("PDF content requires base64 data")
        return self


class PolicyPatch(SyntheticContract):
    constraint_id: str
    field: str
    value: str | int | float | bool
    unit: str | None = None
    evidence_span: EvidenceSpan | None = None
    page: int | None = Field(default=None, ge=1)
    quote: str | None = Field(default=None, min_length=1)
    confirmed: bool
    expected_version: int = Field(ge=0)

    @model_validator(mode="after")
    def require_existing_or_manual_evidence(self) -> "PolicyPatch":
        if self.evidence_span is None and (self.page is None or self.quote is None):
            raise ValueError("manual policy requires page and exact quote")
        return self


class PolicyPatchRequest(SyntheticContract):
    document_id: str
    policies: list[PolicyPatch] = Field(min_length=1)


class ContractCreateRequest(SyntheticContract):
    address: str | None = Field(default=None, pattern=r"^0x[0-9a-fA-F]{40}$")
    source_code: str | None = Field(default=None, min_length=1, max_length=200_000)
    chain_id: Literal[1001] = 1001

    @model_validator(mode="after")
    def require_address_or_source(self) -> "ContractCreateRequest":
        if self.address is None and self.source_code is None:
            raise ValueError("Contract input requires an address or Solidity source")
        return self


class ContractCreateResponse(SyntheticContract):
    contract_id: str
    asset_id: str
    source_kind: ContractSourceKind
    chain_id: int
    address: str | None = None
    source_hash: str
    proxy_status: str
    created_at: datetime


class ScanCreateRequest(SyntheticContract):
    contract_id: str
    base_scan_id: str | None = None


class ScanCreateResponse(SyntheticContract):
    scan_id: str
    asset_id: str
    status: ScanStatus
    created_at: datetime


class ScanResultResponse(SyntheticContract):
    scan_run: ScanRun
    code_findings: list[CodeFinding] = Field(default_factory=list)
    mismatches: list[MismatchFinding] = Field(default_factory=list)
    onchain_evidence: list[OnchainEvidence] = Field(default_factory=list)
    diff: list[FindingDiff] = Field(default_factory=list)
    report_id: str | None = None


class AlertSummary(SyntheticContract):
    alert_id: str
    asset_id: str
    asset_name: str
    alert_type: str
    severity: Severity
    status: AlertStatus
    memo: str | None = None
    cause: dict[str, Any]
    evidence_links: list[EvidenceLink]
    evidence_mode: EvidenceMode
    fixture_version: str | None = None
    created_at: datetime
    updated_at: datetime


class AlertPatchRequest(SyntheticContract):
    status: AlertStatus | None = None
    memo: str | None = Field(
        default=None,
        max_length=2000,
        validation_alias=AliasChoices("memo", "note"),
    )
    expected_updated_at: datetime

    @model_validator(mode="after")
    def require_change(self) -> "AlertPatchRequest":
        if self.status is None and self.memo is None:
            raise ValueError("alert patch requires status or memo")
        return self


class DashboardResponse(SyntheticContract):
    total_assets: int = Field(ge=0)
    critical_assets: int = Field(ge=0)
    high_assets: int = Field(ge=0)
    assets: list[AssetSummary]
    recent_alerts: list[AlertSummary]


class DemoBootstrapResponse(SyntheticContract):
    asset_id: str
    document_id: str
    contract_id: str
    scan_id: str
    report_id: str
    evidence_mode: Literal[EvidenceMode.REPLAY] = EvidenceMode.REPLAY
    fixture_version: str


class AssetDetail(SyntheticContract):
    asset_id: str
    name: str
    asset_type: Literal["SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE"]
    status: AssetStatus
    underlying_description: str
    total_planned_supply: int = Field(gt=0)
    network: Literal["KAIA_KAIROS"]
    currency: str
    token_unit: str
    documents: list[DocumentResponse] = Field(default_factory=list)
    contracts: list[ContractCreateResponse] = Field(default_factory=list)
    scans: list[ScanRun] = Field(default_factory=list)
    created_at: datetime


class ReportDownloadMetadata(SyntheticContract):
    format: ReportFormat
    media_type: str
    url: str
    sha256: str


class ReportResponse(SyntheticContract):
    report_id: str
    scan_id: str
    status: ReportStatus
    report: EvidenceReport | None = None
    downloads: list[ReportDownloadMetadata] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    error_code: str | None = None
    human_review_required: Literal[True] = True
    generated_at: datetime | None = None
