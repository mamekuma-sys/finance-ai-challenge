import re
from dataclasses import dataclass
from datetime import UTC, datetime
from importlib import import_module
from pathlib import Path

import pytest
from sqlalchemy import JSON, BigInteger, Boolean, Text, create_engine, insert, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError, StatementError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.schema import CreateTable
from sqlalchemy.sql.schema import CheckConstraint

REPOSITORY = Path(__file__).resolve().parents[3]
MIGRATIONS = REPOSITORY / "infra" / "supabase" / "migrations"


@dataclass(frozen=True)
class ColumnContract:
    type_family: type
    nullable: bool
    foreign_key: str | None
    unique: bool
    server_default: str | None
    migration_pattern: str


COLUMN_CONTRACTS = {
    ("assets", "total_planned_supply"): ColumnContract(
        BigInteger,
        False,
        None,
        False,
        "1",
        r"total_planned_supply\s+bigint\s+not null\s+default\s+1",
    ),
    ("assets", "is_synthetic"): ColumnContract(
        Boolean,
        False,
        None,
        False,
        "true",
        r"is_synthetic\s+boolean\s+not null\s+default\s+true",
    ),
    ("issuance_documents", "asset_id"): ColumnContract(
        Text,
        False,
        "assets.id",
        False,
        None,
        r"asset_id\s+text\s+not null\s+references\s+assets\(id\)",
    ),
    ("issuance_documents", "status"): ColumnContract(
        Text,
        False,
        None,
        False,
        "'UPLOADED'",
        r"status\s+text\s+not null\s+default\s+'UPLOADED'",
    ),
    ("issuance_documents", "failed_pages"): ColumnContract(
        JSON,
        False,
        None,
        False,
        "'[]'",
        r"failed_pages\s+jsonb\s+not null\s+default\s+'\[\]'::jsonb",
    ),
    ("issuance_documents", "is_synthetic"): ColumnContract(
        Boolean,
        False,
        None,
        False,
        "true",
        r"is_synthetic\s+boolean\s+not null\s+default\s+true",
    ),
    ("contracts", "chain_id"): ColumnContract(
        BigInteger,
        True,
        None,
        False,
        None,
        r"chain_id\s+bigint\s*(?:,|$)",
    ),
    ("contracts", "source_kind"): ColumnContract(
        Text,
        False,
        None,
        False,
        "'ADDRESS'",
        r"source_kind\s+text\s+not null\s+default\s+'ADDRESS'",
    ),
    ("contracts", "is_synthetic"): ColumnContract(
        Boolean,
        False,
        None,
        False,
        "true",
        r"is_synthetic\s+boolean\s+not null\s+default\s+true",
    ),
    ("scan_runs", "contract_id"): ColumnContract(
        Text,
        True,
        "contracts.id",
        False,
        None,
        r"contract_id\s+text\s+references\s+contracts\(id\)",
    ),
    ("scan_runs", "failed_stages"): ColumnContract(
        JSON,
        False,
        None,
        False,
        "'[]'",
        r"failed_stages\s+jsonb\s+not null\s+default\s+'\[\]'::jsonb",
    ),
    ("scan_runs", "is_synthetic"): ColumnContract(
        Boolean,
        False,
        None,
        False,
        "true",
        r"is_synthetic\s+boolean\s+not null\s+default\s+true",
    ),
    ("reports", "scan_id"): ColumnContract(
        Text,
        False,
        "scan_runs.id",
        True,
        None,
        r"scan_id\s+text\s+not null\s+unique\s+references\s+scan_runs\(id\)",
    ),
    ("reports", "evidence"): ColumnContract(
        JSON,
        True,
        None,
        False,
        None,
        r"evidence\s+jsonb\s*(?:,|$)",
    ),
    ("reports", "downloads"): ColumnContract(
        JSON,
        False,
        None,
        False,
        "'{}'",
        r"downloads\s+jsonb\s+not null\s+default\s+'\{\}'::jsonb",
    ),
    ("reports", "is_synthetic"): ColumnContract(
        Boolean,
        False,
        None,
        False,
        "true",
        r"is_synthetic\s+boolean\s+not null\s+default\s+true",
    ),
}


