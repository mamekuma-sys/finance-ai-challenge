import type { ReactNode } from "react";

import { ScreenStateNotice } from "@/components/screen-state-notice";
import type { ScreenState } from "@/lib/screen-state";

/**
 * P0 화면 5개의 공통 껍데기.
 *
 * 화면 제목, 상태 배너, 본문 자리를 고정한다. 실제 데이터 배선은
 * backend endpoint가 확정된 뒤에 붙인다.
 */
export function ScreenShell({
  title,
  screenId,
  url,
  state,
  fixtureVersion,
  children,
}: {
  title: string;
  screenId: string;
  url: string;
  state: ScreenState;
  fixtureVersion?: string;
  children?: ReactNode;
}) {
  return (
    <main className="screen-shell">
      <header className="screen-head">
        <p className="screen-meta">
          <span className="screen-id">{screenId}</span>
          <span className="screen-url">{url}</span>
        </p>
        <h1>{title}</h1>
      </header>
      <ScreenStateNotice state={state} fixtureVersion={fixtureVersion} />
      {children}
    </main>
  );
}
