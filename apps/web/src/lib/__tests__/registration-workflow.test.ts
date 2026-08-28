import { describe, expect, it, vi } from "vitest";

import { runRegistration } from "@/lib/registration-workflow";

const input = {
  asset: {
    name: "합성 테스트 자산",
    asset_type: "SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE" as const,
    underlying_description: "합성 상업용 부동산",
    total_planned_supply: 100_000,
    network: "KAIA_KAIROS" as const,
    currency: "KRW",
    token_unit: "TOKEN",
    is_synthetic: true as const,
  },
  document: new File(["synthetic"], "terms.txt", { type: "text/plain" }),
  sourceCode: "contract SyntheticRwa {}",
};

describe("runRegistration", () => {
  it("자산, 문서, 컨트랙트를 순서대로 생성한다", async () => {
    const calls: string[] = [];
    const result = await runRegistration(input, {
      createAsset: vi.fn(async () => {
        calls.push("asset");
        return { asset_id: "asset_1" };
      }),
      uploadDocument: vi.fn(async (assetId) => {
        calls.push(`document:${assetId}`);
        return { document_id: "doc_1" };
      }),
      createContract: vi.fn(async (assetId) => {
        calls.push(`contract:${assetId}`);
        return { contract_id: "contract_1" };
      }),
    });

    expect(calls).toEqual(["asset", "document:asset_1", "contract:asset_1"]);
    expect(result).toEqual({
      assetId: "asset_1",
      documentId: "doc_1",
      contractId: "contract_1",
    });
  });

  it("업로드 실패 시 생성 자산 ID를 보존한다", async () => {
    await expect(
      runRegistration(input, {
        createAsset: async () => ({ asset_id: "asset_partial" }),
        uploadDocument: async () => {
          throw new Error("upload failed");
        },
        createContract: async () => ({ contract_id: "unused" }),
      }),
    ).rejects.toMatchObject({ assetId: "asset_partial", failedStage: "document" });
  });
});
