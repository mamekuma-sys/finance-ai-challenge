import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const files = {
  scan: new URL("../../app/assets/[id]/scan/page.tsx", import.meta.url),
  coverage: new URL("../../components/coverage-card.tsx", import.meta.url),
  ledger: new URL("../control-ledger.ts", import.meta.url),
  card: new URL("../../components/control-card.tsx", import.meta.url),
};

async function read(key: keyof typeof files) {
  return readFile(files[key], "utf8");
}

describe("집계 문구", () => {
  it("통제조건 기준과 코드 기준의 단위를 문구에 드러낸다", async () => {
    const scan = await read("scan");

    // 4와 3이 나란히 나올 때 서로 다른 단위임을 문구가 말해야 한다.
    expect(scan).toContain("통제조건 {report.controls.length}개 중 위반");
    expect(scan).toContain("코드 결함 {report.code_findings.length}건");
  });

  it("옛 용어 '미구현'을 어느 화면에도 남기지 않는다", async () => {
    for (const key of Object.keys(files) as (keyof typeof files)[]) {
      const source = await read(key);
      expect(source.includes('"미구현"')).toBe(false);
      expect(/미구현\s*\{/.test(source)).toBe(false);
    }
  });

  it("MISSING을 부르는 이름이 모든 화면에서 '통제 공백'이다", async () => {
    for (const key of ["ledger", "card", "coverage"] as const) {
      expect(await read(key)).toContain("통제 공백");
    }
  });
});
