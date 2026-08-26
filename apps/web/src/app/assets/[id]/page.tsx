import { AppShell } from "@/components/app-shell";
import { BlockReceipt } from "@/components/block-receipt";
import { assetNameOf } from "@/lib/asset-directory";
import { fetchDemoEvidenceReport } from "@/lib/evidence-report";
import { parseScreenState } from "@/lib/screen-state";
import type { ImplementationStatus } from "@/types/contracts";

const STATUS_LABEL: Record<ImplementationStatus, string> = {
  IMPLEMENTED: "구현됨",
  PARTIAL: "부분 구현",
  MISSING: "미구현",
  UNKNOWN: "판단 불가",
};

export default async function AssetDetailPage({
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

  return (
    <AppShell
      title={assetNameOf(id)}
      assetId={id}
      current="asset"
      blockNumber={evidence?.block_number ?? 0}
      mode={evidence?.mode ?? "REPLAY"}
      state={state}
      fixtureVersion={evidence?.fixture_version ?? undefined}
    >
      <section className="screen-section" aria-label="발행조건 구현 상태">
        <h2 className="panel-title">발행조건 구현 상태</h2>
        <ul className="status-list">
          {report.mismatches.map((mismatch) => (
            <li key={mismatch.mismatch_id}>
              <span>{mismatch.constraint_id}</span>
              <span data-status={mismatch.implementation_status}>
                {STATUS_LABEL[mismatch.implementation_status]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="screen-section" aria-label="검사 이력">
        <h2 className="panel-title">검사 이력</h2>
        <ul className="status-list">
          <li>
            <span>{report.scan_run.scan_id}</span>
            <span>{report.scan_run.status}</span>
            <span>{report.scan_run.completed_at ?? "진행 중"}</span>
          </li>
        </ul>
      </section>

      <section className="screen-section" aria-label="온체인 이벤트">
        <h2 className="panel-title">온체인 이벤트</h2>
        {evidence ? <BlockReceipt evidence={evidence} /> : <p className="panel-empty">없음</p>}
      </section>

      <section className="screen-section" aria-label="기준가 밴드">
        <h2 className="panel-title">기준가 밴드</h2>
        <p className="panel-empty">
          가격 무결성 감시는 라이브 체인 연결이 승격된 뒤 표시합니다.
        </p>
      </section>
    </AppShell>
  );
}
