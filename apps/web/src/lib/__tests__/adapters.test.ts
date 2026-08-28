import { afterEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/adapters/errors";
import { getAsset } from "@/lib/adapters/assets";
import {
  downloadReport,
  fetchEvidenceReportForAsset,
  fetchScanViewForAsset,
  getReport,
} from "@/lib/adapters/reports";
import { getScan } from "@/lib/adapters/scans";
import { fetchHomeEvidenceReport } from "@/lib/evidence-report";
import { SUBMISSION_DEMO } from "@/lib/submission-demo";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("typed API adapters", () => {
  it("uses the generated lowercase HTML report format contract", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL) => {
        void input;
        return new Response("<!doctype html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await downloadReport("report 01", "html");

    const request = fetchMock.mock.calls[0]![0];
    expect(request).toBeInstanceOf(Request);
    expect((request as Request).url).toContain(
      "/v1/reports/report%2001/download?format=html",
    );
  });

  it("returns a QUEUED scan with a null report as a pollable normal state", async () => {
    const responses = [
      {
        asset_id: "asset_1",
        name: "Asset",
        asset_type: "SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
        status: "UNVERIFIED",
        underlying_description: "fixture",
        total_planned_supply: 1,
        network: "KAIA_KAIROS",
        currency: "KRW",
        token_unit: "TOKEN",
        documents: [],
        contracts: [],
        scans: [{ scan_id: "scan_queued", asset_id: "asset_1", status: "QUEUED" }],
        created_at: "2026-08-28T00:00:00Z",
        is_synthetic: true,
      },
      {
        scan_run: {
          scan_id: "scan_queued",
          asset_id: "asset_1",
          status: "QUEUED",
          input_hashes: {},
          rule_versions: {},
          failed_stages: [],
          started_at: "2026-08-28T00:00:00Z",
          is_synthetic: true,
        },
        code_findings: [],
        mismatches: [],
        onchain_evidence: [],
        diff: [],
        report_id: "report_queued",
        is_synthetic: true,
      },
      {
        report_id: "report_queued",
        scan_id: "scan_queued",
        status: "QUEUED",
        report: null,
        downloads: [],
        limitations: ["처리 중"],
        human_review_required: true,
        is_synthetic: true,
      },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(responses.shift()), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    const view = await fetchScanViewForAsset("asset_1", { scanId: "scan_queued" });

    expect(view.scan.scan_run.status).toBe("QUEUED");
    expect(view.report).toBeNull();
    expect(view.reportResponse?.status).toBe("QUEUED");
  });

  it("encodes path parameters instead of allowing route injection", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response(JSON.stringify({ detail: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAsset("../reports/private")).rejects.toMatchObject({
      name: "AppError",
      kind: "not_found",
      status: 404,
    });
    const request = fetchMock.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    expect((request as Request).url).toContain(
      "/v1/assets/..%2Freports%2Fprivate",
    );
  });

  it.each([
    [404, "not_found"],
    [409, "conflict"],
    [422, "validation"],
    [503, "server"],
  ] as const)("normalizes HTTP %i as %s", async (status, kind) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: "request failed" }), {
          status,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const error = await getAsset("asset_01").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ kind, status });
  });

  it("marks a getAsset 404 as an asset failure even when a scan is selected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: { code: "ASSET_NOT_FOUND", message: "asset not found: asset_missing" },
            is_synthetic: true,
          }),
          { status: 404, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(
      fetchEvidenceReportForAsset("asset_missing", { scanId: "scan_selected" }),
    ).rejects.toMatchObject({
      kind: "not_found",
      metadata: {
        resource: "asset",
        requestedId: "asset_missing",
      },
    });
  });

  it.each([
    ["head scan", "scan_missing", "base_01", "scan_missing", "scan"],
    ["base scan", "scan_01", "base_missing", "base_missing", "base"],
  ])(
    "uses backend error detail to classify a missing %s",
    async (_label, scanId, base, missingId, resource) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response(
            JSON.stringify({
              error: { code: "SCAN_NOT_FOUND", message: `scan not found: ${missingId}` },
              is_synthetic: true,
            }),
            { status: 404, headers: { "content-type": "application/json" } },
          ),
        ),
      );

      await expect(getScan(scanId, { base, assetId: "asset_01" })).rejects.toMatchObject({
        kind: "not_found",
        metadata: { resource, requestedId: missingId },
      });
    },
  );

  it("does not return a report that belongs to another asset", async () => {
    const responses = [
      {
        asset_id: "asset_01",
        asset_type: "SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
        contracts: [],
        created_at: "2026-08-26T00:00:00Z",
        currency: "KRW",
        documents: [],
        is_synthetic: true,
        name: "Asset 01",
        network: "KAIA_KAIROS",
        scans: [{ scan_id: "scan_01", asset_id: "asset_01", status: "COMPLETED" }],
        status: "REVIEW_REQUIRED",
        token_unit: "UNIT",
        total_planned_supply: 100000,
        underlying_description: "Synthetic fixture",
      },
      {
        scan_run: { scan_id: "scan_01", asset_id: "asset_01", status: "COMPLETED" },
        report_id: "report_01",
        is_synthetic: true,
      },
      {
        report_id: "report_01",
        scan_id: "scan_01",
        status: "READY",
        human_review_required: true,
        is_synthetic: true,
        report: {
          report_id: "report_01",
          report_hash: "hash",
          is_synthetic: true,
          scan_run: { scan_id: "scan_01", asset_id: "asset_02", status: "COMPLETED" },
          controls: [],
          code_findings: [],
          mismatches: [],
          onchain_evidence: [],
          lineage: {},
        },
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const body = responses.shift();
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    await expect(fetchEvidenceReportForAsset("asset_01")).rejects.toMatchObject({
      kind: "integrity",
      status: 409,
    });
  });

  it.each([
    [
      "nested report id",
      {
        report_id: "report_01",
        scan_id: "scan_01",
        status: "READY",
        human_review_required: true,
        is_synthetic: true,
        report: {
          report_id: "report_other",
          scan_run: { scan_id: "scan_01", asset_id: "asset_01" },
        },
      },
    ],
    [
      "nested scan id",
      {
        report_id: "report_01",
        scan_id: "scan_01",
        status: "READY",
        human_review_required: true,
        is_synthetic: true,
        report: {
          report_id: "report_01",
          scan_run: { scan_id: "scan_other", asset_id: "asset_01" },
        },
      },
    ],
  ])("rejects a report with mismatched %s", async (_label, body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(getReport("report_01")).rejects.toMatchObject({
      kind: "integrity",
      status: 409,
    });
  });

  it.each([
    ["scan id", { scan_id: "scan_other", asset_id: "asset_01" }, undefined],
    ["asset id", { scan_id: "scan_01", asset_id: "asset_other" }, "asset_01"],
  ])("rejects a scan with mismatched %s", async (_label, scanRun, assetId) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            is_synthetic: true,
            scan_run: scanRun,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(getScan("scan_01", { assetId })).rejects.toMatchObject({
      kind: "integrity",
      status: 409,
    });
  });

  it("does not hide persisted integrity failures behind the demo fallback", async () => {
    const responses = [
      {
        assets: [{
          asset_id: SUBMISSION_DEMO.assetId,
          name: "Han River Office 01",
          is_synthetic: true,
        }],
        critical_assets: 0,
        high_assets: 0,
        is_synthetic: true,
        recent_alerts: [],
        total_assets: 1,
      },
      {
        asset_id: "asset_other",
        asset_type: "SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
        created_at: "2026-08-26T00:00:00Z",
        currency: "KRW",
        is_synthetic: true,
        name: "Other",
        network: "KAIA_KAIROS",
        status: "REVIEW_REQUIRED",
        token_unit: "UNIT",
        total_planned_supply: 1,
        underlying_description: "Synthetic fixture",
      },
    ];
    const fetchMock = vi.fn(async () => {
      const body = responses.shift();
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchHomeEvidenceReport()).rejects.toMatchObject({ kind: "integrity" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
