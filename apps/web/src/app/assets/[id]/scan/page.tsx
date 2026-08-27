import { AppShell } from "@/components/app-shell";
import { CodeView } from "@/components/code-view";
import { MismatchList } from "@/components/mismatch-list";
import { RiskRuler } from "@/components/risk-ruler";
import { VerdictBanner } from "@/components/verdict-banner";
import { DEMO_CODE } from "@/lib/demo-screens";
import { fetchDemoEvidenceReport } from "@/lib/evidence-report";
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
  const report = await fetchDemoEvidenceReport();

  const evidence = report.onchain_evidence[0];
  const finding = report.code_findings[0];

  return (
    <AppShell
      title="검증 결과"
      assetId={id}
      current="scan"
      blockNumber={evidence?.block_number ?? 0}
      mode={evidence?.mode ?? "REPLAY"}
      state={state}
    >
      <VerdictBanner report={report} assetId={id} />

      <section className="screen-section" aria-label="위험 점수">
        <RiskRuler findings={report.code_findings} />
      </section>

      <section className="screen-section" aria-label="문서와 코드 불일치">
        <h2 className="panel-title">문서와 코드 불일치</h2>
        <MismatchList report={report} assetId={id} />
      </section>

      <section className="screen-section" aria-label="근거 코드">
        <h2 className="panel-title">근거 코드</h2>
        {finding
          ? await CodeView({
              source: DEMO_CODE.source,
              startLine: DEMO_CODE.startLine,
              file: finding.code_location.file,
              highlight: {
                start: finding.code_location.start_line,
                end: finding.code_location.end_line,
              },
            })
          : null}
        <p className="screen-note">
          취약본과 수정본 비교는 재검사 결과 계약이 확정된 뒤 붙습니다.
        </p>
      </section>
    </AppShell>
  );
}
