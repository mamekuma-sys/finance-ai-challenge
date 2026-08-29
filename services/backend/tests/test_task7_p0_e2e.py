from __future__ import annotations

import hashlib
import html
import json
import shutil
from collections import Counter
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from rwa_guard.api.main import create_app
from rwa_guard.api.routes import _render_report_html
from rwa_guard.config import Settings
from rwa_guard.db.base import Base
from rwa_guard.db.models import (
    AssetRecord,
    ContractRecord,
    IssuanceDocumentRecord,
    ReportRecord,
    ScanRunRecord,
)
from rwa_guard.fixtures import build_demo_report
from rwa_guard.pipelines import contract as contract_pipeline
from rwa_guard.pipelines.report import build_evidence_report
from rwa_guard.worker import JobWorker
from rwa_guard.worker.__main__ import build_handler_registry

REPOSITORY = Path(__file__).resolve().parents[3]
FORGE_FALLBACK = Path.home() / ".foundry" / "bin" / "forge.exe"
AUTH = {"Authorization": "Bearer task7-operator-token"}
EXPECTED_P0_FIELD_RULES = {
    "max_supply": "MINT_COLLATERAL_CAP_MISSING",
    "collateral_verified": "MINT_COLLATERAL_CAP_MISSING",
    "issuer_role": "MINT_ACCESS_CONTROL_MISSING",
    "oracle_max_age": "ORACLE_VALIDATION_MISSING",
}
UNRESOLVED_P0_FIELDS = {"pauser_role", "price_band_breach"}


def assert_exact_p0_mapping(
    *,
    controls: list[dict[str, Any]],
    findings: list[dict[str, Any]],
    mismatches: list[dict[str, Any]],
    onchain: list[dict[str, Any]],
) -> None:
    control_by_id = {item["constraint_id"]: item for item in controls}
    finding_by_id = {item["finding_id"]: item for item in findings}
    mismatch_ids = [item["mismatch_id"] for item in mismatches]
    assert len(control_by_id) == len(controls) == 6
    assert len(finding_by_id) == len(findings)
    assert len(set(mismatch_ids)) == len(mismatch_ids)
    assert len(mismatches) == 4

    expected_pairs = Counter(EXPECTED_P0_FIELD_RULES.items())
    actual_pairs = Counter(
        (
            control_by_id[mismatch["constraint_id"]]["field"],
            finding_by_id[mismatch["finding_id"]]["rule_id"],
        )
        for mismatch in mismatches
    )
    assert actual_pairs == expected_pairs
    assert Counter(item["constraint_id"] for item in mismatches) == Counter(
        {
            constraint_id: 1
            for constraint_id, control in control_by_id.items()
            if control["field"] in EXPECTED_P0_FIELD_RULES
        }
    )
    assert not (
        UNRESOLVED_P0_FIELDS
        & {control_by_id[item["constraint_id"]]["field"] for item in mismatches}
    )

    chain_refs = {
        f"{item['tx_hash']}:{item['log_index']}"
        for item in onchain
    }
    for mismatch in mismatches:
        links = mismatch["evidence_links"]
        refs = {(link["kind"], link["ref"]) for link in links}
        assert len(refs) == len(links)
        assert ("DOCUMENT", mismatch["constraint_id"]) in refs
        assert ("CODE", mismatch["finding_id"]) in refs
        for kind, ref in refs:
            if kind == "DOCUMENT":
                assert ref in control_by_id
            elif kind == "CODE":
                assert ref in finding_by_id
            elif kind == "CHAIN":
                assert ref in chain_refs
            else:
                raise AssertionError(f"unknown evidence kind: {kind}")


def _fixture_source(token_name: str, oracle_name: str) -> str:
    fixture_root = REPOSITORY / "chain" / "src" / "fixtures"
    sources = [
        (fixture_root / name).read_text(encoding="utf-8")
        for name in (token_name, oracle_name)
    ]
    # The API accepts one source unit. Keep fixture code byte-for-byte except for
    # duplicate file-level SPDX comments, which solc rejects in a combined unit.
    combined = "\n\n".join(
        "\n".join(
            line
            for line in source.splitlines()
            if not line.startswith("// SPDX-License-Identifier:")
        )
        for source in sources
    )
    return "// SPDX-License-Identifier: MIT\n" + combined


def _assert_response(response, status_code: int) -> dict[str, object]:
    assert response.status_code == status_code, response.text
    payload = response.json()
    assert isinstance(payload, dict)
    return payload


