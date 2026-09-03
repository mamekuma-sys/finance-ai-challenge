import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { P0_CONTROL_FIELDS } from "@/lib/document-review-state";
import {
  CHECKLIST_COVERS_P0,
  DOCUMENT_CHECKLIST,
  SAMPLE_ASSET,
} from "@/lib/registration-samples";

const canonical = {
  "issuance-terms-01.txt": new URL(
    "../../../../../data/synthetic/documents/issuance-terms-01.txt",
    import.meta.url,
  ),
  "VulnerableRwaToken.sol": new URL(
    "../../../../../chain/src/fixtures/VulnerableRwaToken.sol",
    import.meta.url,
  ),
};

describe("registration samples", () => {
  it("serves byte-identical copies of the canonical synthetic fixtures", async () => {
    for (const [name, source] of Object.entries(canonical)) {
      const served = await readFile(
        new URL(`../../../public/samples/${name}`, import.meta.url),
        "utf8",
      );
      expect(served).toBe(await readFile(source, "utf8"));
    }
  });

  it("covers every P0 control field with an example sentence from the sample document", async () => {
    expect(CHECKLIST_COVERS_P0).toBe(true);
    expect(DOCUMENT_CHECKLIST).toHaveLength(P0_CONTROL_FIELDS.length);
    for (const item of DOCUMENT_CHECKLIST) expect(item.example.trim()).not.toBe("");
  });

  it("prefills a planned supply that matches the sample document max supply", async () => {
    const text = await readFile(canonical["issuance-terms-01.txt"], "utf8");
    expect(text).toContain("100,000 토큰을 초과할 수 없다");
    expect(Number(SAMPLE_ASSET.supply)).toBe(100_000);
  });
});
