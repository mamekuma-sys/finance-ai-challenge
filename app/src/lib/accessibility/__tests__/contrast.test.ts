import { describe, expect, it } from "vitest";

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  return (
    0.2126 * channel(Number.parseInt(value.slice(0, 2), 16)) +
    0.7152 * channel(Number.parseInt(value.slice(2, 4), 16)) +
    0.0722 * channel(Number.parseInt(value.slice(4, 6), 16))
  );
}

function contrast(left: string, right: string): number {
  const values = [luminance(left), luminance(right)].toSorted(
    (a, b) => b - a,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("디자인 토큰 WCAG 2.2 AA 대비", () => {
  it.each([
    ["라이트 본문", "#17212B", "#F5F7FA", 4.5],
    ["라이트 보조문", "#495866", "#FFFFFF", 4.5],
    ["라이트 골드 버튼", "#2B2100", "#F4C95D", 4.5],
    ["라이트 금지", "#7F1D1D", "#FFF1F2", 4.5],
    ["다크 본문", "#F4F7F9", "#101820", 4.5],
    ["다크 보조문", "#B8C2CC", "#17232E", 4.5],
    ["다크 금지", "#FFB4B4", "#35191F", 4.5],
    ["라이트 포커스", "#0B5FCC", "#FFFFFF", 3],
    ["다크 포커스", "#82B7FF", "#17232E", 3],
  ])("%s 대비가 최소 기준을 통과한다", (_name, fg, bg, minimum) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(minimum);
  });
});
