import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("고령자 모드 CSS 하한", () => {
  it("본문 20px와 핵심 행동 56px를 클래스 규칙으로 고정한다", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src", "app", "globals.css"),
      "utf8",
    );
    expect(css).toMatch(
      /\.easy-mode\s*\{[\s\S]*?font-size:\s*20px/,
    );
    expect(css).toMatch(
      /\.easy-mode\s+\.primary-action,[\s\S]*?min-height:\s*56px/,
    );
    expect(css).toMatch(/\.primary-action,[\s\S]*?min-height:\s*48px/);
  });
});
