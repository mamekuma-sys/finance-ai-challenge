from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


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


class MismatchFinding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mismatch_id: str
    constraint_id: str
    finding_id: str
    implementation_status: ImplementationStatus
    severity: Severity
    evidence_links: list[str] = Field(min_length=2)
    is_synthetic: bool = True


class ScanRun(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scan_id: str
    asset_id: str
    status: ScanStatus
    input_hashes: dict[str, str]
    rule_versions: dict[str, str]
    started_at: datetime
    completed_at: datetime | None = None
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