def _db_modules():
    return (
        import_module("rwa_guard.db.base"),
        import_module("rwa_guard.db.models"),
        import_module("rwa_guard.db.repositories"),
    )


@pytest.fixture
def session_factory():
    base, _, _ = _db_modules()
    engine = create_engine("sqlite+pysqlite:///:memory:")
    base.Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _asset(models):
    return models.AssetRecord(
        id="asset_01",
        name="합성 한강 오피스 수익증권",
        asset_type="SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
        status="UNVERIFIED",
        underlying_description="서울 소재 합성 상업용 부동산",
        total_planned_supply=100_000,
        network="KAIA_KAIROS",
        currency="KRW",
        token_unit="TOKEN",
    )


def test_asset_and_document_repository_round_trip(session_factory) -> None:
    _, models, repositories = _db_modules()
    with session_factory() as session:
        assets = repositories.AssetRepository(session)
        documents = repositories.DocumentRepository(session)
        inserted_asset = assets.add(_asset(models))
        inserted_document = documents.add(
            models.IssuanceDocumentRecord(
                id="doc_01",
                asset_id="asset_01",
                file_hash="sha256:document",
                version="1",
                status="PARTIAL",
                media_type="application/pdf",
                size_bytes=2048,
                page_count=3,
                failed_pages=[2],
            )
        )
        session.commit()

    with session_factory() as read_session:
        stored_asset = repositories.AssetRepository(read_session).get("asset_01")
        stored_document = repositories.DocumentRepository(read_session).get("doc_01")

    assert stored_asset is not None
    assert stored_asset is not inserted_asset
    assert stored_asset.total_planned_supply == 100_000
    assert stored_document is not None
    assert stored_document is not inserted_document
    assert stored_document.failed_pages == [2]
    assert stored_document.is_synthetic is True


def test_latest_document_orders_by_uploaded_at_then_id(session_factory) -> None:
    _, models, repositories = _db_modules()
    uploaded_at = datetime(2026, 8, 28, tzinfo=UTC)
    with session_factory.begin() as session:
        repositories.AssetRepository(session).add(_asset(models))
        documents = repositories.DocumentRepository(session)
        for document_id in ("doc_a", "doc_z"):
            documents.add(
                models.IssuanceDocumentRecord(
                    id=document_id,
                    asset_id="asset_01",
                    file_hash=f"sha256:{document_id}",
                    version="1",
                    status="READY",
                    media_type="text/plain",
                    size_bytes=1,
                    page_count=1,
                    uploaded_at=uploaded_at,
                )
            )

    with session_factory() as session:
        latest = repositories.DocumentRepository(session).latest_by_asset("asset_01")

    assert latest is not None
    assert latest.id == "doc_z"


def test_contract_scan_and_report_repository_round_trip(session_factory) -> None:
    _, models, repositories = _db_modules()
    now = datetime(2026, 8, 28, tzinfo=UTC)
    with session_factory() as session:
        repositories.AssetRepository(session).add(_asset(models))
        inserted_contract = repositories.ContractRepository(session).add(
            models.ContractRecord(
                id="contract_01",
                asset_id="asset_01",
                chain_id=1001,
                source_kind="SOURCE",
                source_code="contract SyntheticRwa {}",
                source_hash="sha256:source",
                proxy_status="NOT_CHECKED",
            )
        )
        inserted_scan = repositories.ScanRepository(session).add(
            models.ScanRunRecord(
                id="scan_01",
                asset_id="asset_01",
                contract_id="contract_01",
                status="PARTIAL",
                input_hashes={"source": "sha256:source"},
                rule_versions={"ORACLE_VALIDATION_MISSING": "1.0.0"},
                failed_stages=[
                    {
                        "stage": "contract_analysis",
                        "rule_id": "ORACLE_VALIDATION_MISSING",
                        "reason": "tool timeout",
                    }
                ],
                started_at=now,
            )
        )
        inserted_report = repositories.ReportRepository(session).add(
            models.ReportRecord(
                id="report_01",
                asset_id="asset_01",
                scan_id="scan_01",
                status="READY",
                evidence={"report_id": "report_01", "is_synthetic": True},
                downloads={
                    "html": "/reports/report_01.html",
                    "json": "/reports/report_01.json",
                },
                limitations=["담당자 검토 필요"],
                generated_at=now,
            )
        )
        session.commit()

    with session_factory() as read_session:
        contract = repositories.ContractRepository(read_session).get("contract_01")
        scan = repositories.ScanRepository(read_session).get("scan_01")
        report = repositories.ReportRepository(read_session).get("report_01")

    assert contract is not None
    assert contract is not inserted_contract
    assert contract.source_code == "contract SyntheticRwa {}"
    assert scan is not None
    assert scan is not inserted_scan
    assert scan.failed_stages[0]["rule_id"] == "ORACLE_VALIDATION_MISSING"
    assert report is not None
    assert report is not inserted_report
    assert report.downloads["json"] == "/reports/report_01.json"


