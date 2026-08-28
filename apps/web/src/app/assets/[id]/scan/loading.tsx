import { AppShell } from "@/components/app-shell";
import { SkeletonScreen } from "@/components/states";

export default function Loading() {
  return (
    <AppShell assetId="asset_pending" current="scan" mode={null}>
      <SkeletonScreen label="검사 단계와 결정적 근거를" />
    </AppShell>
  );
}
