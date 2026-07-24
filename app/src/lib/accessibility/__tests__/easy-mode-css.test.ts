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

  it("기본 화면의 첫 행동 여백만 줄이고 고령자 모드의 여유 간격은 유지한다", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src", "app", "globals.css"),
      "utf8",
    );
    expect(css).toMatch(
      /\.actions-section\s*\{\s*margin-top:\s*clamp\(24px,\s*3vw,\s*36px\)/,
    );
    expect(css).toMatch(
      /\.easy-mode\s+\.actions-section\s*\{\s*margin-top:\s*clamp\(52px,\s*8vw,\s*88px\)/,
    );
  });
});
