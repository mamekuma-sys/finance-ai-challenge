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

  it("두 숫자가 왜 다른지 화면에서 설명한다", async () => {
    const scan = await read("scan");

    // 코드 기준 수와 통제조건 기준 수의 관계를 문장으로 잇는다.
    expect(scan).toContain("코드 결함 {report.code_findings.length}건이 통제조건 {coverage.mismatched}개를 위반");
    // 두 수가 같을 때는 사족을 붙이지 않는다.
    expect(scan).toContain("report.code_findings.length !== coverage.mismatched");
    // 위반이 0건이면 문장 자체를 두지 않는다.
    expect(scan).toContain("{coverage.mismatched > 0 ?");
  });

  it("결함이 없어도 무엇을 얼마나 검사했는지 남긴다", async () => {
    const scan = await read("scan");

    // PASS 분기가 문장 두 줄로 끝나면 검사가 돌지 않은 화면과 구분되지 않는다.
    const pass = scan.split('verdict === "PASS"')[1].split("      ) : (")[0];
    expect(pass).toContain("<RiskRuler");
    expect(pass).toContain("통제조건 {report.controls.length}개 중 위반");
    expect(pass).toContain("코드 검사 룰");
    // 검사 범위 밖 조건이 몇 개인지도 함께 밝힌다.
    expect(pass).toContain("isRuleMappedControlField");
    expect(pass).toContain("P0 범위 밖");
  });
});
