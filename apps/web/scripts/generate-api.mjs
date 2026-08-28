import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repository = resolve(webRoot, "../..");
const backendRoot = resolve(repository, "services/backend");
const pythonCandidates = [
  process.env.RWA_GUARD_PYTHON,
  resolve(backendRoot, ".venv/bin/python"),
  resolve(backendRoot, ".venv/Scripts/python.exe"),
  "python3",
  "python",
].filter(Boolean);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`${command} exited with status ${result.status}`);
  }
}

function findPython() {
  for (const candidate of pythonCandidates) {
    if (candidate.includes("/") && !existsSync(candidate)) continue;
    const probe = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (!probe.error && probe.status === 0) return candidate;
  }
  throw new Error("Python 3 with the backend dependencies is required to generate OpenAPI.");
}

const python = findPython();
const pythonPath = [resolve(backendRoot, "src"), process.env.PYTHONPATH]
  .filter(Boolean)
  .join(delimiter);
run(python, [resolve(backendRoot, "scripts/export_schemas.py")], {
  cwd: repository,
  env: { ...process.env, PYTHONPATH: pythonPath },
});

const generatedTypes = resolve(webRoot, "src/types/generated/api.ts");
mkdirSync(dirname(generatedTypes), { recursive: true });
run(
  process.execPath,
  [
    resolve(webRoot, "node_modules/openapi-typescript/bin/cli.js"),
    resolve(repository, "contracts/generated/openapi.json"),
    "--output",
    generatedTypes,
  ],
  { cwd: webRoot },
);
writeFileSync(
  resolve(webRoot, "src/types/generated/.generated-files.json"),
  `${JSON.stringify({ files: ["api.ts"] }, null, 2)}\n`,
  "utf8",
);
