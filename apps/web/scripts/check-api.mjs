import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repository = resolve(webRoot, "../..");

async function filesUnder(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(child)));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

async function snapshot(targets) {
  const result = new Map();
  for (const [targetIndex, target] of targets.entries()) {
    for (const file of await filesUnder(target)) {
      const bytes = await readFile(file);
      const key = `${targetIndex}:${relative(target, file).replaceAll("\\", "/")}`;
      result.set(key, {
        display: relative(repository, file).replaceAll("\\", "/"),
        digest: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
  return result;
}

async function manifestDifferences(targets) {
  const unexpected = [];
  const missing = [];
  for (const target of targets) {
    const manifestPath = resolve(target, ".generated-files.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (
      !manifest ||
      !Array.isArray(manifest.files) ||
      manifest.files.some((file) => typeof file !== "string" || file.includes(".."))
    ) {
      throw new Error(`invalid generated ownership manifest: ${manifestPath}`);
    }
    const expected = new Set([".generated-files.json", ...manifest.files]);
    const actual = new Set(
      (await filesUnder(target)).map((file) => relative(target, file).replaceAll("\\", "/")),
    );
    for (const file of actual) {
      if (!expected.has(file)) unexpected.push(relative(repository, resolve(target, file)));
    }
    for (const file of expected) {
      if (!actual.has(file)) missing.push(relative(repository, resolve(target, file)));
    }
  }
  return {
    unexpected: unexpected.map((path) => path.replaceAll("\\", "/")).sort(),
    missing: missing.map((path) => path.replaceAll("\\", "/")).sort(),
  };
}

function changedFiles(before, after) {
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys]
    .filter((key) => before.get(key)?.digest !== after.get(key)?.digest)
    .map((key) => before.get(key)?.display ?? after.get(key)?.display ?? key)
    .sort();
}

function runOfficialGenerator() {
  return new Promise((resolvePromise, reject) => {
    const npmCli = process.env.npm_execpath;
    const executable = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
    const args = npmCli ? [npmCli, "run", "gen:api"] : ["run", "gen:api"];
    const child = spawn(executable, args, {
      cwd: webRoot,
      stdio: "inherit",
      shell: !npmCli && process.platform === "win32",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`npm run gen:api failed (${signal ?? `exit ${code}`})`));
    });
  });
}

export async function verifyGeneratedApi({
  targets = [
    resolve(repository, "contracts/generated"),
    resolve(webRoot, "src/types/generated"),
  ],
  generate = runOfficialGenerator,
} = {}) {
  const before = await snapshot(targets);
  await generate();
  const after = await snapshot(targets);
  const changed = changedFiles(before, after);
  const ownership = await manifestDifferences(targets);
  if (ownership.unexpected.length > 0 || ownership.missing.length > 0) {
    const sections = [];
    if (ownership.unexpected.length > 0) {
      sections.push(
        `unexpected generated-directory files:\n${ownership.unexpected
          .map((path) => `- ${path}`)
          .join("\n")}`,
      );
    }
    if (ownership.missing.length > 0) {
      sections.push(
        `missing generator-owned files:\n${ownership.missing
          .map((path) => `- ${path}`)
          .join("\n")}`,
      );
    }
    throw new Error(sections.join("\n"));
  }
  if (changed.length > 0) {
    throw new Error(`stale generated API artifacts:\n${changed.map((path) => `- ${path}`).join("\n")}`);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  verifyGeneratedApi().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
