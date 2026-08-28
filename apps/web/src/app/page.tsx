import { AppShell } from "@/components/app-shell";

import { ApiErrorNotice } from "@/components/api-error-notice";
import { HomeActions } from "@/components/home-actions";
import { HomeTheater } from "@/components/home-theater";
import { InvalidLinkNotice } from "@/components/invalid-link-notice";
import { EmptyState } from "@/components/states";
import { getDashboard } from "@/lib/adapters/dashboard";
import { AppError } from "@/lib/adapters/errors";
import {
  evidenceModeOf,
  leadMismatch,
  selectHomeEvidenceReport,
} from "@/lib/evidence-report";
import { parseRouteUrlState } from "@/lib/url-state";

export default async function HomePage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const urlState = parseRouteUrlState("home", await searchParams);
  if (!urlState.ok) {
    return <AppShell assetId="asset_pending" current="home" mode={null} variant="theater"><InvalidLinkNotice invalid={urlState.invalid} /></AppShell>;
  }
  let dashboard;
  let selected;
  try {
    dashboard = await getDashboard();
    selected = await selectHomeEvidenceReport(dashboard.assets);
  } catch (error) {
    if (error instanceof AppError) {
      return <AppShell assetId="asset_pending" current="home" mode={null} variant="theater"><ApiErrorNotice error={error} actionHref="/" /></AppShell>;
    }
    throw error;
  }
  const report = selected?.report;
  const asset = selected?.asset;
  const mode = report ? evidenceModeOf(report) : null;
  const modeEvidence = report?.onchain_evidence.find((item) =>
    mode === "LIVE"
      ? item.mode === "LIVE" && item.receipt_status === "SUCCESS"
      : item.mode === "REPLAY",
  );
  const lead = report ? leadMismatch(report) : undefined;
  const alert = lead
    ? dashboard.recent_alerts.find(
        (item) =>
          item.asset_id === asset?.asset_id &&
          item.cause.mismatch_id === lead.mismatch_id,
      )
    : undefined;

  return (
    <AppShell
      assetId={asset?.asset_id ?? dashboard.assets[0]?.asset_id ?? "asset_pending"}
      assetName={asset?.name ?? "RWA Guard"}
      assetMeta={`${dashboard.total_assets}개 자산`}
      current="home"
      reportId={report?.report_id}
      mode={mode}
      fixtureVersion={mode === "REPLAY" ? modeEvidence?.fixture_version : undefined}
      freshness={asset?.freshness}
      blockNumber={modeEvidence?.block_number}
      isSynthetic={dashboard.is_synthetic}
      variant="theater"
    >
      {report && asset ? (
        <HomeTheater
          assetId={asset.asset_id}
          assetName={asset.name}
          report={report}
          alert={alert}
        />
      ) : (
        <EmptyState
          title={dashboard.assets.length === 0
            ? "등록된 자산이 없습니다."
            : "표시할 저장 리포트가 아직 없습니다."}
          detail={dashboard.assets.length === 0
            ? "발행 문서와 컨트랙트를 연결하면 통제 검증이 시작됩니다."
            : "대기·실패·부분 검사는 위험 리포트로 추정하지 않습니다. 저장이 완료된 리포트를 기다리거나 샘플을 재현하세요."}
          action={<HomeActions />}
        />
      )}
    </AppShell>
  );
}
