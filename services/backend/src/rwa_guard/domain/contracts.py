import hashlib
import json
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
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


class RiskGrade(StrEnum):
    """PRD FR-06의 등급 경계. 점수에서 결정론적으로 파생되며 별도 판단이 들어가지 않는다."""

    LOW = "LOW"
    GUARDED = "GUARDED"
    ELEVATED = "ELEVATED"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ControlField(StrEnum):
    """FR-02에서 동결한 P0 통제조건 6개."""

    MAX_SUPPLY = "max_supply"
    ISSUER_ROLE = "issuer_role"
    COLLATERAL_VERIFIED = "collateral_verified"
    ORACLE_MAX_AGE = "oracle_max_age"
    PRICE_BAND_BREACH = "price_band_breach"
    PAUSER_ROLE = "pauser_role"


P0_CONTROL_FIELDS = frozenset(field.value for field in ControlField)


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
    field: ControlField
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


SEVERITY_WEIGHTS: dict[Severity, int] = {
    Severity.CRITICAL: 40,
    Severity.HIGH: 25,
    Severity.MEDIUM: 10,
    Severity.LOW: 3,
    Severity.INFO: 0,
}
FINDING_STATUS_CONFIDENCE: dict[FindingStatus, float] = {
    FindingStatus.CONFIRMED: 1.0,
    FindingStatus.PROBABLE: 0.75,
    FindingStatus.NEEDS_REVIEW: 0.0,
    FindingStatus.UNKNOWN: 0.0,
}
CONFIRMED_CRITICAL_FLOOR = 80
EXPLOIT_RISK_RULE_ID = "EXPLOIT_RISK_SCORE"
EXPLOIT_RISK_RULE_VERSION = "1.0.0"
RISK_GRADE_BOUNDS: tuple[tuple[int, RiskGrade], ...] = (
    (19, RiskGrade.LOW),
    (39, RiskGrade.GUARDED),
    (59, RiskGrade.ELEVATED),
    (79, RiskGrade.HIGH),
    (100, RiskGrade.CRITICAL),
)


def grade_for_score(score: int) -> RiskGrade:
    """PRD FR-06의 등급 경계를 그대로 적용한다."""

    if not 0 <= score <= 100:
        raise ValueError("exploit risk score must be between 0 and 100")
    for upper, grade in RISK_GRADE_BOUNDS:
        if score <= upper:
            return grade
    raise AssertionError("unreachable")


class RiskContributor(BaseModel):
    """점수에 기여한 개별 발견사항. FR-06은 상위 기여 항목을 점수 옆에 표시하라고 요구한다."""

    model_config = ConfigDict(extra="forbid")

    finding_id: str
    rule_id: str
    severity: Severity
    status: FindingStatus
    weight: int = Field(ge=0, le=40)
    confidence: float = Field(ge=0.0, le=1.0)
    contribution: float = Field(ge=0.0)


class ExploitRisk(BaseModel):
    """FR-06 Exploit Risk. 0~100이며 높을수록 위험하다. Security Score와 혼용하지 않는다.

    점수 계산은 컨트랙트 보안 트랙(C)이 수행하고 이 모델은 결과와 산정 근거를 노출한다.
    등급은 점수에서 파생되며, 확정 Critical이 있으면 최소 80점이라는 FR-06 규칙을
    validator가 강제한다.
    """

    model_config = ConfigDict(extra="forbid")

    scan_id: str
    score: int = Field(ge=0, le=100)
    grade: RiskGrade
    contributors: list[RiskContributor] = Field(default_factory=list)
    has_confirmed_critical: bool = False
    floor_applied: bool = False
    rule_versions: dict[str, str] = Field(default_factory=dict)
    calculated_at: datetime
    is_synthetic: Literal[True] = True

    @model_validator(mode="after")
    def grade_follows_score(self) -> "ExploitRisk":
        expected = grade_for_score(self.score)
        if self.grade is not expected:
            raise ValueError(f"grade {self.grade} does not match score {self.score} ({expected})")
        return self

    @model_validator(mode="after")
    def confirmed_critical_never_averages_below_the_floor(self) -> "ExploitRisk":
        """FR-06: 확정 Critical을 다른 낮은 위험으로 평균내어 80점 미만으로 낮추지 않는다."""

        if self.has_confirmed_critical and self.score < CONFIRMED_CRITICAL_FLOOR:
            raise ValueError(
                f"a confirmed Critical finding requires a score of at least "
                f"{CONFIRMED_CRITICAL_FLOOR}, got {self.score}"
            )
        return self

    @model_validator(mode="after")
    def calculation_matches_contributors(self) -> "ExploitRisk":
        for contributor in self.contributors:
            expected_weight = SEVERITY_WEIGHTS[contributor.severity]
            if contributor.weight != expected_weight:
                raise ValueError("contributor weight does not match severity")
            expected_confidence = FINDING_STATUS_CONFIDENCE[contributor.status]
            if contributor.confidence != expected_confidence:
                raise ValueError("contributor confidence does not match finding status")
            expected_contribution = contributor.weight * contributor.confidence
            if abs(contributor.contribution - expected_contribution) > 1e-9:
                raise ValueError("contributor contribution does not match weight × confidence")

        expected_critical = any(
            contributor.severity is Severity.CRITICAL
            and contributor.status is FindingStatus.CONFIRMED
            for contributor in self.contributors
        )
        if self.has_confirmed_critical is not expected_critical:
            raise ValueError("has_confirmed_critical does not match contributors")

        raw = sum(
            (Decimal(str(item.contribution)) for item in self.contributors),
            start=Decimal(0),
        )
        rounded = int(raw.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        expected_floor = expected_critical and rounded < CONFIRMED_CRITICAL_FLOOR
        expected_score = min(
            100,
            max(rounded, CONFIRMED_CRITICAL_FLOOR if expected_critical else rounded),
        )
        if self.floor_applied is not expected_floor:
            raise ValueError("floor_applied does not match the FR-06 calculation")
        if self.score != expected_score:
            raise ValueError("score does not match contributor calculation")
        if self.rule_versions.get(EXPLOIT_RISK_RULE_ID) != EXPLOIT_RISK_RULE_VERSION:
            raise ValueError("exploit risk calculation rule version is missing or invalid")
        if any(
            not self.rule_versions.get(contributor.rule_id, "").strip()
            for contributor in self.contributors
        ):
            raise ValueError("contributor rule version is missing")
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
    exploit_risk: ExploitRisk | None = None
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
    exploit_risk: ExploitRisk | None = None
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
        payload = {
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
        # 0.1.0 READY snapshots predate FR-06. Omitting a missing score keeps their
        # immutable hash verifiable; every newly built report supplies this field.
        if self.exploit_risk is not None:
            payload["exploit_risk"] = self.exploit_risk.model_dump(mode="json")
        return payload


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
    field: ControlField
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
    exploit_risk: ExploitRisk | None = None
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
