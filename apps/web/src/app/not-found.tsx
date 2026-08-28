import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { StateNotice } from "@/components/states";

export default function NotFound() {
  return (
    <AppShell assetId="asset_pending" current="home" mode={null}>
      <StateNotice
        tone="warn"
        title="요청한 화면을 찾을 수 없습니다."
        detail="주소를 확인하거나 관제 홈에서 자산을 다시 선택하세요."
        tail={<Link className="btn btn-primary" href="/">홈으로</Link>}
      />
    </AppShell>
  );
}
