import { File as NodeFile } from "node:buffer";

import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadDocument } from "@/lib/adapters/documents";

afterEach(() => {
  vi.unstubAllGlobals();
});

const documentResponse = {
  asset_id: "asset_01",
  document_id: "document_01",
  file_hash: "sha256",
  is_synthetic: true,
  media_type: "application/pdf",
  size_bytes: 4,
  status: "UPLOADED",
  uploaded_at: "2026-08-28T00:00:00Z",
  version: "1",
};

describe("document upload adapter", () => {
  it("sends File bytes, name, and MIME in the generated multipart request", async () => {
    let captured: Request | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        captured = request;
        return new Response(JSON.stringify(documentResponse), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const file = new NodeFile([new Uint8Array([37, 80, 68, 70])], "terms.pdf", {
      type: "application/pdf",
    });

    // node:buffer File is the runtime implementation used by Node FormData;
    // the public adapter remains typed to the browser File interface.
    await uploadDocument("asset_01", file as unknown as File);

    expect(captured?.method).toBe("POST");
    expect(captured?.url).toContain("/v1/assets/asset_01/documents");
    const form = await captured?.formData();
    const uploaded = form?.get("file");
    expect(uploaded).toBeInstanceOf(NodeFile);
    expect(uploaded).toMatchObject({ name: "terms.pdf", type: "application/pdf", size: 4 });
    const uploadedFile = uploaded as unknown as NodeFile;
    expect(Array.from(new Uint8Array(await uploadedFile.arrayBuffer()))).toEqual([37, 80, 68, 70]);
    expect(form?.get("is_synthetic")).toBe("true");
  });

  it.each([
    ["application/pdf", "document.pdf"],
    ["text/plain", "document.txt"],
  ])("gives a filename-less %s Blob a safe extension", async (mime, expectedName) => {
    let uploaded: FormDataEntryValue | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        uploaded = (await request.formData()).get("file");
        return new Response(JSON.stringify({ ...documentResponse, size_bytes: 3 }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: mime });

    await uploadDocument("asset_01", blob);

    expect(uploaded).toMatchObject({ name: expectedName, type: mime, size: 3 });
  });

  it("rejects a filename-less Blob with an unsupported MIME before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadDocument("asset_01", new Blob(["zip"], { type: "application/zip" })),
    ).rejects.toMatchObject({
      kind: "validation",
      metadata: { resource: "document_upload" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
