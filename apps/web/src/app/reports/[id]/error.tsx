"use client";

import { AppShell } from "@/components/app-shell";
import { StateNotice } from "@/components/states";

export default function ReportError({ reset }: { error: globalThis.Error; reset: () => void }) {
  return (
    <AppShell assetId="asset_pending" current="report" mode={null} variant="report">
      <StateNotice
        tone="breach"
        title="리포트를 불러오지 못했습니다."
        headingLevel={1}
        detail="내부 오류 정보는 숨겼습니다. 저장된 검사 결과는 영향을 받지 않습니다."
        tail={<button className="btn" type="button" onClick={reset}>다시 시도</button>}
      />
    </AppShell>
  );
}
