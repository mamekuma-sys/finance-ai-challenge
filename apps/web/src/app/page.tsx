import { AssuranceLedger } from "@/components/assurance-ledger";
import { BlockReceipt } from "@/components/block-receipt";
import { ConsoleLayout } from "@/components/console-layout";
import { EvidenceSpine } from "@/components/evidence-spine";
import { ScreenShell } from "@/components/screen-shell";
import { fetchDemoEvidenceReport, toSpineNodes } from "@/lib/evidence-report";
import { parseScreenState } from "@/lib/screen-state";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const state = parseScreenState((await searchParams).state);
  const report = await fetchDemoEvidenceReport();

  const evidence = report.onchain_evidence[0];
  const firstMismatch = report.mismatches[0];

  return (
    <ScreenShell
      title="관제 홈"
      screenId="S1"
      url="/"
      state={state}
      fixtureVersion={evidence?.fixture_version ?? undefined}
    >
      <ConsoleLayout
        blockNumber={evidence?.block_number ?? 0}
        mode={evidence?.mode ?? "REPLAY"}
        ledger={
          <p className="console-placeholder">
            자산 목록은 /v1/assets 확정 후 연결한다. 현재는 {report.scan_run.asset_id} 한 건이다.
          </p>
        }
        field={state === "normal" ? <AssuranceLedger /> : null}
        spine={
          firstMismatch ? (
            <EvidenceSpine nodes={toSpineNodes(report, firstMismatch.mismatch_id)} />
          ) : (
            <p className="console-placeholder">불일치가 없습니다.</p>
          )
        }
        events={evidence ? <BlockReceipt evidence={evidence} /> : <p>수집된 이벤트가 없습니다.</p>}
      />
    </ScreenShell>
  );
}
