import { AppShell } from "@/components/app-shell";
import { BlockReceipt } from "@/components/block-receipt";
import { EvidenceSpine } from "@/components/evidence-spine";
import { fetchDemoEvidenceReport, toSpineNodes } from "@/lib/evidence-report";
import { parseScreenState } from "@/lib/screen-state";

export default async function ReportPage({
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const state = parseScreenState((await searchParams).state);

  // 데모 endpoint가 P0 E2E 시드다. 실패하면 여기서 던지고 세그먼트
  // error 경계가 사용자 문구를 만든다.
  const report = await fetchDemoEvidenceReport();

  const evidence = report.onchain_evidence[0];
  const replayed = report.onchain_evidence.find((entry) => entry.mode === "REPLAY");

  return (
    <AppShell
      title="증적 리포트"
      assetId={report.scan_run.asset_id}
      current="report"
      blockNumber={evidence?.block_number ?? 0}
      mode={evidence?.mode ?? "REPLAY"}
      state={state}
      fixtureVersion={replayed?.fixture_version ?? undefined}
    >
      <p className="screen-lead">
        판정에 쓰인 근거와 입력을 그대로 담습니다. 같은 내용을 JSON으로 내려받을 수 있습니다.
      </p>

      <section className="report-section" aria-label="증거 연결">
        <h2>불일치와 증거</h2>
        {report.mismatches.map((mismatch) => (
          <article className="report-mismatch" key={mismatch.mismatch_id}>
            <EvidenceSpine nodes={toSpineNodes(report, mismatch.mismatch_id)} />
          </article>
        ))}
      </section>

      <section className="report-section" aria-label="온체인 증적">
        <h2>온체인 증적</h2>
        {report.onchain_evidence.map((entry) => (
          <BlockReceipt key={`${entry.tx_hash}-${entry.log_index}`} evidence={entry} />
        ))}
      </section>

      <section className="report-section" aria-label="입력과 룰 버전">
        <h2>입력과 룰 버전</h2>
        <dl className="report-lineage">
          {Object.entries(report.scan_run.input_hashes).map(([name, hash]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{hash}</dd>
            </div>
          ))}
          {Object.entries(report.scan_run.rule_versions).map(([name, version]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{version}</dd>
            </div>
          ))}
          <div>
            <dt>생성시각</dt>
            <dd>{report.generated_at}</dd>
          </div>
        </dl>
        {/* PRD FR-14: 제한사항과 사람 검토 필요 문구가 항상 포함돼야 한다. */}
        <p className="report-limitation">
          합성 데이터 기준이며 자동 검사 결과입니다. 확정 판정에는 담당자 검토가 필요합니다.
        </p>
      </section>
    </AppShell>
  );
}
