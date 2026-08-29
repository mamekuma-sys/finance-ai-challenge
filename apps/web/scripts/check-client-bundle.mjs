import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const staticRoot = join(process.cwd(), ".next", "static");
const forbidden = ["http://api:8000"];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    }))
  ).flat();
}

for (const path of await filesUnder(staticRoot)) {
  const content = await readFile(path, "utf8");
  for (const marker of forbidden) {
    if (content.includes(marker)) {
      throw new Error(`server-only API value leaked into client bundle: ${marker}`);
    }
  }
}

console.log("client bundle server-only boundary passed.");
