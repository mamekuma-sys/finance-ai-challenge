import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ApiErrorNotice } from "@/components/api-error-notice";
import { Badge } from "@/components/badge";
import { BlockReceipt } from "@/components/block-receipt";
import { CONTROL_NAMES } from "@/components/control-card";
import {
  CONTROL_LEDGER_LABEL,
  CONTROL_LEDGER_TONE,
  controlLedgerState,
} from "@/lib/control-ledger";
import { AssetRecoveryActions } from "@/components/asset-recovery-actions";
import { EmptyState, PartialScanNotice, StateNotice } from "@/components/states";
import { getAsset } from "@/lib/adapters/assets";
import { getReport } from "@/lib/adapters/reports";
import { getScan } from "@/lib/adapters/scans";
import { AppError } from "@/lib/adapters/errors";
import { formatKst } from "@/lib/asset-directory";
import { implementationByConstraint } from "@/lib/scan-view";
import { hasConfirmedP0Controls } from "@/lib/document-review-state";

export default async function AssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  let asset: Awaited<ReturnType<typeof getAsset>>;
  let scan: Awaited<ReturnType<typeof getScan>> | null = null;
  let reportResponse: Awaited<ReturnType<typeof getReport>> | null = null;
  let scanError: AppError | null = null;
  let reportError: AppError | null = null;
  try {
    asset = await getAsset(id);
  } catch (error) {
    if (error instanceof AppError) {
      return <AppShell assetId={id} current="asset" mode={null}><ApiErrorNotice error={error} actionHref={error.kind === "not_found" ? "/" : `/assets/${id}`} /></AppShell>;
    }
    throw error;
  }
  const selectedScanId =
    (Array.isArray(query.scan) ? query.scan[0] : query.scan) ?? asset.scans?.[0]?.scan_id;
  if (selectedScanId) {
    try {
      scan = await getScan(selectedScanId, { assetId: id });
    } catch (error) {
      if (error instanceof AppError) scanError = error;
      else throw error;
    }
  }
  if (scan?.report_id) {
    try {
      reportResponse = await getReport(scan.report_id);
    } catch (error) {
      if (error instanceof AppError) reportError = error;
      else throw error;
    }
  }
  const report = reportResponse?.report;
  const document = (asset.documents ?? []).at(-1);
  const controls = document?.controls ?? [];
  const confirmed = controls.filter((item) => item.confirmed).length;
  const canScan = hasConfirmedP0Controls(controls);
  const receipt = scan?.onchain_evidence?.[0];
  const implementation = implementationByConstraint(scan?.mismatches ?? []);
  const registrationFailure = Array.isArray(query.registration) ? query.registration[0] : query.registration;
  const needsDocument = (asset.documents ?? []).length === 0;
  const needsContract = (asset.contracts ?? []).length === 0;
  const needsRecovery = Boolean(registrationFailure || needsDocument || needsContract);

  return (
    <AppShell
      assetId={id}
      assetName={asset.name}
      assetMeta="Kaia Kairos · chain 1001"
      current="asset"
      reportId={report?.report_id}
      blockNumber={receipt?.block_number}
      mode={receipt?.mode ?? null}
      fixtureVersion={receipt?.fixture_version ?? document?.version}
      variant="workbench"
    >
      <header className="asset-page-heading">
        <h1 className="screen-title">자산 상세</h1>
        <p className="screen-lead">
          발행 문서의 통제조건이 컨트랙트에 어떻게 반영됐는지 보여줍니다.
        </p>
      </header>

      {registrationFailure ? <p className="state" data-tone="warn">자산은 생성됐지만 {registrationFailure === "document_failed" ? "문서 업로드" : "컨트랙트 연결"}에 실패했습니다. 등록 흐름에서 다시 시도하세요.</p> : null}
      {scanError ? <StateNotice tone="warn" title="최근 검사만 불러오지 못했습니다." detail="자산, 문서 통제조건과 검사 이력은 계속 확인할 수 있습니다." tail={<Link className="btn" href={`/assets/${id}`}>검사 다시 불러오기</Link>} /> : null}
      {scan ? <PartialScanNotice scan={scan.scan_run} /> : null}
      {scan?.scan_run.status === "FAILED" ? <StateNotice tone="breach" title="최근 검사가 실패했습니다." detail="기존 문서와 이전 리포트는 유지됩니다. Source 연결과 실패 단계를 확인한 뒤 재검사하세요." tail={<Link className="btn" href={`/assets/${id}`}>Source 연결 확인</Link>} /> : null}
      <div className="asset-ledger-flow">
        <section className="asset-status-strip" role="region" aria-label="자산 상태">
          <div>
            <span className="ledger-kicker">자산 메타데이터</span>
            <strong>{asset.underlying_description}</strong>
          </div>
          <dl>
            <div><dt>등록 상태</dt><dd><Badge tone={asset.status === "VERIFIED" ? "safe" : "warn"}>{asset.status}</Badge></dd></div>
            <div><dt>문서 통제</dt><dd>{confirmed}/{controls.length} 확정</dd></div>
            <div><dt>최근 검사</dt><dd>{scan?.scan_run.status ?? "미실행"}</dd></div>
            <div><dt>발행 계획</dt><dd className="mono">{asset.total_planned_supply.toLocaleString()} {asset.token_unit} · {asset.currency}</dd></div>
          </dl>
          <p className="row-meta">SYNTHETIC · {asset.network} · 저장된 상태 기준</p>
        </section>

        <section className="asset-ledger-section" role="region" aria-label="통제 구현 상태">
          <div className="ledger-section-head">
            <div><span className="ledger-kicker">CONTROL LEDGER</span><h2>통제조건 구현 상태</h2></div>
            <span className="mono muted">{controls.length} CONDITIONS</span>
          </div>
          {controls.length ? <ul className="rows asset-control-ledger">
            {controls.map((control) => {
              const state = controlLedgerState({
                field: control.field,
                implementation: implementation.get(control.constraint_id),
                scanStatus: scan?.scan_run.status,
              });
              return (
                <li key={control.constraint_id}>
                  <div className="row">
                    <span className="row-mark" data-status={state} />
                    <span className="control-ledger-name">
                      <span className="row-name">{CONTROL_NAMES[control.field] ?? control.field}</span>
                      <span className="row-meta mono">{control.constraint_id}</span>
                    </span>
                    <span className="control-ledger-review">
                      <Badge tone={control.confirmed ? "safe" : "warn"}>
                        {control.confirmed ? "문서 확정" : "NEEDS_REVIEW"}
                      </Badge>
                    </span>
                    <span className="row-tail">
                      <Badge tone={CONTROL_LEDGER_TONE[state]}>
                        {CONTROL_LEDGER_LABEL[state]}
                      </Badge>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul> : <EmptyState title="등록된 통제조건이 없습니다." detail="발행 문서를 등록하고 문서 근거를 검토하세요." action={<Link className="btn btn-primary" href={`/assets/${id}/document`}>문서 등록·검토</Link>} />}
          <p className="screen-note">
            P0 코드 검사는 접근권한·담보/발행한도·오라클 검증 3종만 수행합니다.
            대응 룰이 없는 조건은 <strong>P0 범위 밖</strong>으로 표시하며 담당자가 직접 확인해야 합니다.
            <strong> 결함 없음</strong>은 해당 룰이 결함을 찾지 못했다는 뜻이며 구현을 보증하지 않습니다.
          </p>
        </section>

        <section className="asset-ledger-section" role="region" aria-label="검사 이력">
          <div className="ledger-section-head">
            <div><span className="ledger-kicker">SCAN HISTORY</span><h2>검사 이력</h2></div>
          </div>
          {(asset.scans ?? []).length ? <ul className="rows">
            {(asset.scans ?? []).map((item) => <li key={item.scan_id}>
              <Link className="row" href={`/assets/${id}/scan?scan=${item.scan_id}`}>
                <span className="mono">{item.scan_id}</span>
                <Badge tone={item.status === "COMPLETED" ? "safe" : item.status === "FAILED" ? "breach" : "warn"}>{item.status}</Badge>
                <span className="row-tail row-meta">{formatKst(item.completed_at)}</span>
              </Link>
            </li>)}
          </ul> : <EmptyState title="검사 이력이 없습니다." detail="문서 통제조건을 확정하고 컨트랙트 검증을 시작하세요." />}
        </section>

        <section className="asset-next-action" role="region" aria-label="다음 행동">
          <div>
            <span className="ledger-kicker">NEXT ACTION</span>
            <h2>{!canScan ? "문서 통제조건을 먼저 검토하세요" : report ? "감사 리포트에서 근거를 확인하세요" : "컨트랙트 검사를 시작하세요"}</h2>
            <p className="muted">{!canScan ? "NEEDS_REVIEW 항목은 확정 위험으로 집계되지 않습니다." : "저장된 검사와 증거를 기준으로 다음 단계로 이동합니다."}</p>
          </div>
          <div className="asset-next-buttons">
            <Link className="btn btn-primary" href={!canScan ? `/assets/${id}/document` : report ? `/reports/${report.report_id}` : `/assets/${id}/document`}>
              {!canScan ? "문서 검토 계속" : report ? "증거 리포트 열기" : "검증 준비"}
            </Link>
          </div>
          {reportError ? <p className="form-error">리포트만 불러오지 못했습니다. 자산과 검사 이력은 유지됩니다.</p> : null}
          <details className="asset-evidence-details">
            <summary>최신 온체인 증거</summary>
            {receipt ? <BlockReceipt evidence={receipt} /> : <p className="muted">연결된 온체인 증거가 없습니다. REPLAY로 대체 표시하지 않습니다.</p>}
          </details>
          {needsRecovery ? (
            <details className="asset-recovery-details">
              <summary>등록 복구</summary>
              <AssetRecoveryActions
                assetId={id}
                needsDocument={needsDocument}
                needsContract={needsContract}
                contractId={(asset.contracts ?? []).at(-1)?.contract_id}
                baseScanId={asset.scans?.[0]?.scan_id}
                canScan={canScan}
              />
            </details>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
