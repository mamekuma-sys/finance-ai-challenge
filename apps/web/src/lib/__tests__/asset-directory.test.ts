import { describe, expect, it } from "vitest";

import { assetNameOf, navigationFor } from "../asset-directory";

describe("assetNameOf", () => {
  it("shows the human asset name rather than the raw identifier", () => {
    expect(assetNameOf("asset_synthetic_hanriver_01")).toBe("Han River Office 01");
  });

  it("falls back to the identifier when the asset is unknown", () => {
    expect(assetNameOf("asset_unmapped")).toBe("asset_unmapped");
  });
});

describe("navigationFor", () => {
  it("offers every screen a reviewer needs to walk the evidence path", () => {
    const items = navigationFor("asset_x");

    expect(items.map((item) => item.label)).toEqual([
      "관제",
      "발행조건",
      "검증 결과",
      "자산",
      "리포트",
    ]);
  });

  it("points each tab at a real route for the given asset", () => {
    const items = navigationFor("asset_x");

    expect(items.map((item) => item.href)).toEqual([
      "/",
      "/assets/asset_x/document",
      "/assets/asset_x/scan",
      "/assets/asset_x",
      "/reports/report_demo_01",
    ]);
  });

  it("marks the current screen so the reviewer knows where they are", () => {
    const items = navigationFor("asset_x", "scan");
    const current = items.filter((item) => item.current);

    expect(current).toHaveLength(1);
    expect(current[0].label).toBe("검증 결과");
  });

  it("marks nothing current on a screen outside the tab set", () => {
    expect(navigationFor("asset_x").every((item) => !item.current)).toBe(true);
  });
});
