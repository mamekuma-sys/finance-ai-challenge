import type { ReactNode } from "react";

import type { EvidenceMode } from "@/types/contracts";

/**
 * Assurance Ledger 3분할 셸.
 *
 * 구조 근거는 docs/architecture/stack-and-visual-direction.md §7.3이다.
 * 왼쪽 220px 자산 원장, 중앙 유동폭, 오른쪽 320px Evidence Spine,
 * 하단 이벤트 원장. 1024px 이하에서는 Spine이 아래로 내려간다.
 */
const MODE_LABEL: Record<EvidenceMode, string> = {
  LIVE: "실시간",
  REPLAY: "재현",
};

export function ConsoleLayout({
  ledger,
  field,
  spine,
  events,
  blockNumber,
  mode,
}: {
  ledger: ReactNode;
  field: ReactNode;
  spine: ReactNode;
  events: ReactNode;
  blockNumber: number;
  mode: EvidenceMode;
}) {
  return (
    <div className="console">
      <div className="console-topbar" data-testid="topbar">
        <span className="console-brand">RWA GUARD</span>
        <span className="console-block">BLOCK {blockNumber.toLocaleString("en-US")}</span>
        {/* 색만으로 구분하지 않는다. 모드는 항상 글자로 밝힌다. */}
        <span className="console-mode" data-mode={mode}>
          {mode} · {MODE_LABEL[mode]}
        </span>
      </div>

      <div className="console-body">
        <section className="console-ledger" aria-label="자산 원장">
          {ledger}
        </section>
        <section className="console-field" aria-label="위험 필드">
          {field}
        </section>
        <section className="console-spine" aria-label="증거 척추">
          {spine}
        </section>
      </div>

      <section className="console-events" aria-label="이벤트 원장">
        {events}
      </section>
    </div>
  );
}
