import Link from "next/link";

import { assetNameOf } from "@/lib/asset-directory";
import type { Severity } from "@/types/contracts";

/**
 * 좌측 자산 원장.
 *
 * FR-11 수용 기준: 자산을 누르면 자산 상세로 이동한다. 심사자가 10초 안에
 * 위험 자산을 찾고 바로 들어갈 수 있어야 하므로 행 전체가 링크다.
 */
export interface AssetLedgerRow {
  assetId: string;
  highestSeverity: Severity | null;
  criticalCount: number;
  highCount: number;
}

const MARKER: Record<Severity, string> = {
  CRITICAL: "▲",
  HIGH: "▲",
  MEDIUM: "■",
  LOW: "●",
  INFO: "○",
};

export function AssetLedger({ rows }: { rows: readonly AssetLedgerRow[] }) {
  if (rows.length === 0) {
    return <p className="ledger-empty">등록된 자산이 없습니다.</p>;
  }

  return (
    <ul className="ledger-list">
      {rows.map((row) => (
        <li key={row.assetId}>
          <Link className="ledger-row" href={`/assets/${row.assetId}`}>
            <span className="ledger-marker" data-severity={row.highestSeverity ?? "INFO"}>
              {/* 색만으로 의미를 전달하지 않는다. 기호와 등급 문자를 함께 둔다. */}
              {row.highestSeverity ? MARKER[row.highestSeverity] : "○"}
            </span>
            <span className="ledger-name">{assetNameOf(row.assetId)}</span>
            <span className="ledger-meta">
              {row.highestSeverity ?? "판정 없음"}
              {row.criticalCount > 0 ? ` · 확정 ${row.criticalCount}건` : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
