import { AppShell } from "@/components/app-shell";
import { SkeletonScreen } from "@/components/states";

export default function Loading() {
  return (
    <AppShell assetId="asset_pending" current="asset" mode={null}>
      <SkeletonScreen label="자산 정보를" />
    </AppShell>
  );
}
