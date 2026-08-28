import { api, mutationApi } from "@/lib/api-client";
import { apiRequest, assertAssetId } from "@/lib/adapters/errors";
import type { components } from "@/types/generated/api";

export type Alert = components["schemas"]["AlertSummary"];
export type AlertStatus = components["schemas"]["AlertStatus"];
export type AlertUpdate = components["schemas"]["AlertPatchRequest"];

export function listAlerts(filters: {
  assetId?: string;
  status?: AlertStatus;
} = {}): Promise<Alert[]> {
  return apiRequest(() =>
    api.GET("/v1/alerts", {
      params: {
        query: {
          asset_id: filters.assetId,
          status: filters.status,
        },
      },
    }),
  );
}

export async function updateAlert(
  alertId: string,
  input: AlertUpdate,
  assetId?: string,
): Promise<Alert> {
  const alert = await apiRequest(() =>
    mutationApi.PATCH("/v1/alerts/{alert_id}", {
      params: { path: { alert_id: alertId } },
      body: input,
    }),
  );
  if (assetId) assertAssetId(assetId, alert.asset_id);
  return alert;
}
