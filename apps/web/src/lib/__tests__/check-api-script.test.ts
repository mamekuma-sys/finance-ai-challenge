import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

// The production checker is an executable ESM script shared with this behavior test.
// @ts-expect-error JavaScript script intentionally has no declaration file.
import { verifyGeneratedApi } from "../../../scripts/check-api.mjs";

const temporaryDirectories: string[] = [];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "rwa-check-api-"));
  temporaryDirectories.push(root);
  const contracts = join(root, "contracts-generated");
  const types = join(root, "types-generated");
  await mkdir(contracts);
  await mkdir(types);
  await writeFile(join(contracts, "openapi.json"), '{"version":1}\n');
  await writeFile(join(types, "api.ts"), "export type Version = 1;\n");
  await writeFile(
    join(contracts, ".generated-files.json"),
    `${JSON.stringify({ files: ["openapi.json"] }, null, 2)}\n`,
  );
  await writeFile(
    join(types, ".generated-files.json"),
    `${JSON.stringify({ files: ["api.ts"] }, null, 2)}\n`,
  );
  return { contracts, types };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("verifyGeneratedApi", () => {
  test("accepts generated files that were already modified but regenerate byte-identically", async () => {
    const paths = await fixture();
    const before = await readFile(join(paths.types, "api.ts"));

    await expect(
      verifyGeneratedApi({
        targets: [paths.contracts, paths.types],
        generate: async () => {
          await writeFile(join(paths.contracts, "openapi.json"), '{"version":1}\n');
          await writeFile(join(paths.types, "api.ts"), before);
        },
      }),
    ).resolves.toBeUndefined();
  });

  test("rejects stale generated files when official generation changes bytes", async () => {
    const paths = await fixture();

    await expect(
      verifyGeneratedApi({
        targets: [paths.contracts, paths.types],
        generate: async () => {
          await writeFile(join(paths.contracts, "openapi.json"), '{"version":2}\n');
        },
      }),
    ).rejects.toThrow(/stale generated API artifacts[\s\S]*openapi\.json/);
  });

  test("detects added and removed generated files", async () => {
    const paths = await fixture();

    await expect(
      verifyGeneratedApi({
        targets: [paths.contracts, paths.types],
        generate: async () => {
          await rm(join(paths.types, "api.ts"));
          await writeFile(join(paths.types, "extra.ts"), "export {};\n");
        },
      }),
    ).rejects.toThrow(/api\.ts[\s\S]*extra\.ts|extra\.ts[\s\S]*api\.ts/);
  });

  test("rejects a pre-existing rogue file untouched by generation", async () => {
    const paths = await fixture();
    await writeFile(join(paths.contracts, "rogue.json"), '{"not":"generated"}\n');

    await expect(
      verifyGeneratedApi({
        targets: [paths.contracts, paths.types],
        generate: async () => {},
      }),
    ).rejects.toThrow(/unexpected generated-directory files[\s\S]*rogue\.json/);
  });
});
