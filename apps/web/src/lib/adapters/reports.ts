import { api } from "@/lib/api-client";
import { getAsset } from "@/lib/adapters/assets";
import {
  apiRequest,
  AppError,
  assertAssetId,
  assertIntegrity,
} from "@/lib/adapters/errors";
import { getScan } from "@/lib/adapters/scans";
import type { components } from "@/types/generated/api";

export type EvidenceReport = components["schemas"]["EvidenceReport"];
export type Report = components["schemas"]["ReportResponse"];
export type ReportFormat = components["schemas"]["ReportFormat"];

export async function fetchScanViewForAsset(
  assetId: string,
  selection: { scanId?: string; base?: string } = {},
) {
  const asset = await getAsset(assetId);
  const selectedScan = selection.scanId
    ? (asset.scans ?? []).find((item) => item.scan_id === selection.scanId)
    : (asset.scans ?? [])[0];
  if (!selectedScan) {
    throw new AppError(
      "not_found",
      404,
      { resource: "scan", assetId },
      { resource: "scan", requestedId: selection.scanId },
    );
  }
  const scan = await getScan(selectedScan.scan_id, { assetId, base: selection.base });
  const reportResponse = scan.report_id ? await getReport(scan.report_id) : null;
  if (reportResponse) {
    assertIntegrity("report.scan_id", selectedScan.scan_id, reportResponse.scan_id);
  }
  return {
    asset,
    scan,
    reportResponse,
    report: reportResponse?.report ?? null,
  };
}

export async function getReport(reportId: string): Promise<Report> {
  const report = await apiRequest(() =>
    api.GET("/v1/reports/{report_id}", {
      params: { path: { report_id: reportId } },
    }),
  );
  assertIntegrity("report_id", reportId, report.report_id);
  if (report.report) {
    assertIntegrity("report.report_id", reportId, report.report.report_id);
    assertIntegrity("report.scan_run.scan_id", report.scan_id, report.report.scan_run.scan_id);
  }
  return report;
}

export function downloadReport(reportId: string, format: ReportFormat): Promise<unknown> {
  return apiRequest(() =>
    api.GET("/v1/reports/{report_id}/download", {
      params: {
        path: { report_id: reportId },
        query: { format },
      },
      parseAs: format === "html" ? "text" : "json",
    }),
  );
}

export async function fetchEvidenceReportForAsset(
  assetId: string,
  selection: { scanId?: string; reportId?: string; base?: string } = {},
): Promise<EvidenceReport> {
  const asset = await getAsset(assetId);
  const selectedScan =
    selection.scanId === undefined
      ? [...(asset.scans ?? [])].sort((left, right) =>
          (right.completed_at ?? "").localeCompare(left.completed_at ?? ""),
        )[0]
      : (asset.scans ?? []).find((scan) => scan.scan_id === selection.scanId);

  if (!selectedScan) {
    throw new AppError("not_found", 404, {
      resource: "scan",
      assetId,
      scanId: selection.scanId,
    });
  }
  assertAssetId(assetId, selectedScan.asset_id);

  const scan = await getScan(selectedScan.scan_id, {
    base: selection.base,
    assetId,
  });

  const reportId = selection.reportId ?? scan.report_id;
  if (!reportId) {
    throw new AppError("unavailable", 409, {
      resource: "report",
      scanId: selectedScan.scan_id,
    });
  }

  const response = await getReport(reportId);
  assertIntegrity("report.scan_id", selectedScan.scan_id, response.scan_id);
  if (!response.report) {
    throw new AppError("unavailable", 409, {
      resource: "report",
      reportId,
      status: response.status,
    });
  }

  assertAssetId(assetId, response.report.scan_run.asset_id);
  return response.report;
}

/**
 * 홈의 명시적 샘플 fallback 전용이다. 자산 route에서 이 함수를 호출하지 않는다.
 */
export async function fetchDemoEvidenceReportForAsset(assetId: string): Promise<EvidenceReport> {
  const report = await apiRequest(() => api.GET("/v1/demo/evidence-report"));
  assertAssetId(assetId, report.scan_run.asset_id);
  return report;
}
