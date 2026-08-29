import { api, mutationApi } from "@/lib/api-client";
import { apiRequest, assertAssetId } from "@/lib/adapters/errors";
import type { components } from "@/types/generated/api";

export type Asset = components["schemas"]["AssetDetail"];
export type CreateAssetInput = components["schemas"]["CreateAssetRequest"];
export type CreateAssetResult = components["schemas"]["CreateAssetResponse"];
export type CreateContractInput = components["schemas"]["ContractCreateRequest"];
export type Contract = components["schemas"]["ContractCreateResponse"];

export function listAssets(): Promise<Asset[]> {
  return apiRequest(() => api.GET("/v1/assets"));
}

export async function getAsset(assetId: string): Promise<Asset> {
  const asset = await apiRequest(() =>
    api.GET("/v1/assets/{asset_id}", {
      params: { path: { asset_id: assetId } },
    }),
    { operation: "getAsset", resource: "asset", requestedId: assetId },
  );
  assertAssetId(assetId, asset.asset_id);
  return asset;
}

export function createAsset(input: CreateAssetInput): Promise<CreateAssetResult> {
  return apiRequest(() => mutationApi.POST("/v1/assets", { body: input }));
}

export async function createContract(
  assetId: string,
  input: CreateContractInput,
): Promise<Contract> {
  const contract = await apiRequest(() =>
    mutationApi.POST("/v1/assets/{asset_id}/contracts", {
      params: { path: { asset_id: assetId } },
      body: input,
    }),
  );
  assertAssetId(assetId, contract.asset_id);
  return contract;
}
