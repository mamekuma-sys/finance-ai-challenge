import { AppShell } from "@/components/app-shell";
import { AssetLedger } from "@/components/asset-ledger";
import { BlockReceipt } from "@/components/block-receipt";
import { EvidenceSpine } from "@/components/evidence-spine";
import { MismatchList } from "@/components/mismatch-list";
import { RiskRuler } from "@/components/risk-ruler";
import { VerdictBanner } from "@/components/verdict-banner";
import { fetchDemoEvidenceReport, toSpineNodes } from "@/lib/evidence-report";
import { parseScreenState } from "@/lib/screen-state";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const state = parseScreenState((await searchParams).state);
  const report = await fetchDemoEvidenceReport();

  const assetId = report.scan_run.asset_id;
  const evidence = report.onchain_evidence[0];
  const firstMismatch = report.mismatches[0];

  const criticalCount = report.code_findings.filter(
    (finding) => finding.severity === "CRITICAL" && finding.status === "CONFIRMED",
  ).length;
  const highCount = report.code_findings.filter(
    (finding) => finding.severity === "HIGH" && finding.status === "CONFIRMED",
  ).length;

  return (
    <AppShell
      title="관제 홈"
      assetId={assetId}
      current="home"
      blockNumber={evidence?.block_number ?? 0}
      mode={evidence?.mode ?? "REPLAY"}
      state={state}
      fixtureVersion={evidence?.fixture_version ?? undefined}
    >
      <VerdictBanner report={report} assetId={assetId} />

      <div className="console-body">
        <section className="console-ledger" aria-label="자산 원장">
          <h2 className="panel-title">자산</h2>
          <AssetLedger
            rows={[
              {
                assetId,
                highestSeverity: report.code_findings[0]?.severity ?? null,
                criticalCount,
                highCount,
              },
            ]}
          />
          <div className="ledger-risk">
            <RiskRuler findings={report.code_findings} />
          </div>
        </section>

        <section className="console-field" aria-label="문서와 코드 불일치">
          <h2 className="panel-title">문서와 코드 불일치</h2>
          <MismatchList report={report} assetId={assetId} />
        </section>

        <section className="console-spine" aria-label="증거 연결">
          <h2 className="panel-title">증거 연결</h2>
          {firstMismatch ? (
            <EvidenceSpine nodes={toSpineNodes(report, firstMismatch.mismatch_id)} />
          ) : (
            <p className="panel-empty">불일치가 없습니다.</p>
          )}
        </section>
      </div>

      <section className="console-events" aria-label="이벤트 원장">
        <h2 className="panel-title">최근 온체인 이벤트</h2>
        {evidence ? (
          <BlockReceipt evidence={evidence} />
        ) : (
          <p className="panel-empty">수집된 이벤트가 없습니다.</p>
        )}
      </section>
    </AppShell>
  );
}
