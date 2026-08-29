"use client";

import { AppShell } from "@/components/app-shell";
import { StateNotice } from "@/components/states";

/**
 * 세그먼트 error 경계.
 *
 * 원본 오류 문구는 화면에 내보내지 않는다. stack trace, SQL, 내부 경로가
 * 사용자에게 노출되면 안 된다.
 */
export default function ScreenError({ reset }: { error: globalThis.Error; reset: () => void }) {
  return (
    <AppShell assetId="asset_pending" current="asset" mode={null}>
      <StateNotice
        tone="breach"
        title="자산 정보를 불러오지 못했습니다."
        headingLevel={1}
        detail="분석 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."
        tail={
          <button className="btn" type="button" onClick={reset}>
            다시 시도
          </button>
        }
      />
    </AppShell>
  );
}
