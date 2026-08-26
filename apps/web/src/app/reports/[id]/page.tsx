import { ScreenShell } from "@/components/screen-shell";
import { DEMO_FIXTURE_VERSION } from "@/lib/demo-screens";
import { parseScreenState } from "@/lib/screen-state";

export default async function ReportPage({
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
      title="증적 리포트"
      screenId="S6"
      url={`/reports/${id}`}
      state={state}
      fixtureVersion={DEMO_FIXTURE_VERSION}
    />
  );
}
