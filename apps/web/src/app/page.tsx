import { AssuranceLedger } from "@/components/assurance-ledger";
import { ConsoleLayout } from "@/components/console-layout";
import { EvidenceSpine } from "@/components/evidence-spine";
import { ScreenShell } from "@/components/screen-shell";
import { demoFinding } from "@/lib/demo-finding";
import { DEMO_BLOCK_NUMBER, DEMO_FIXTURE_VERSION, DEMO_MODE } from "@/lib/demo-screens";
import { parseScreenState } from "@/lib/screen-state";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const state = parseScreenState((await searchParams).state);

  return (
    <ScreenShell
      title="관제 홈"
      screenId="S1"
      url="/"
      state={state}
      fixtureVersion={DEMO_FIXTURE_VERSION}
    >
      <ConsoleLayout
        blockNumber={DEMO_BLOCK_NUMBER}
        mode={DEMO_MODE}
        ledger={<p className="console-placeholder">자산 목록은 /v1/assets 확정 후 연결한다.</p>}
        field={state === "normal" ? <AssuranceLedger /> : null}
        spine={<EvidenceSpine nodes={demoFinding.spine} />}
        events={<p>이벤트 수집은 P1 승격 시 연결한다.</p>}
      />
    </ScreenShell>
  );
}
