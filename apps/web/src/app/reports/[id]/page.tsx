import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ApiErrorNotice } from "@/components/api-error-notice";
import { Badge } from "@/components/badge";
import { BlockReceipt } from "@/components/block-receipt";
import { InvalidLinkNotice } from "@/components/invalid-link-notice";
import { PartialScanNotice, StateNotice } from "@/components/states";
import { PollingRefresher } from "@/components/polling-refresher";
import { ReportActions } from "@/components/report-actions";
import { RiskRuler } from "@/components/risk-ruler";
import { AppError } from "@/lib/adapters/errors";
import { getReport } from "@/lib/adapters/reports";
import { getScan } from "@/lib/adapters/scans";
import { formatKst } from "@/lib/asset-directory";
import { evidenceModeOf } from "@/lib/evidence-report";
import { isPollingStatus, scanProgress } from "@/lib/polling-state";
import { reportDisclosureOf } from "@/lib/report-disclosure";
import {
  parseRouteUrlState,
  validateUrlStateReferences,
} from "@/lib/url-state";

export default async function ReportPage({
  params,
  searchParams = Promise.resolve({}),
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const urlState = parseRouteUrlState("report", await searchParams);
  if (!urlState.ok) {
    return (
      <AppShell assetId="asset_pending" current="report" mode={null}>
        <InvalidLinkNotice invalid={urlState.invalid} />
      </AppShell>
    );
  }
  let response;
  try {
    response = await getReport(id);
  } catch (error) {
    if (error instanceof AppError && error.kind === "not_found") {
      return (
        <AppShell assetId="asset_pending" current="report" mode={null}>
          <StateNotice
            tone="breach"
            title="리포트를 찾을 수 없습니다."
            detail="링크가 오래됐거나 리포트가 생성되지 않았습니다."
            tail={<Link className="btn" href="/">홈으로</Link>}
          />
        </AppShell>
      );
    }
    if (error instanceof AppError) {
      return (
        <AppShell assetId="asset_pending" current="report" mode={null}>
          <ApiErrorNotice error={error} actionHref={`/reports/${id}`} />
        </AppShell>
      );
    }
    throw error;
  }

  let scanResponse: Awaited<ReturnType<typeof getScan>> | null = null;
  let scanError: AppError | null = null;
  try {
    scanResponse = await getScan(response.scan_id);
  } catch (error) {
    if (error instanceof AppError) {
      scanError = error;
    } else {
      throw error;
    }
  }
  const scan = scanResponse?.scan_run;
  const active =
    response.status === "QUEUED" && scan !== undefined && isPollingStatus(scan.status);
  const progress = scan ? scanProgress(scan) : null;
  const report = response.report;

  if (!report) {
    if (!scan) {
      return (
        <AppShell assetId="asset_pending" current="report" mode={null}>
          <h1 className="screen-title">증거 리포트</h1>
          <StateNotice
            tone="warn"
            title="리포트와 검사 메타데이터를 확인할 수 없습니다."
            detail="자산 화면에서 검사 상태를 확인한 뒤 다시 시도하세요."
            tail={<Link className="btn" href="/">자산 목록으로</Link>}
          />
        </AppShell>
      );
    }
    return (
      <AppShell assetId={scan.asset_id} current="report" mode={null}>
        <PollingRefresher active={active} />
        <h1 className="screen-title">증거 리포트</h1>
        <StateNotice
          tone={response.status === "FAILED" ? "breach" : "accent"}
          title={response.status === "FAILED" ? "리포트 생성 실패" : "리포트 조립 중"}
          detail={response.status === "FAILED"
            ? "내부 오류 정보는 숨겼습니다. 성공한 검사 결과는 자산 검사 화면에서 계속 확인할 수 있습니다."
            : `${progress?.label ?? "진행 상태 미제공"}. 완료 여부만 확인하며 미측정 소요시간은 표시하지 않습니다.`}
          tail={<Link className="btn" href={`/assets/${scan.asset_id}/scan?scan=${scan.scan_id}`}>검사 결과 열기</Link>}
        />
        <section aria-labelledby="report-limitations">
          <h2 id="report-limitations">제한사항</h2>
          <ul>{(response.limitations ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <p className="screen-note">이 리포트는 기술적 통제 보조 자료이며 투자 권유, 자동 발행 승인 또는 거래정지를 수행하지 않습니다.</p>
      </AppShell>
    );
  }

  const unknownImplementationIds = new Set(
    report.mismatches
      .filter((item) => item.implementation_status === "UNKNOWN")
      .map((item) => item.finding_id),
  );
  const confirmed = report.code_findings.filter(
    (item) => item.status === "CONFIRMED" && !unknownImplementationIds.has(item.finding_id),
  );
  const review = report.code_findings.filter(
    (item) => item.status !== "CONFIRMED" || unknownImplementationIds.has(item.finding_id),
  );
  const replay = report.onchain_evidence.filter((item) => item.mode === "REPLAY");
  const live = report.onchain_evidence.filter(
    (item) => item.mode === "LIVE" && item.receipt_status === "SUCCESS",
  );
  const fixtureVersion = replay.find((item) => item.fixture_version)?.fixture_version;
  const disclosure = reportDisclosureOf(report, response.limitations ?? []);
  const invalidReferences = validateUrlStateReferences(urlState.value, {
    findingIds: report.code_findings.map((finding) => finding.finding_id),
  });
  if (invalidReferences.length > 0) {
    return (
      <AppShell assetId={report.scan_run.asset_id} current="report" mode={null}>
        <InvalidLinkNotice invalid={invalidReferences} />
      </AppShell>
    );
  }
  const selectedFindingId =
    urlState.value.finding ?? confirmed[0]?.finding_id ?? review[0]?.finding_id;
  const selectedFinding = report.code_findings.find(
    (finding) => finding.finding_id === selectedFindingId,
  );
  const selectedMismatch = report.mismatches.find(
    (mismatch) => mismatch.finding_id === selectedFindingId,
  );
  const selectedControl = report.controls.find(
    (control) => control.constraint_id === selectedMismatch?.constraint_id,
  );
  const receiptlessLive = report.onchain_evidence.filter(
    (item) => item.mode === "LIVE" && item.receipt_status !== "SUCCESS",
  );
  const mode = evidenceModeOf(report);
  const modeEvidence = mode === "LIVE" ? live[0] : replay[0];

  return (
    <AppShell
      assetId={report.scan_run.asset_id}
      assetMeta={`${report.report_id} · ${formatKst(report.generated_at)}`}
      current="report"
      mode={mode}
      fixtureVersion={mode === "REPLAY" ? fixtureVersion : undefined}
      blockNumber={modeEvidence?.block_number}
      actions={<ReportActions reportId={report.report_id} />}
      isSynthetic={report.is_synthetic}
      variant="report"
    >
      <article className="report-reading audit-document" aria-label="감사 증거 리포트">
        <section role="region" aria-label="판정 요약" className="report-verdict-summary">
          <div className="report-document-label">RWA GUARD · IMMUTABLE EVIDENCE SNAPSHOT</div>
          <h1 className="screen-title">증거 리포트</h1>
          <p className="screen-lead">문서–코드 통제 불일치와 재현 가능한 근거를 같은 스냅샷으로 제공합니다.</p>
          {scanError ? <StateNotice tone="warn" title="검사 메타데이터를 불러오지 못했습니다." detail="저장된 리포트 스냅샷은 유효하므로 계속 표시합니다. 최신 검사 상태만 제한됩니다." tail={<Link className="btn" href={`/reports/${id}`}>메타데이터 다시 시도</Link>} /> : null}
          <PartialScanNotice scan={report.scan_run} />
          <div className="report-verdict-grid">
            <div>
              <span className="ledger-kicker">VERDICT</span>
              <strong>{confirmed.length ? `확정 위험 ${confirmed.length}건` : "확정 위험 없음"}</strong>
              <p>NEEDS_REVIEW {review.length}건은 확정 위험 집계에서 제외됩니다.</p>
            </div>
            <dl>
              <div><dt>데이터</dt><dd>{report.is_synthetic ? "SYNTHETIC · 합성" : "운영 데이터"}</dd></div>
              <div><dt>증거 모드</dt><dd>{mode === "LIVE" ? "LIVE · receipt 검증" : mode === "REPLAY" ? `REPLAY · fixture ${fixtureVersion ?? "미제공"}` : "온체인 증거 없음"}</dd></div>
              <div><dt>생성 시각</dt><dd>{formatKst(report.generated_at)}</dd></div>
            </dl>
          </div>
          <RiskRuler risk={report.exploit_risk} />
        </section>

        <section role="region" aria-label="발견사항" aria-labelledby="report-findings">
          <h2 id="report-findings">발견사항</h2>
          {report.code_findings.length ? (
            <ul className="rows report-finding-ledger">
              {confirmed.map((finding) => (
                <li
                  key={finding.finding_id}
                  id={`finding-${finding.finding_id}`}
                  data-selected={finding.finding_id === selectedFindingId || undefined}
                >
                  <div className="row">
                    <span>
                      <Link href={`/reports/${report.report_id}?finding=${finding.finding_id}#finding-${finding.finding_id}`}>
                        <strong>{finding.title}</strong>
                      </Link>
                      <span className="row-meta" style={{ display: "block" }}>{finding.rule_id} · {finding.code_location.file}:{finding.code_location.start_line}</span>
                    </span>
                    <span className="row-tail"><Badge tone={finding.severity === "CRITICAL" ? "breach-solid" : "warn"}>{finding.severity} · 확정</Badge></span>
                  </div>
                </li>
              ))}
              {review.map((finding) => (
                <li key={finding.finding_id} id={`finding-${finding.finding_id}`} data-selected={finding.finding_id === selectedFindingId || undefined}>
                  <div className="row">
                    <span>
                      <Link href={`/reports/${report.report_id}?finding=${finding.finding_id}#finding-${finding.finding_id}`}>
                        <strong>{finding.title}</strong>
                      </Link>
                      <span className="row-meta" style={{ display: "block" }}>{finding.rule_id} · 위험 집계 제외</span>
                    </span>
                    <span className="row-tail"><Badge tone="warn">NEEDS_REVIEW</Badge></span>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p>확정 Critical/High 발견사항이 없습니다. 자동 승인을 의미하지 않습니다.</p>}
        </section>

        <section role="region" aria-label="선택 문서 및 코드 근거" aria-labelledby="report-selected-evidence">
          <div className="report-section-heading">
            <div><span className="ledger-kicker">SELECTED EVIDENCE</span><h2 id="report-selected-evidence">선택 문서·코드 근거</h2></div>
            {selectedFinding ? <Link className="btn btn-small" href={`/assets/${report.scan_run.asset_id}/scan?scan=${report.scan_run.scan_id}&finding=${selectedFinding.finding_id}`}>검사에서 같은 발견사항 열기</Link> : null}
          </div>
          {selectedFinding ? (
            <div className="report-evidence-pair">
              <div>
                <span className="ledger-kicker">DOCUMENT</span>
                {selectedControl ? <><blockquote>{selectedControl.evidence_span.quote}</blockquote><p className="row-meta">page {selectedControl.evidence_span.page} · {selectedControl.constraint_id}</p></> : <p className="muted">연결된 문서 통제 근거가 없습니다.</p>}
              </div>
              <div>
                <span className="ledger-kicker">CODE</span>
                <pre className="code-overflow"><code>{selectedFinding.code_location.excerpt}</code></pre>
                <p className="row-meta">{selectedFinding.code_location.file}:{selectedFinding.code_location.start_line}</p>
                <ul>{(selectedFinding.deterministic_evidence ?? []).map((item) => <li key={item} className="mono">{item}</li>)}</ul>
              </div>
            </div>
          ) : <p>선택할 발견사항이 없습니다.</p>}
        </section>

        <section role="region" aria-label="REPLAY 증거" aria-labelledby="report-chain">
          <h2 id="report-chain">REPLAY 증거</h2>
          <p>재현 fixture는 LIVE가 아니며, 실제 receipt가 없는 데이터는 LIVE로 표시하지 않습니다.</p>
          <div className="responsive-split">{replay.map((item) => <BlockReceipt key={`${item.tx_hash}:${item.log_index}`} evidence={item} />)}</div>
          {live.length ? <h3>LIVE · receipt 확인 데이터</h3> : null}
          <div className="responsive-split">{live.map((item) => <BlockReceipt key={`${item.tx_hash}:${item.log_index}`} evidence={item} />)}</div>
          {receiptlessLive.length ? <p className="state" data-tone="warn">receipt 없는 LIVE 후보 {receiptlessLive.length}건은 증거에서 제외했습니다.</p> : null}
          {!replay.length && !live.length ? <p>연결된 온체인 증거가 없습니다. REPLAY로 대체 표시하지 않습니다.</p> : null}
        </section>

        <section role="region" aria-label="계보와 무결성" aria-labelledby="report-lineage">
          <h2 id="report-lineage">계보와 제한사항</h2>
          <p className="report-integrity-note"><strong>불변 스냅샷</strong> · 생성 시점 입력과 룰 버전을 고정하며 수정 대신 새 리포트를 생성합니다.</p>
          <dl className="report-lineage">
            <div><dt>리포트 해시</dt><dd className="mono hash-overflow">{report.report_hash}</dd></div>
            <div><dt>리포트 ID</dt><dd className="mono">{report.report_id}</dd></div>
            <div><dt>검사 ID</dt><dd className="mono">{report.scan_run.scan_id}</dd></div>
            <div><dt>입력 해시</dt><dd><pre>{JSON.stringify(disclosure.inputHashes, null, 2)}</pre></dd></div>
            <div><dt>룰 버전</dt><dd><pre>{JSON.stringify(disclosure.ruleVersions, null, 2)}</pre></dd></div>
            <div><dt>생성시각</dt><dd>{formatKst(report.generated_at)}</dd></div>
          </dl>
          <ul>{disclosure.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>

        <section role="region" aria-label="책임과 사용 제한" aria-labelledby="report-responsibility">
          <h2 id="report-responsibility">책임과 사용 제한</h2>
          <p>{disclosure.reviewerNotice}</p>
        </section>
      </article>
    </AppShell>
  );
}
