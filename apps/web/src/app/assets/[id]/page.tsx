import { ScreenShell } from "@/components/screen-shell";
import { DEMO_FIXTURE_VERSION } from "@/lib/demo-screens";
import { parseScreenState } from "@/lib/screen-state";

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { id } = await params;
  const state = parseScreenState((await searchParams).state);

  return (
    <ScreenShell
      title="자산 상세"
      screenId="S5"
      url={`/assets/${id}`}
      state={state}
      fixtureVersion={DEMO_FIXTURE_VERSION}
    />
  );
}