def test_records_reject_non_synthetic_data(session_factory) -> None:
    _, models, repositories = _db_modules()
    with session_factory() as session:
        asset = _asset(models)
        asset.is_synthetic = False

        with pytest.raises((ValueError, StatementError)):
            repositories.AssetRepository(session).add(asset)


def test_database_check_rejects_raw_non_synthetic_insert(session_factory) -> None:
    _, models, _ = _db_modules()
    engine = session_factory.kw["bind"]
    statement = insert(models.AssetRecord).values(
        id="asset_raw",
        name="raw insert",
        asset_type="SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
        status="UNVERIFIED",
        underlying_description="synthetic fixture",
        total_planned_supply=1,
        network="KAIA_KAIROS",
        currency="KRW",
        token_unit="TOKEN",
        is_synthetic=False,
    )

    with pytest.raises(IntegrityError):
        with engine.begin() as connection:
            connection.execute(statement)


def test_orm_metadata_matches_p0_workflow_checks() -> None:
    _, models, _ = _db_modules()

    asset_checks = {
        str(constraint.sqltext)
        for constraint in models.AssetRecord.__table__.constraints
        if isinstance(constraint, CheckConstraint)
    }
    document_checks = {
        str(constraint.sqltext)
        for constraint in models.IssuanceDocumentRecord.__table__.constraints
        if isinstance(constraint, CheckConstraint)
    }
    contract_checks = {
        str(constraint.sqltext)
        for constraint in models.ContractRecord.__table__.constraints
        if isinstance(constraint, CheckConstraint)
    }

    assert models.ContractRecord.__table__.c.chain_id.nullable is True
    assert "total_planned_supply > 0" in asset_checks
    assert (
        "status in ('UPLOADED', 'PROCESSING', 'READY', 'PARTIAL', 'FAILED')"
        in document_checks
    )
    assert "source_kind in ('SOURCE', 'ADDRESS', 'SOURCE_AND_ADDRESS')" in contract_checks


def test_postgresql_ddl_compiles_portable_json_as_jsonb() -> None:
    base, models, _ = _db_modules()
    dialect = postgresql.dialect()

    ddl = "\n".join(
        str(CreateTable(table).compile(dialect=dialect))
        for table in base.Base.metadata.sorted_tables
    )

    portable_json_columns = [
        models.IssuanceDocumentRecord.__table__.c.failed_pages,
        models.ScanRunRecord.__table__.c.input_hashes,
        models.ScanRunRecord.__table__.c.rule_versions,
        models.ScanRunRecord.__table__.c.failed_stages,
        models.ReportRecord.__table__.c.evidence,
        models.ReportRecord.__table__.c.downloads,
        models.ReportRecord.__table__.c.limitations,
    ]
    assert all(
        isinstance(column.type.dialect_impl(dialect), postgresql.JSONB)
        for column in portable_json_columns
    )
    assert "CHECK (is_synthetic = true)" in ddl
    assert "failed_stages JSONB" in ddl
    assert "evidence JSONB" in ddl


