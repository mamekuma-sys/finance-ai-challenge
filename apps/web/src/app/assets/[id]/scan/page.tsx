import { ScreenShell } from "@/components/screen-shell";
import { DEMO_FIXTURE_VERSION } from "@/lib/demo-screens";
import { parseScreenState } from "@/lib/screen-state";

export default async function ScanPage({
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
      title="컨트랙트 검증 결과"
      screenId="S4"
      url={`/assets/${id}/scan`}
      state={state}
      fixtureVersion={DEMO_FIXTURE_VERSION}
    />
  );
}
