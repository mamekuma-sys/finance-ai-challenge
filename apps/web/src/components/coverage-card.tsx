import { coverageOf } from "@/lib/control-coverage";
import type { EvidenceReport, ImplementationStatus } from "@/types/ui";

/**
 * 통제조건 구현 커버리지.
 *
 * 심사자가 제품 범위를 즉시 이해하게 한다. 검사하지 않은 조건을 구현됨으로
 * 세지 않는다.
 */
const ORDER = ["IMPLEMENTED", "PARTIAL", "MISSING", "UNCHECKED"];

const LEGEND: Array<{ key: keyof ReturnType<typeof coverageOf>; label: string; color: string }> = [
  { key: "implemented", label: "구현", color: "var(--safe)" },
  { key: "partial", label: "부분", color: "var(--warn)" },
  { key: "missing", label: "미구현", color: "var(--breach)" },
  { key: "unjudged", label: "미검사", color: "var(--ink-faint)" },
];

export function CoverageCard({ report }: { report: EvidenceReport }) {
  const coverage = coverageOf(report);

  const statuses = new Map<string, ImplementationStatus>();
  for (const mismatch of report.mismatches) {
    statuses.set(mismatch.constraint_id, mismatch.implementation_status);
  }

  return (
    <section aria-label="통제조건 구현 커버리지">
      <p style={{ margin: 0, fontSize: "var(--t-label)", fontWeight: 700, color: "var(--ink-soft)" }}>
        통제조건 구현 커버리지
      </p>

      <p style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "5px 0 0" }}>
        <span className="mono" style={{ fontSize: 22, fontWeight: 600 }}>
          {coverage.implemented} / {coverage.total}
        </span>
        <span style={{ fontSize: "var(--t-label)", color: "var(--ink-soft)" }}>
          구현 확인 · 불일치 {coverage.mismatched}
        </span>
      </p>

      <div className="coverage-bars">
        {/* 상태별로 묶어 보여준다. 데이터 순서대로 두면 색이 뒤섞여 읽히지 않는다. */}
        {[...report.controls]
          .sort(
            (a, b) =>
              ORDER.indexOf(statuses.get(a.constraint_id) ?? "UNCHECKED") -
              ORDER.indexOf(statuses.get(b.constraint_id) ?? "UNCHECKED"),
          )
          .map((control) => (
            <span
              key={control.constraint_id}
              className="coverage-bar"
              data-status={statuses.get(control.constraint_id) ?? "UNCHECKED"}
              title={control.field}
            />
          ))}
      </div>

      <div className="coverage-legend">
        {LEGEND.filter((entry) => coverage[entry.key] > 0).map((entry) => (
          <span key={entry.label}>
            <span className="coverage-swatch" style={{ background: entry.color }} />
            {entry.label} {coverage[entry.key]}
          </span>
        ))}
      </div>
    </section>
  );
}
