import { AppShell } from "@/components/app-shell";
import { SkeletonScreen } from "@/components/states";

export default function Loading() {
  return (
    <AppShell assetId="asset_pending" current="report" mode={null} variant="report">
      <SkeletonScreen label="증거 리포트를" />
    </AppShell>
  );
}
