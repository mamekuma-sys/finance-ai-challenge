import { api, mutationApi } from "@/lib/api-client";
import { apiRequest, AppError, assertAssetId } from "@/lib/adapters/errors";
import type { components } from "@/types/generated/api";

export type Document = components["schemas"]["DocumentResponse"];
export type DocumentContent = components["schemas"]["DocumentContentResponse"];
export type PolicyUpdate = components["schemas"]["PolicyPatchRequest"];
export type Control = components["schemas"]["ControlSpec"];
type GeneratedUploadBody =
  components["schemas"]["Body_upload_document_v1_assets__asset_id__documents_post"];
export interface UploadDocumentOptions {
  fileName?: string;
  isSynthetic?: boolean;
}

const EXTENSION_BY_MIME: Record<string, ".pdf" | ".txt"> = {
  "application/pdf": ".pdf",
  "text/plain": ".txt",
};

function uploadFileName(file: File | Blob, supplied?: string): string {
  const extension = EXTENSION_BY_MIME[file.type];
  if (!extension) {
    throw new AppError(
      "validation",
      415,
      { mime: file.type },
      { resource: "document_upload", code: "UNSUPPORTED_DOCUMENT" },
    );
  }

  const original =
    supplied ?? ("name" in file && typeof file.name === "string" ? file.name.trim() : "");
  if (!original) return `document${extension}`;
  const safeName = original.replaceAll("\\", "/").split("/").at(-1) ?? "";
  if (!safeName.toLowerCase().endsWith(extension)) {
    throw new AppError(
      "validation",
      415,
      { mime: file.type, fileName: original },
      { resource: "document_upload", code: "DOCUMENT_EXTENSION_MISMATCH" },
    );
  }
  return safeName;
}

export async function getDocument(documentId: string): Promise<Document> {
  return apiRequest(() =>
    api.GET("/v1/documents/{document_id}", {
      params: { path: { document_id: documentId } },
    }),
  );
}

export function getDocumentContent(documentId: string): Promise<DocumentContent> {
  return apiRequest(() =>
    api.GET("/v1/documents/{document_id}/content", {
      params: { path: { document_id: documentId } },
    }),
  );
}

export async function uploadDocument(
  assetId: string,
  file: File | Blob,
  options: UploadDocumentOptions = {},
): Promise<Document> {
  const isSynthetic = options.isSynthetic ?? true;
  const fileName = uploadFileName(file, options.fileName);
  const generatedBody: GeneratedUploadBody = {
    // openapi-typescript maps OpenAPI binary to string. The actual Blob stays in
    // this adapter's serializer while path, method, and response remain generated.
    file: fileName,
    is_synthetic: isSynthetic,
  };
  const document = await apiRequest(() =>
    mutationApi.POST("/v1/assets/{asset_id}/documents", {
      params: { path: { asset_id: assetId } },
      body: generatedBody,
      bodySerializer() {
        const form = new FormData();
        form.set("file", file, fileName);
        form.set("is_synthetic", String(isSynthetic));
        return form;
      },
    }),
  );
  assertAssetId(assetId, document.asset_id);
  return document;
}

export async function updatePolicies(assetId: string, input: PolicyUpdate): Promise<Control[]> {
  const controls = await apiRequest(() =>
    mutationApi.PATCH("/v1/assets/{asset_id}/policies", {
      params: { path: { asset_id: assetId } },
      body: input,
    }),
  );
  controls.forEach((control) => assertAssetId(assetId, control.asset_id));
  return controls;
}