def _migration_fragments(migration_sql: str, table_name: str) -> str:
    create_match = re.search(
        rf"create table if not exists {table_name}\s*\((.*?)\);",
        migration_sql,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert create_match is not None, f"{table_name} create migration is missing"
    alter_matches = re.findall(
        rf"alter table {table_name}\s+(.*?);",
        migration_sql,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return "\n".join([create_match.group(1), *alter_matches])


def test_migrations_match_explicit_orm_column_contracts() -> None:
    base, _, _ = _db_modules()
    migration_sql = "\n".join(
        (MIGRATIONS / name).read_text(encoding="utf-8")
        for name in ("0001_core.sql", "0002_p0_workflow.sql")
    )

    for (table_name, column_name), expected in COLUMN_CONTRACTS.items():
        column = base.Base.metadata.tables[table_name].c[column_name]
        foreign_keys = {key.target_fullname for key in column.foreign_keys}
        server_default = (
            str(column.server_default.arg) if column.server_default is not None else None
        )

        assert isinstance(column.type, expected.type_family)
        assert column.nullable is expected.nullable
        assert foreign_keys == ({expected.foreign_key} if expected.foreign_key else set())
        assert bool(column.unique) is expected.unique
        assert server_default == expected.server_default
        assert re.search(
            expected.migration_pattern,
            _migration_fragments(migration_sql, table_name),
            flags=re.IGNORECASE | re.DOTALL | re.MULTILINE,
        ), f"{table_name}.{column_name} migration semantics drifted"


def test_migrations_match_orm_check_semantics() -> None:
    base, _, _ = _db_modules()
    migration_sql = "\n".join(
        (MIGRATIONS / name).read_text(encoding="utf-8")
        for name in ("0001_core.sql", "0002_p0_workflow.sql")
    )
    expected_checks = {
        "assets": ["total_planned_supply > 0", "is_synthetic = true"],
        "issuance_documents": [
            "status in ('UPLOADED', 'PROCESSING', 'READY', 'PARTIAL', 'FAILED')",
            "is_synthetic = true",
        ],
        "contracts": [
            "source_kind in ('SOURCE', 'ADDRESS', 'SOURCE_AND_ADDRESS')",
            "is_synthetic = true",
        ],
        "scan_runs": ["is_synthetic = true"],
        "reports": ["is_synthetic = true"],
    }

    for table_name, checks in expected_checks.items():
        table = base.Base.metadata.tables[table_name]
        orm_checks = {
            re.sub(r"\s+", " ", str(constraint.sqltext).strip()).lower()
            for constraint in table.constraints
            if isinstance(constraint, CheckConstraint)
        }
        migration_fragment = re.sub(
            r"\s+",
            " ",
            _migration_fragments(migration_sql, table_name),
        ).lower()

        for check in checks:
            normalized = re.sub(r"\s+", " ", check).lower()
            assert normalized in orm_checks
            assert f"check ({normalized})" in migration_fragment


def test_p0_migration_covers_operational_tables_and_synthetic_guards() -> None:
    migration = (MIGRATIONS / "0002_p0_workflow.sql").read_text(encoding="utf-8")
    expected_columns = {
        "audit_logs": {
            "actor_type",
            "action",
            "target_type",
            "target_id",
            "before_state",
            "after_state",
            "is_synthetic",
        },
        "worker_heartbeats": {
            "worker_name",
            "status",
            "capabilities",
            "last_seen_at",
            "is_synthetic",
        },
    }

    for table_name, columns in expected_columns.items():
        match = re.search(
            rf"create table if not exists {table_name}\s*\((.*?)\);",
            migration,
            flags=re.IGNORECASE | re.DOTALL,
        )
        assert match is not None, f"{table_name} migration is missing"
        definition = match.group(1)
        assert columns <= set(re.findall(r"^\s*(\w+)\s+", definition, flags=re.MULTILINE))
        assert re.search(
            r"is_synthetic\s+boolean\s+not null\s+default true\s+"
            r"check\s*\(is_synthetic = true\)",
            definition,
            flags=re.IGNORECASE,
        )

    jobs_alter = re.search(
        r"alter table jobs\s+(.*?);",
        migration,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert jobs_alter is not None
    assert "check (is_synthetic = true)" in jobs_alter.group(1).lower()


def test_fix_wave_migration_matches_audit_and_worker_orm_contracts() -> None:
    from rwa_guard.db import base

    migration = (MIGRATIONS / "0009_fix_wave_audit_and_worker.sql").read_text(
        encoding="utf-8"
    )
    normalized = re.sub(r"\s+", " ", migration).lower()

    audit = base.Base.metadata.tables["audit_logs"]
    assert "actor_id" in audit.columns
    audit_checks = {
        re.sub(r"\s+", " ", str(constraint.sqltext).strip()).lower()
        for constraint in audit.constraints
        if isinstance(constraint, CheckConstraint)
    }
    actor_check = "actor_type in ('system', 'operator', 'insecure_demo')"
    assert actor_check in audit_checks
    assert "add column if not exists actor_id text" in normalized
    assert "drop constraint if exists audit_logs_actor_type_check" in normalized
    assert f"check ({actor_check})" in normalized
    assert normalized.index(
        "drop constraint if exists audit_logs_actor_type_check"
    ) < normalized.index("update audit_logs")

    heartbeat = base.Base.metadata.tables["worker_heartbeats"]
    assert "worker_version" in heartbeat.columns
    assert "add column if not exists worker_version text" in normalized


def test_ready_report_immutability_migration_guards_update_and_delete() -> None:
    migration = (MIGRATIONS / "0010_ready_report_immutability.sql").read_text(
        encoding="utf-8"
    )
    normalized = re.sub(r"\s+", " ", migration).lower()

    assert "old.status = 'ready'" in normalized
    assert "before update or delete on reports" in normalized
    assert "raise exception 'ready report is immutable'" in normalized
    assert "errcode = '23000'" in normalized


def test_sqlite_orm_metadata_installs_ready_report_immutability_triggers() -> None:
    base, _, _ = _db_modules()
    engine = create_engine("sqlite+pysqlite:///:memory:")
    base.Base.metadata.create_all(engine)

    with engine.connect() as connection:
        triggers = set(
            connection.execute(
                text("select name from sqlite_master where type = 'trigger'")
            ).scalars()
        )

    assert {
        "reports_ready_immutable_update",
        "reports_ready_immutable_delete",
    } <= triggers


def test_orm_guard_rejects_ready_report_update_and_delete(session_factory) -> None:
    _, models, repositories = _db_modules()
    now = datetime(2026, 8, 28, tzinfo=UTC)
    with session_factory.begin() as session:
        repositories.AssetRepository(session).add(_asset(models))
        repositories.ScanRepository(session).add(
            models.ScanRunRecord(
                id="scan_ready",
                asset_id="asset_01",
                status="COMPLETED",
                input_hashes={},
                rule_versions={},
                failed_stages=[],
                result_payload={},
                started_at=now,
                completed_at=now,
            )
        )
        repositories.ReportRepository(session).add(
            models.ReportRecord(
                id="report_ready",
                asset_id="asset_01",
                scan_id="scan_ready",
                status="READY",
                evidence={"immutable": True},
                report_hash="sha256:ready",
                generated_at=now,
            )
        )

    with session_factory() as session:
        report = repositories.ReportRepository(session).get("report_ready")
        assert report is not None
        report.evidence = {"immutable": False}
        with pytest.raises(models.ReportImmutableError):
            session.flush()
        session.rollback()

    with session_factory() as session:
        report = repositories.ReportRepository(session).get("report_ready")
        assert report is not None
        session.delete(report)
        with pytest.raises(models.ReportImmutableError):
            session.flush()


def test_repository_never_commits_callers_transaction(session_factory) -> None:
    _, models, repositories = _db_modules()
    with session_factory() as session:
        repositories.AssetRepository(session).add(_asset(models))
        session.rollback()

    with session_factory() as verification_session:
        assert repositories.AssetRepository(verification_session).get("asset_01") is None
