import { CodeView } from "@/components/code-view";
import { ScreenShell } from "@/components/screen-shell";
import { DEMO_CODE, DEMO_FIXTURE_VERSION } from "@/lib/demo-screens";
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
    >
      {/* CodeView는 Shiki 로딩 때문에 async다. JSX 자식으로 두면 이 서버
          컴포넌트가 결과를 기다리지 않으므로 함수로 호출해 await 한다. */}
      {await CodeView({
        source: DEMO_CODE.source,
        startLine: DEMO_CODE.startLine,
        file: DEMO_CODE.file,
        highlight: DEMO_CODE.highlight,
      })}
    </ScreenShell>
  );
}
