import { AppShell } from "@/components/app-shell";
import { ControlEvidence } from "@/components/control-evidence";
import { fetchDemoEvidenceReport } from "@/lib/evidence-report";
import { parseScreenState } from "@/lib/screen-state";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string; constraint?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const state = parseScreenState(query.state);
  const report = await fetchDemoEvidenceReport();

  const evidence = report.onchain_evidence[0];
  const selected = query.constraint;

  return (
    <AppShell
      title="발행조건"
      assetId={id}
      current="document"
      blockNumber={evidence?.block_number ?? 0}
      mode={evidence?.mode ?? "REPLAY"}
      state={state}
    >
      <p className="screen-lead">
        발행 문서에서 뽑은 통제조건과 그 근거입니다. 값은 언제나 원문 인용과 함께 둡니다.
      </p>

      {report.controls.length === 0 ? (
        <p className="panel-empty">추출된 통제조건이 없습니다.</p>
      ) : (
        <div className="control-grid">
          {report.controls.map((control) => (
            <div
              key={control.constraint_id}
              data-selected={control.constraint_id === selected ? "true" : undefined}
            >
              <ControlEvidence control={control} />
            </div>
          ))}
        </div>
      )}

      <p className="screen-note">
        원문 PDF 뷰어는 문서 업로드 경로가 열린 뒤 붙습니다. 지금은 추출된 인용문으로 확인합니다.
      </p>
    </AppShell>
  );
}
