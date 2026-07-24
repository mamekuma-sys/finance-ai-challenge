import { describe, expect, it } from "vitest";

import {
  appendTimingSample,
  elapsedMilliseconds,
  nearestRankPercentile,
  summarizeTimings,
} from "../rule0-timing";

describe("Rule 0 브라우저 세션 성능 계측", () => {
  it("nearest-rank 방식으로 p95를 계산한다", () => {
    expect(nearestRankPercentile([], 0.95)).toBeNull();
    expect(nearestRankPercentile([9], 0.95)).toBe(9);
    expect(
      nearestRankPercentile(
        Array.from({ length: 20 }, (_, index) => index + 1),
        0.95,
      ),
    ).toBe(19);
    expect(
      nearestRankPercentile(
        Array.from({ length: 21 }, (_, index) => index + 1),
        0.95,
      ),
    ).toBe(20);
  });

  it("실측 구간과 최근값·표본 수·p95를 순수 계산한다", () => {
    const samples = [12, 7, 22].reduce<number[]>(
      (current, sample) => appendTimingSample(current, sample),
      [],
    );
    expect(elapsedMilliseconds(10.111, 20.555)).toBe(10.44);
    expect(summarizeTimings(samples)).toEqual({
      latest_ms: 22,
      sample_count: 3,
      p95_ms: 22,
    });
  });
});
