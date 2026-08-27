from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EvidenceMode(StrEnum):
    LIVE = "LIVE"
    REPLAY = "REPLAY"


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


class JobType(StrEnum):
    DOCUMENT_EXTRACTION = "DOCUMENT_EXTRACTION"
    CONTRACT_SCAN = "CONTRACT_SCAN"


class JobStatus(StrEnum):
    """Execution state of a worker job.

    Deliberately mirrors ScanStatus vocabulary but is a separate contract: a job is one
    execution attempt, a ScanRun is the domain result the user and the report read.
    """

    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


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
    start: int = Field(ge=0)
    end: int = Field(gt=0)
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
    is_synthetic: bool = True


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
    is_synthetic: bool = True


class OnchainEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: str
    mode: EvidenceMode
    chain_id: int
    tx_hash: str
    log_index: int = Field(ge=0)
    block_number: int = Field(ge=0)
    event_name: str
    previous_value: str | None = None
    changed_value: str | None = None
    fixture_version: str | None = None
    is_synthetic: bool = True


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
    is_synthetic: bool = True

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
    is_synthetic: bool = True

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
    freshness: DataFreshness | None = None
    is_synthetic: bool = True


class FindingDiff(BaseModel):
    """Server-computed rescan comparison. Rule versions may differ between the two runs, so the
    consumer cannot derive this by diffing two finding lists.
    """

    model_config = ConfigDict(extra="forbid")

    finding_id: str
    change: DiffChange
    base_scan_id: str
    head_scan_id: str
    severity: Severity
    is_synthetic: bool = True


class EvidenceReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    report_id: str
    scan_run: ScanRun
    controls: list[ControlSpec]
    code_findings: list[CodeFinding]
    mismatches: list[MismatchFinding]
    onchain_evidence: list[OnchainEvidence]
    lineage: dict[str, Any]
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    is_synthetic: bool = True
