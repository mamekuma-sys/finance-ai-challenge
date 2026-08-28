import Link from "next/link";
import type { ReactNode } from "react";

import { EvidenceDrawer } from "@/components/evidence-drawer";
import { Icon } from "@/components/icon";
import { OperatorUnlockDialog } from "@/components/operator-unlock-dialog";
import { assetNameOf, navigationFor } from "@/lib/asset-directory";
import type { ScreenKey } from "@/lib/asset-directory";
import type { components } from "@/types/generated/api";
import type { EvidenceMode } from "@/types/ui";

/**
 * 모든 화면의 유일한 chrome.
 *
 * 브랜드는 여기 한 곳에만 있다. 화면 ID나 route 경로 같은 내부 표기는
 * 사용자에게 노출하지 않는다.
 */
const NAV_ICON: Record<ScreenKey, ReactNode> = {
  home: Icon.grid(),
  controls: Icon.doc(),
  scan: Icon.code(),
  asset: Icon.building(),
  report: Icon.clipboard(),
};

const MODE_LABEL: Record<EvidenceMode, string> = {
  LIVE: "LIVE · 실시간",
  REPLAY: "REPLAY · 재현 데이터",
};

const FRESHNESS_LABEL: Record<components["schemas"]["DataFreshness"], string> = {
  FRESH: "최신",
  AGING: "갱신 지연",
  STALE: "오래됨",
  INVALID: "유효하지 않음",
};

export type AppShellVariant = "theater" | "workbench" | "report";

export interface AppShellProps {
  assetId: string;
  assetName?: string | null;
  assetMeta?: ReactNode;
  current: ScreenKey;
  reportId?: string | null;
  blockNumber?: number | null;
  mode: EvidenceMode | null;
  fixtureVersion?: string | null;
  freshness?: components["schemas"]["DataFreshness"] | null;
  isSynthetic?: boolean;
  actions?: ReactNode;
  assetLedger?: ReactNode;
  riskField?: ReactNode;
  evidenceAside?: ReactNode;
  eventLedger?: ReactNode;
  children?: ReactNode;
  variant?: AppShellVariant;
}

export function AppShell({
  assetId,
  assetName,
  assetMeta,
  current,
  reportId,
  blockNumber,
  mode,
  fixtureVersion,
  freshness,
  isSynthetic = true,
  actions,
  assetLedger,
  riskField,
  evidenceAside,
  eventLedger,
  children,
  variant = "workbench",
}: AppShellProps) {
  return (
    <div className="ledger-app" data-variant={variant}>
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <nav className="rail" aria-label="주요 화면">
        <Link className="rail-brand interactive" href="/">
          {Icon.shield()}
          RWA Guard
        </Link>

        <div className="rail-nav">
          {navigationFor(assetId, reportId).map((item) => (
            <Link
              key={item.key}
              className="interactive"
              href={item.href}
              aria-current={item.key === current ? "page" : undefined}
            >
              {NAV_ICON[item.key]}
              {item.label}
            </Link>
          ))}
        </div>

        <div className="rail-foot">
          <div className="rail-key">KAIA KAIROS</div>
          <div className="rail-value tabular">
            {blockNumber != null ? blockNumber.toLocaleString("en-US") : "—"}
          </div>
        </div>
      </nav>

      <div className="ledger-frame" data-variant={variant}>
        <header className="ledger-header">
          <div className="ledger-header-asset">
            <span className="assetbar-name">{assetNameOf(assetId, assetName)}</span>
            {assetMeta ? <span className="assetbar-meta">{assetMeta}</span> : null}
          </div>
          <div className="ledger-header-status" aria-label="데이터 상태">
            {isSynthetic ? <span className="status-mark">◆ SYNTHETIC · 합성 데모</span> : null}
            {mode ? (
              <span className="status-mark" data-mode={mode}>
                {mode === "REPLAY" ? Icon.replay() : null}
                {MODE_LABEL[mode]}
                {mode === "REPLAY" ? ` · fixture ${fixtureVersion ?? "미제공"}` : ""}
              </span>
            ) : (
              <span className="status-mark" data-mode="NONE">증거 없음</span>
            )}
            <span className="status-mark" data-freshness={freshness ?? "UNKNOWN"}>
              최신성 · {freshness ? FRESHNESS_LABEL[freshness] : "미제공"}
            </span>
            <OperatorUnlockDialog />
            {evidenceAside ? <EvidenceDrawer>{evidenceAside}</EvidenceDrawer> : null}
            {actions ? <div className="assetbar-actions">{actions}</div> : null}
          </div>
        </header>

        <div
          className="ledger-workbench"
          data-variant={variant}
          data-assets={assetLedger ? "true" : undefined}
          data-evidence={evidenceAside ? "true" : undefined}
        >
          {assetLedger ? (
            <aside className="asset-ledger-slot" aria-label="자산 원장">
              {assetLedger}
            </aside>
          ) : null}
          <main id="main-content" className="screen risk-field-slot" tabIndex={-1}>
            {riskField ?? children}
          </main>
          {evidenceAside ? (
            <aside className="evidence-aside-slot" aria-label="증거 근거">
              {evidenceAside}
            </aside>
          ) : null}
          {eventLedger ? (
            <section className="event-ledger-slot" aria-label="이벤트 원장">
              {eventLedger}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
