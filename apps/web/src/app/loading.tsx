import { AppShell } from "@/components/app-shell";
import { SkeletonScreen } from "@/components/states";

export default function Loading() {
  return (
    <AppShell assetId="asset_pending" current="home" mode={null} variant="theater">
      <SkeletonScreen label="관제 현황을" />
    </AppShell>
  );
}
