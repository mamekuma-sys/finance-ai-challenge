import Link from "next/link";
import type { ReactNode } from "react";

import { ScreenStateNotice } from "@/components/screen-state-notice";
import { assetNameOf, navigationFor } from "@/lib/asset-directory";
import type { ScreenKey } from "@/lib/asset-directory";
import type { ScreenState } from "@/lib/screen-state";
import type { EvidenceMode } from "@/types/contracts";

/**
 * 모든 화면의 유일한 chrome.
 *
 * 브랜드 헤더는 여기 한 곳에만 있다. 화면 ID나 route 경로 같은 내부
 * 표기는 사용자에게 노출하지 않는다.
 */
const MODE_LABEL: Record<EvidenceMode, string> = {
  LIVE: "실시간",
  REPLAY: "재현",
};

export function AppShell({
  title,
  assetId,
  current,
  blockNumber,
  mode,
  state,
  fixtureVersion,
  children,
}: {
  title: string;
  assetId: string;
  current?: ScreenKey;
  blockNumber: number;
  mode: EvidenceMode;
  state: ScreenState;
  fixtureVersion?: string;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <header className="app-topbar" data-testid="topbar">
        <span className="app-brand">RWA GUARD</span>
        <span className="app-asset">{assetNameOf(assetId)}</span>
        <span className="app-block">BLOCK {blockNumber.toLocaleString("en-US")}</span>
        {/* 색만으로 구분하지 않는다. 모드는 항상 글자로 밝힌다. */}
        <span className="app-mode" data-mode={mode}>
          {MODE_LABEL[mode]}
        </span>
      </header>

      <nav className="app-nav" aria-label="주요 화면">
        {navigationFor(assetId, current).map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.current ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="app-main">
        {/* 화면마다 h1은 하나다. 중첩 패널이 각자 h1을 갖지 않게 여기서 소유한다. */}
        <h1 className="screen-title">{title}</h1>
        <ScreenStateNotice state={state} fixtureVersion={fixtureVersion} />
        {children}
      </main>
    </div>
  );
}
