import { api, mutationApi } from "@/lib/api-client";
import {
  apiRequest,
  AppError,
  assertAssetId,
  assertIntegrity,
} from "@/lib/adapters/errors";
import type { components } from "@/types/generated/api";

export type ScanInput = components["schemas"]["ScanCreateRequest"];
export type ScanCreated = components["schemas"]["ScanCreateResponse"];
export type ScanResult = components["schemas"]["ScanResultResponse"];

export async function createScan(assetId: string, input: ScanInput): Promise<ScanCreated> {
  const scan = await apiRequest(() =>
    mutationApi.POST("/v1/assets/{asset_id}/scans", {
      params: { path: { asset_id: assetId } },
      body: input,
    }),
  );
  assertAssetId(assetId, scan.asset_id);
  return scan;
}

export async function getScan(
  scanId: string,
  options: { base?: string; assetId?: string } = {},
): Promise<ScanResult> {
  let scan: ScanResult;
  try {
    scan = await apiRequest(
      () =>
        api.GET("/v1/scans/{scan_id}", {
          params: {
            path: { scan_id: scanId },
            query: options.base ? { base: options.base } : {},
          },
        }),
      { operation: "getScan" },
    );
  } catch (error) {
    if (error instanceof AppError && error.kind === "not_found") {
      const missingId = error.metadata.requestedId;
      const resource =
        missingId === options.base ? "base" : missingId === scanId ? "scan" : error.metadata.resource;
      throw new AppError(error.kind, error.status, error.detail, {
        ...error.metadata,
        resource,
      });
    }
    throw error;
  }
  assertIntegrity("scan_run.scan_id", scanId, scan.scan_run.scan_id);
  if (options.assetId) assertAssetId(options.assetId, scan.scan_run.asset_id);
  return scan;
}
