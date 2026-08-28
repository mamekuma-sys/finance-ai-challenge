import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const cssPath = new URL("../../app/globals.css", import.meta.url);

describe("Assurance Ledger CSS contract", () => {
  it("keeps semantic colors, keyboard focus, motion safety, and responsive gates", async () => {
    const css = await readFile(cssPath, "utf8");

    for (const token of [
      "--paper: #e8ece9",
      "--surface: #f7f8f6",
      "--ink: #172126",
      "--verify: #2148c9",
      "--safe: #27725b",
      "--warn: #85500d",
      "--breach: #9d2922",
    ]) {
      expect(css.toLowerCase()).toContain(token);
    }
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/max-width:\s*1100px/);
    expect(css).toMatch(/max-width:\s*1024px/);
    expect(css).toMatch(/max-width:\s*720px/);
    expect(css).toMatch(/@media\s+print/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });

  it("defines the submission-grade shell and evidence interaction contracts", async () => {
    const css = await readFile(cssPath, "utf8");

    for (const contract of [
      "--carbon:",
      "--hairline:",
      "--rule:",
      "--t-verdict:",
      ".skip-link",
      ".interactive",
      ".verdict-display",
      ".selected-row",
      ".sticky-panel",
      ".hash-overflow",
      ".code-overflow",
      ".theater-grid",
      ".theater-verdict",
      ".theater-evidence",
      ".theater-actions",
      '[data-variant="theater"]',
      '[data-variant="report"]',
    ]) {
      expect(css).toContain(contract);
    }

    expect(css).toMatch(/@media\s*\(min-width:\s*1366px\)/);
    expect(css).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.spine-inline/);
    expect(css).toMatch(/@media\s*\(max-width:\s*1024px\)[\s\S]*\.spine-drawer-fallback/);
    expect(css).toMatch(
      /@media\s*\(max-width:\s*720px\)[\s\S]*\.theater-verdict[\s\S]*order:\s*1[\s\S]*\.theater-evidence[\s\S]*order:\s*2[\s\S]*\.theater-actions[\s\S]*order:\s*3/,
    );
    expect(css).toMatch(
      /@media\s+print[\s\S]*\[data-variant="report"\][\s\S]*print-color-adjust:\s*exact/,
    );
    expect(css).toMatch(
      /@media\s+print[\s\S]*\.rail,[\s\S]*\.ledger-header,[\s\S]*\.assetbar-actions,[\s\S]*display:\s*none\s*!important/,
    );
    expect(css).toMatch(
      /@media\s+print[\s\S]*\.audit-document,[\s\S]*\.report-lineage,[\s\S]*visibility:\s*visible/,
    );
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*scroll-behavior:\s*auto/,
    );
  });

  it("keeps the tablet navigation row content-sized", async () => {
    const css = await readFile(cssPath, "utf8");

    expect(css).toMatch(
      /@media\s*\(max-width:\s*1100px\)[\s\S]*\.ledger-app,[\s\S]*\.app\s*\{[\s\S]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/,
    );
  });

  it("keeps semantic text tokens at WCAG AA contrast", async () => {
    const css = await readFile(cssPath, "utf8");
    const variables = Object.fromEntries(
      [...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((match) => [
        match[1],
        match[2],
      ]),
    );
    const luminance = (hex: string) => {
      const channels = hex.slice(1).match(/.{2}/g)!.map((value) => {
        const channel = Number.parseInt(value, 16) / 255;
        return channel <= 0.03928
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (foreground: string, background: string) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    for (const [foreground, background] of [
      ["warn", "warn-wash"],
      ["breach", "breach-wash"],
      ["verify", "accent-wash"],
      ["ink-faint", "surface"],
    ]) {
      expect(
        contrast(variables[foreground], variables[background]),
        `${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
