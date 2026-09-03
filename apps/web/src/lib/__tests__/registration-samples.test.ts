import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { P0_CONTROL_FIELDS } from "@/lib/document-review-state";
import {
  CHECKLIST_COVERS_P0,
  DOCUMENT_CHECKLIST,
  SAMPLE_ASSET,
  SAMPLE_SCENARIOS,
  mergeSoliditySources,
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
  "VulnerableOracle.sol": new URL(
    "../../../../../chain/src/fixtures/VulnerableOracle.sol",
    import.meta.url,
  ),
  "FixedRwaToken.sol": new URL(
    "../../../../../chain/src/fixtures/FixedRwaToken.sol",
    import.meta.url,
  ),
  "FixedOracle.sol": new URL(
    "../../../../../chain/src/fixtures/FixedOracle.sol",
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

  it("두 시나리오가 토큰과 오라클을 함께 넣는다", () => {
    expect(Object.keys(SAMPLE_SCENARIOS)).toEqual(["vulnerable", "clean"]);
    for (const scenario of Object.values(SAMPLE_SCENARIOS)) {
      // 오라클이 빠지면 P0 룰 3종 중 하나가 판정 대상에서 사라진다.
      expect(scenario.contractPaths).toHaveLength(2);
      expect(scenario.contractPaths.some((path) => /Oracle\.sol$/.test(path))).toBe(true);
    }
  });

  it("병합 결과가 solc가 받는 단일 컴파일 단위다", async () => {
    for (const scenario of Object.values(SAMPLE_SCENARIOS)) {
      const texts = await Promise.all(
        scenario.contractPaths.map((path) =>
          readFile(new URL(`../../../public${path}`, import.meta.url), "utf8"),
        ),
      );
      const merged = mergeSoliditySources(
        scenario.contractPaths.map((path, index) => ({ path, text: texts[index] })),
      );

      // SPDX가 둘이면 solc가 거부한다. pragma는 파일마다 남겨야 한다.
      expect(merged.match(/SPDX-License-Identifier/g)).toHaveLength(1);
      expect(merged.match(/pragma solidity/g)).toHaveLength(2);
      expect(merged).toContain("// BEGIN SOURCE:");
    }
  });

  it("취약 시나리오에만 가드가 없다", async () => {
    const read = async (path: string) =>
      readFile(new URL(`../../../public${path}`, import.meta.url), "utf8");

    expect(await read(SAMPLE_SCENARIOS.vulnerable.contractPaths[0])).not.toContain(
      "revert Unauthorized()",
    );
    const clean = await read(SAMPLE_SCENARIOS.clean.contractPaths[0]);
    expect(clean).toContain("revert Unauthorized()");
    expect(clean).toContain("MaxSupplyExceeded");
  });
});