def test_foundry_discovery_accepts_windows_home_install(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    forge = tmp_path / ".foundry" / "bin" / "forge.exe"
    forge.parent.mkdir(parents=True)
    forge.write_bytes(b"")
    monkeypatch.delenv("RWA_GUARD_FORGE_BIN", raising=False)
    monkeypatch.setattr(contract_pipeline.shutil, "which", lambda _name: None)
    monkeypatch.setattr(contract_pipeline.Path, "home", lambda: tmp_path)

    assert contract_pipeline._find_forge() == str(forge)


def test_semantic_html_escapes_report_controlled_text() -> None:
    base = build_demo_report()
    escaped_report = build_evidence_report(
        report_id="report_html_escape",
        scan_run=base.scan_run,
        controls=list(base.controls),
        findings=list(base.code_findings),
        mismatches=list(base.mismatches),
        onchain_evidence=list(base.onchain_evidence),
        tool_versions={"contract<script>": "tool&1"},
        model_versions={"model<script>": "v&1"},
        limitations=["<script>alert('report')</script>"],
        generated_at=base.generated_at,
        document_extractor=base.lineage.document_extractor,
        ai_model="model<script>",
    )

    rendered = _render_report_html(escaped_report)

    assert "<script>" not in rendered
    assert "&lt;script&gt;alert(&#x27;report&#x27;)&lt;/script&gt;" in rendered
    assert escaped_report.report_hash in rendered
    assert "REPLAY · 재현 데이터" in rendered
    for versions in (
        escaped_report.lineage.tool_versions,
        escaped_report.lineage.model_versions,
    ):
        for key, value in versions.items():
            assert html.escape(key, quote=True) in rendered
            assert html.escape(value, quote=True) in rendered


def test_authenticated_vulnerable_to_fixed_p0_journey_uses_real_foundry_and_sqlite(
    tmp_path: Path, monkeypatch
) -> None:
    forge = shutil.which("forge") or (str(FORGE_FALLBACK) if FORGE_FALLBACK.is_file() else None)
    assert forge is not None, "Foundry is required for the P0 end-to-end test"
    monkeypatch.setenv("RWA_GUARD_FORGE_BIN", forge)

    database = tmp_path / "task7.db"
    engine = create_engine(
        f"sqlite+pysqlite:///{database}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
    settings = Settings(
        app_env="production",
        database_url=str(engine.url),
        storage_directory=tmp_path / "uploads",
        operator_token="task7-operator-token",
        operator_id="task7-reviewer",
        operator_access_code="Strong-Task7-Review-Code!",
        document_extractor="deterministic",
    )
    client = TestClient(create_app(settings=settings, session_factory=factory))
    worker = JobWorker(factory, build_handler_registry(settings), "task7-e2e")

    asset = _assert_response(
        client.post(
            "/v1/assets",
            headers=AUTH,
            json={
                "name": "Task7 합성 한강 오피스",
                "asset_type": "SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
                "underlying_description": "data/synthetic 기반 P0 E2E",
                "total_planned_supply": 100_000,
                "network": "KAIA_KAIROS",
                "currency": "KRW",
                "token_unit": "TOKEN",
                "is_synthetic": True,
            },
        ),
        201,
    )
    asset_id = str(asset["asset_id"])

    document_bytes = (
        REPOSITORY / "data" / "synthetic" / "documents" / "issuance-terms-01.txt"
    ).read_bytes()
    document = _assert_response(
        client.post(
            f"/v1/assets/{asset_id}/documents",
            headers=AUTH,
            files={"file": ("issuance-terms-01.txt", document_bytes, "text/plain")},
            data={"is_synthetic": "true"},
        ),
        201,
    )
    assert worker.run_once() is True
    document = _assert_response(client.get(f"/v1/documents/{document['document_id']}"), 200)
    controls = document["controls"]
    assert isinstance(controls, list) and len(controls) == 6
    assert {item["field"] for item in controls} == {
        "max_supply",
        "collateral_verified",
        "issuer_role",
        "oracle_max_age",
        "price_band_breach",
        "pauser_role",
    }
    assert all(
        document_bytes.decode("utf-8")[
            item["evidence_span"]["start"] : item["evidence_span"]["end"]
        ]
        == item["evidence_span"]["quote"]
        for item in controls
    )
    assert not any(item["confirmed"] for item in controls)

    confirmed = client.patch(
        f"/v1/assets/{asset_id}/policies",
        headers=AUTH,
        json={
            "document_id": document["document_id"],
            "policies": [
                {
                    "constraint_id": item["constraint_id"],
                    "field": item["field"],
                    "value": item["value"],
                    "unit": item["unit"],
                    "evidence_span": item["evidence_span"],
                    "confirmed": True,
                    "expected_version": item["version"],
                    "is_synthetic": True,
                }
                for item in controls
            ],
            "is_synthetic": True,
        },
    )
    assert confirmed.status_code == 200, confirmed.text
    assert all(item["confirmed"] for item in confirmed.json())

    vulnerable_contract = _assert_response(
        client.post(
            f"/v1/assets/{asset_id}/contracts",
            headers=AUTH,
            json={
                "source_code": _fixture_source(
                    "VulnerableRwaToken.sol", "VulnerableOracle.sol"
                ),
                "chain_id": 1001,
                "is_synthetic": True,
            },
        ),
        201,
    )
    vulnerable_scan = _assert_response(
        client.post(
            f"/v1/assets/{asset_id}/scans",
            headers=AUTH,
            json={
                "contract_id": vulnerable_contract["contract_id"],
                "is_synthetic": True,
            },
        ),
        202,
    )
    assert worker.run_once() is True
    vulnerable_result = _assert_response(
        client.get(f"/v1/scans/{vulnerable_scan['scan_id']}"), 200
    )
    assert vulnerable_result["scan_run"]["status"] == "COMPLETED"
    findings = vulnerable_result["code_findings"]
    assert len(findings) == 3
    assert {item["rule_id"] for item in findings} == {
        "MINT_ACCESS_CONTROL_MISSING",
        "MINT_COLLATERAL_CAP_MISSING",
        "ORACLE_VALIDATION_MISSING",
    }
    assert all(item["status"] == "CONFIRMED" for item in findings)
    assert all(item["severity"] in {"CRITICAL", "HIGH"} for item in findings)
    finding_by_id = {item["finding_id"]: item for item in findings}
    control_by_id = {item["constraint_id"]: item for item in controls}
    mismatches = vulnerable_result["mismatches"]
    assert len(mismatches) == 4
    assert {
        finding_by_id[item["finding_id"]]["rule_id"] for item in mismatches
    } == {
        "MINT_ACCESS_CONTROL_MISSING",
        "MINT_COLLATERAL_CAP_MISSING",
        "ORACLE_VALIDATION_MISSING",
    }
    for mismatch in mismatches:
        kinds = {link["kind"] for link in mismatch["evidence_links"]}
        assert {"DOCUMENT", "CODE"} <= kinds
        refs = {(link["kind"], link["ref"]) for link in mismatch["evidence_links"]}
        assert ("DOCUMENT", mismatch["constraint_id"]) in refs
        assert ("CODE", mismatch["finding_id"]) in refs
        assert mismatch["constraint_id"] in control_by_id
        assert mismatch["finding_id"] in finding_by_id
        assert finding_by_id[mismatch["finding_id"]]["status"] == "CONFIRMED"
    onchain = vulnerable_result["onchain_evidence"]
    assert_exact_p0_mapping(
        controls=controls,
        findings=findings,
        mismatches=mismatches,
        onchain=onchain,
    )
    assert set(EXPECTED_P0_FIELD_RULES) | UNRESOLVED_P0_FIELDS == {
        item["field"] for item in controls
    }
    with pytest.raises(AssertionError):
        assert_exact_p0_mapping(
            controls=controls,
            findings=findings,
            mismatches=[*mismatches[:-1], mismatches[0]],
            onchain=onchain,
        )
    with pytest.raises(AssertionError):
        assert_exact_p0_mapping(
            controls=controls,
            findings=findings,
            mismatches=mismatches[:-1],
            onchain=onchain,
        )
    if onchain:
        assert {item["mode"] for item in onchain} == {"REPLAY"}
    else:
        assert not any(
            link["kind"] == "CHAIN"
            for mismatch in mismatches
            for link in mismatch["evidence_links"]
        )

    fixed_contract = _assert_response(
        client.post(
            f"/v1/assets/{asset_id}/contracts",
            headers=AUTH,
            json={
                "source_code": _fixture_source("FixedRwaToken.sol", "FixedOracle.sol"),
                "chain_id": 1001,
                "is_synthetic": True,
            },
        ),
        201,
    )
    fixed_scan = _assert_response(
        client.post(
            f"/v1/assets/{asset_id}/scans",
            headers=AUTH,
            json={
                "contract_id": fixed_contract["contract_id"],
                "base_scan_id": vulnerable_scan["scan_id"],
                "is_synthetic": True,
            },
        ),
        202,
    )
    assert worker.run_once() is True
    fixed_result = _assert_response(
        client.get(
            f"/v1/scans/{fixed_scan['scan_id']}?base={vulnerable_scan['scan_id']}"
        ),
        200,
    )
    assert fixed_result["scan_run"]["status"] == "COMPLETED"
    assert fixed_result["code_findings"] == []
    assert fixed_result["mismatches"] == []
    expected_rules = {
        "MINT_ACCESS_CONTROL_MISSING",
        "MINT_COLLATERAL_CAP_MISSING",
        "ORACLE_VALIDATION_MISSING",
    }
    expected_finding_ids = {
        item["rule_id"]: item["finding_id"] for item in vulnerable_result["code_findings"]
    }

    def assert_diff(
        items: list[dict[str, object]],
        *,
        change: str,
        base_scan_id: str,
        head_scan_id: str,
        base_version: str | None,
        head_version: str | None,
    ) -> None:
        assert len(items) == 3
        assert {item["rule_id"] for item in items} == expected_rules
        assert {item["change"] for item in items} == {change}
        assert {item["base_scan_id"] for item in items} == {base_scan_id}
        assert {item["head_scan_id"] for item in items} == {head_scan_id}
        assert {item["base_rule_version"] for item in items} == {base_version}
        assert {item["head_rule_version"] for item in items} == {head_version}
        assert {
            item["rule_id"]: item["finding_id"] for item in items
        } == expected_finding_ids

    assert_diff(
        fixed_result["diff"],
        change="RESOLVED",
        base_scan_id=vulnerable_scan["scan_id"],
        head_scan_id=fixed_scan["scan_id"],
        base_version="1.0.0",
        head_version=None,
    )

    remains = _assert_response(
        client.get(
            f"/v1/scans/{vulnerable_scan['scan_id']}?base={vulnerable_scan['scan_id']}"
        ),
        200,
    )
    assert_diff(
        remains["diff"],
        change="REMAINS",
        base_scan_id=vulnerable_scan["scan_id"],
        head_scan_id=vulnerable_scan["scan_id"],
        base_version="1.0.0",
        head_version="1.0.0",
    )
    new = _assert_response(
        client.get(f"/v1/scans/{vulnerable_scan['scan_id']}?base={fixed_scan['scan_id']}"),
        200,
    )
    assert_diff(
        new["diff"],
        change="NEW",
        base_scan_id=fixed_scan["scan_id"],
        head_scan_id=vulnerable_scan["scan_id"],
        base_version=None,
        head_version="1.0.0",
    )

    report_response = _assert_response(
        client.get(f"/v1/reports/{vulnerable_result['report_id']}"), 200
    )
    report = report_response["report"]
    assert len(report["mismatches"]) == 4
    assert report["report_hash"].startswith("sha256:")
    assert report["lineage"]["input_hashes"]["document"] == (
        f"sha256:{hashlib.sha256(document_bytes).hexdigest()}"
    )
    assert report["lineage"]["limitations"]
    assert report["lineage"]["document_extractor"].startswith(
        "deterministic-synthetic-parser@"
    )
    metadata = next(
        item for item in report_response["downloads"] if item["format"] == "json"
    )
    download = client.get(metadata["url"])
    assert download.status_code == 200
    assert metadata["sha256"] == f"sha256:{hashlib.sha256(download.content).hexdigest()}"
    assert json.loads(download.content) == report

    html_download = client.get(
        f"/v1/reports/{vulnerable_result['report_id']}/download?format=html"
    )
    assert html_download.status_code == 200
    assert html_download.headers["content-type"].startswith("text/html")
    assert "default-src 'none'" in html_download.headers["content-security-policy"]
    assert 'attachment; filename="' in html_download.headers["content-disposition"]
    html_body = html_download.text
    for semantic_section in (
        "판정",
        "문서·코드 증거",
        "계보",
        "제한사항",
        "담당자 검토 필요",
        "자동 발행 승인 또는 거래정지를 수행하지 않습니다",
    ):
        assert semantic_section in html_body
    assert report["report_hash"] in html_body
    assert "합성 데이터" in html_body
    for versions in (
        report["lineage"]["rule_versions"],
        report["lineage"]["tool_versions"],
    ):
        for key, value in versions.items():
            assert html.escape(key, quote=True) in html_body
            assert html.escape(value, quote=True) in html_body
    assert html.escape(report["lineage"]["document_extractor"], quote=True) in html_body
    assert report["lineage"]["model_versions"] == {}
    assert "AI 모델 없음" in html_body
    html_metadata = next(
        item for item in report_response["downloads"] if item["format"] == "html"
    )
    assert html_metadata["sha256"] == (
        f"sha256:{hashlib.sha256(html_download.content).hexdigest()}"
    )

    with factory() as session:
        assert session.scalar(select(func.count()).select_from(AssetRecord)) == 1
        assert session.scalar(select(func.count()).select_from(IssuanceDocumentRecord)) == 1
        assert session.scalar(select(func.count()).select_from(ContractRecord)) == 2
        assert session.scalar(select(func.count()).select_from(ScanRunRecord)) == 2
        assert session.scalar(select(func.count()).select_from(ReportRecord)) == 2
