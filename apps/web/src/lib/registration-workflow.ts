import type { CreateAssetInput } from "@/lib/adapters/assets";

export interface RegistrationInput {
  asset: CreateAssetInput;
  document: File;
  sourceCode?: string;
  address?: string;
}

export interface RegistrationDependencies {
  createAsset(input: CreateAssetInput): Promise<{ asset_id: string }>;
  uploadDocument(assetId: string, file: File): Promise<{ document_id: string }>;
  createContract(
    assetId: string,
    input: { source_code?: string; address?: string; chain_id: 1001; is_synthetic: true },
  ): Promise<{ contract_id: string }>;
}

export class RegistrationPartialError extends Error {
  constructor(
    readonly assetId: string,
    readonly failedStage: "document" | "contract",
    readonly cause: unknown,
  ) {
    super(failedStage === "document" ? "문서 업로드에 실패했습니다." : "컨트랙트 연결에 실패했습니다.");
    this.name = "RegistrationPartialError";
  }
}

export async function runRegistration(
  input: RegistrationInput,
  dependencies: RegistrationDependencies,
): Promise<{ assetId: string; documentId: string; contractId: string }> {
  const created = await dependencies.createAsset(input.asset);
  let document: { document_id: string };
  try {
    document = await dependencies.uploadDocument(created.asset_id, input.document);
  } catch (error) {
    throw new RegistrationPartialError(created.asset_id, "document", error);
  }

  try {
    const contract = await dependencies.createContract(created.asset_id, {
      source_code: input.sourceCode,
      address: input.address,
      chain_id: 1001,
      is_synthetic: true,
    });
    return {
      assetId: created.asset_id,
      documentId: document.document_id,
      contractId: contract.contract_id,
    };
  } catch (error) {
    throw new RegistrationPartialError(created.asset_id, "contract", error);
  }
}
