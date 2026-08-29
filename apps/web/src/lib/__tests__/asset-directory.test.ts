import { describe, expect, it } from "vitest";

import { assetNameOf, formatKst, navigationFor } from "../asset-directory";

describe("assetNameOf", () => {
  it("prefers the name the server gave", () => {
    expect(assetNameOf("asset_x", "강남 오피스")).toBe("강남 오피스");
  });

  it("falls back to the known demo asset name", () => {
    expect(assetNameOf("asset_synthetic_hanriver_01")).toBe("Han River Office 01");
  });

  it("shows the identifier only when nothing better exists", () => {
    expect(assetNameOf("asset_unknown")).toBe("asset_unknown");
  });
});

describe("navigationFor", () => {
  it("reaches every screen of the evidence path", () => {
    expect(navigationFor("asset_x").map((item) => item.href)).toEqual([
      "/",
      "/assets/asset_x/document",
      "/assets/asset_x/scan",
      "/assets/asset_x",
      "/reports/report_pending",
    ]);
  });
});

describe("formatKst — 감사 문서는 시간대를 섞지 않는다", () => {
  it("renders a UTC instant in Korean local time with an explicit zone", () => {
    expect(formatKst("2026-08-25T03:00:08Z")).toBe("2026-08-25 12:00:08 KST");
  });

  it("can drop seconds where they add noise", () => {
    expect(formatKst("2026-08-25T03:00:08Z", false)).toBe("2026-08-25 12:00 KST");
  });

  it("shows a dash rather than an invalid date", () => {
    expect(formatKst(null)).toBe("—");
    expect(formatKst("not-a-date")).toBe("—");
  });
});
