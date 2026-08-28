import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/adapters/errors";
import { selectHomeEvidenceReport } from "@/lib/evidence-report";
import type { AssetSummary, EvidenceReport } from "@/types/ui";

const sample = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../contracts/examples/evidence-report.sample.json"), "utf8"),
) as EvidenceReport;

function asset(assetId: string, severity: AssetSummary["highest_severity"]): AssetSummary {
  return {
    asset_id: assetId,
    name: `Asset ${assetId}`,
    critical_count: severity === "CRITICAL" ? 1 : 0,
    high_count: severity === "HIGH" ? 1 : 0,
    highest_severity: severity,
    is_synthetic: true,
  };
}

function report(
  assetId: string,
  reportId: string,
  severity: EvidenceReport["mismatches"][number]["severity"],
  generatedAt: string,
): EvidenceReport {
  return {
    ...sample,
    report_id: reportId,
    generated_at: generatedAt,
    scan_run: { ...sample.scan_run, asset_id: assetId, scan_id: `scan_${assetId}` },
    code_findings: sample.code_findings.map((finding) => ({
      ...finding,
      scan_id: `scan_${assetId}`,
      severity,
    })),
    mismatches: sample.mismatches.map((mismatch) => ({
      ...mismatch,
      severity,
    })),
  };
}

describe("home persisted report selection", () => {
  it("selects the canonical persisted report even when an extraneous asset is riskier and newer", async () => {
    const canonical = asset("asset_synthetic_hanriver_01", "HIGH");
    const extraneous = asset("runtime_worker_verification", "CRITICAL");
    const calls: Array<{
      assetId: string;
      selection?: { scanId?: string; reportId?: string };
    }> = [];

    const selected = await selectHomeEvidenceReport([extraneous, canonical], async (assetId, selection) => {
      calls.push({ assetId, selection });
      return assetId === canonical.asset_id
        ? report(assetId, "report_demo_01", "HIGH", "2026-08-27T00:00:00Z")
        : report(assetId, "report_runtime", "CRITICAL", "2026-08-28T00:00:00Z");
    });

    expect(calls).toEqual([{
      assetId: "asset_synthetic_hanriver_01",
      selection: {
        reportId: "report_demo_01",
        scanId: "scan_demo_vulnerable_01",
      },
    }]);
    expect(selected?.asset.asset_id).toBe("asset_synthetic_hanriver_01");
    expect(selected?.report.report_id).toBe("report_demo_01");
  });

  it("does not use an arbitrary persisted report when the canonical asset is absent", async () => {
    const loadReport = async (assetId: string) =>
      report(assetId, "report_runtime", "CRITICAL", "2026-08-28T00:00:00Z");

    await expect(
      selectHomeEvidenceReport([asset("runtime_worker_verification", "CRITICAL")], loadReport),
    ).resolves.toBeNull();
  });

  it("treats missing, queued, and partial reports as an honest empty state", async () => {
    const assets = [asset("asset_synthetic_hanriver_01", "HIGH")];

    for (const error of [
      new AppError("not_found", 404),
      new AppError("unavailable", 409),
    ]) {
      await expect(
        selectHomeEvidenceReport(assets, async () => {
          throw error;
        }),
      ).resolves.toBeNull();
    }
  });

  it("preserves integrity failures instead of hiding them as empty state", async () => {
    await expect(
      selectHomeEvidenceReport([asset("asset_synthetic_hanriver_01", "CRITICAL")], async () => {
        throw new AppError("integrity", 409);
      }),
    ).rejects.toMatchObject({ kind: "integrity" });
  });
});
