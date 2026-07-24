export interface TimingSummary {
  latest_ms: number | null;
  sample_count: number;
  p95_ms: number | null;
}

const MAX_SESSION_SAMPLES = 200;

export function elapsedMilliseconds(start: number, end: number): number {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error("유효한 시작·종료 시각이 필요합니다.");
  }
  return Math.round((end - start) * 100) / 100;
}

export function nearestRankPercentile(
  samples: readonly number[],
  percentile: number,
): number | null {
  if (samples.length === 0) {
    return null;
  }
  if (percentile <= 0 || percentile > 1) {
    throw new Error("percentile은 0보다 크고 1 이하여야 합니다.");
  }
  if (samples.some((sample) => !Number.isFinite(sample) || sample < 0)) {
    throw new Error("측정 표본은 0 이상의 유한한 수여야 합니다.");
  }

  const sorted = samples.toSorted((left, right) => left - right);
  const rank = Math.ceil(percentile * sorted.length);
  return sorted[rank - 1];
}

export function appendTimingSample(
  samples: readonly number[],
  sample: number,
): number[] {
  if (!Number.isFinite(sample) || sample < 0) {
    throw new Error("측정 표본은 0 이상의 유한한 수여야 합니다.");
  }
  return [...samples, Math.round(sample * 100) / 100].slice(
    -MAX_SESSION_SAMPLES,
  );
}

export function summarizeTimings(
  samples: readonly number[],
): TimingSummary {
  return {
    latest_ms: samples.at(-1) ?? null,
    sample_count: samples.length,
    p95_ms: nearestRankPercentile(samples, 0.95),
  };
}
