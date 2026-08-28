import { AppShell } from "@/components/app-shell";
import { SkeletonScreen } from "@/components/states";

export default function Loading() {
  return (
    <AppShell assetId="asset_pending" current="controls" mode={null}>
      <SkeletonScreen label="문서 원문과 통제조건을" />
    </AppShell>
  );
}
