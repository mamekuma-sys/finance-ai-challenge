import { AppShell } from "@/components/app-shell";
import { ApiErrorNotice } from "@/components/api-error-notice";
import Link from "next/link";
import { Badge } from "@/components/badge";
import { ComparePanel } from "@/components/compare-panel";
import { EvidenceSpine } from "@/components/evidence-spine";
import { InvalidLinkNotice } from "@/components/invalid-link-notice";
import { PollingRefresher } from "@/components/polling-refresher";
import { RiskRuler } from "@/components/risk-ruler";
import { EmptyState, PartialScanNotice, SkeletonScreen, StateNotice } from "@/components/states";
import { WorkbenchGrid } from "@/components/workbench-grid";
import { AppError } from "@/lib/adapters/errors";
import { fetchScanViewForAsset } from "@/lib/adapters/reports";
import { formatKst } from "@/lib/asset-directory";
import { coverageOf } from "@/lib/control-coverage";
import { linkOf, spineOf } from "@/lib/evidence-report";
import { parseScreenState } from "@/lib/screen-state";
import { allowDevelopmentState } from "@/lib/screen-state";
import { isPollingStatus, scanProgress } from "@/lib/polling-state";
import { scanVerdict } from "@/lib/scan-view";
import { stageReport, summaryOf } from "@/lib/stage-report";
import {
  missingReferenceFromError,
  parseRouteUrlState,
  validateUrlStateReferences,
} from "@/lib/url-state";

export default async function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const urlState = parseRouteUrlState("scan", query);
  if (!urlState.ok) {
    return (
      <AppShell assetId={id} current="scan" mode={null}>
        <InvalidLinkNotice invalid={urlState.invalid} />
      </AppShell>
    );
  }
  const stagedState = Array.isArray(query.state) ? query.state[0] : query.state;
  const state = allowDevelopmentState(stagedState) ?? parseScreenState(undefined);
  let scanView;
  try {
    scanView = await fetchScanViewForAsset(id, {
      scanId: urlState.value.scan,
      base: urlState.value.base,
    });
  } catch (error) {
    if (error instanceof AppError && error.kind === "not_found") {
      if (error.metadata.resource === "asset") {
        return (
          <AppShell assetId={id} current="scan" mode={null}>
            <StateNotice
              tone="breach"
              title="자산을 찾을 수 없습니다."
              detail="요청한 자산 ID가 등록되어 있지 않습니다."
            />
          </AppShell>
        );
      }
      if (error.metadata.resource === "scan" && !urlState.value.scan) {
        return (
          <AppShell assetId={id} current="scan" mode={null}>
            <EmptyState
              title="검사 이력이 없습니다."
              detail="컨트랙트를 연결한 뒤 검증을 시작하세요."
              action={<Link className="btn btn-primary" href={`/assets/${id}`}>검증 시작</Link>}
            />
          </AppShell>
        );
      }
      const missingReference = missingReferenceFromError(error, urlState.value);
      if (missingReference) {
        return (
          <AppShell assetId={id} current="scan" mode={null}>
            <InvalidLinkNotice invalid={[missingReference]} />
          </AppShell>
        );
      }
    }
    if (error instanceof AppError) {
      return (
        <AppShell assetId={id} current="scan" mode={null}>
          <ApiErrorNotice
            error={error}
            actionHref={error.kind === "validation" ? `/assets/${id}` : `/assets/${id}/scan`}
          />
        </AppShell>
      );
    }
    throw error;
  }
  if (!scanView.report) {
    const scan = scanView.scan.scan_run;
    const progress = scanProgress(scan);
    const active = isPollingStatus(scan.status);
    return (
      <AppShell assetId={id} assetName={scanView.asset.name} current="scan" mode={null}>
        <PollingRefresher active={active} />
        <ol className="step-progress" aria-label="검증 단계"><li>1 등록</li><li>2 문서 검토</li><li aria-current="step">3 컨트랙트 검사</li><li>4 리포트</li></ol>
        <StateNotice
          tone={scan.status === "FAILED" ? "breach" : scan.status === "PARTIAL" ? "warn" : "accent"}
          title={progress.label}
          detail={active
            ? "저장된 scan 상태를 주기적으로 확인하고 있습니다. 리포트가 준비되면 자동 전환됩니다."
            : <>
                자동 갱신을 중지했습니다.
                {progress.failedRules.length ? ` 실패 룰: ${progress.failedRules.join(", ")}.` : ""}
                {progress.toolVersions.length ? ` 도구 버전: ${progress.toolVersions.join(", ")}.` : ""}
              </>}
          tail={!active ? <Link className="btn" href={`/assets/${id}`}>Source 연결 확인</Link> : undefined}
        />
        <p className="screen-note">이 검사는 기술적 통제 보조 자료이며 자동 발행 승인이나 거래정지를 수행하지 않습니다.</p>
      </AppShell>
    );
  }
  const staged = stageReport(scanView.report, state);
  const { report, empty } = staged;
  const invalidReferences = validateUrlStateReferences(urlState.value, {
    findingIds: report.code_findings.map((finding) => finding.finding_id),
  });
  if (invalidReferences.length > 0) {
    return (
      <AppShell assetId={id} current="scan" mode={null}>
        <InvalidLinkNotice invalid={invalidReferences} />
      </AppShell>
    );
  }
  const summary = summaryOf(report);
  const persistedScan = scanView.scan;
  const diff = persistedScan.diff ?? [];
  const coverage = coverageOf(report);
  const unknownImplementationIds = new Set(
    report.mismatches
      .filter((item) => item.implementation_status === "UNKNOWN")
      .map((item) => item.finding_id),
  );
  const confirmedFindings = report.code_findings.filter(
    (item) => item.status === "CONFIRMED" && !unknownImplementationIds.has(item.finding_id),
  );
  const reviewFindings = report.code_findings.filter(
    (item) =>
      item.status === "PROBABLE" ||
      item.status === "NEEDS_REVIEW" ||
      item.status === "UNKNOWN" ||
      unknownImplementationIds.has(item.finding_id),
  );
  const selectedFindingId =
    urlState.value.finding ?? confirmedFindings[0]?.finding_id ?? reviewFindings[0]?.finding_id;
  const selectedMismatch = report.mismatches.find(
    (item) => item.finding_id === selectedFindingId,
  );
  const selectedFinding = report.code_findings.find(
    (item) => item.finding_id === selectedFindingId,
  );
  const diffByFinding = new Map(diff.map((item) => [item.finding_id, item.change]));
  const selectedDiffStatus = selectedFindingId ? diffByFinding.get(selectedFindingId) : undefined;
  const selectedLinked = selectedMismatch ? linkOf(report, selectedMismatch) : undefined;
  const evidence = selectedMismatch ? <EvidenceSpine nodes={spineOf(report, selectedMismatch, id)} /> : null;
  const verdict = scanVerdict({
    status: report.scan_run.status,
    controls: report.controls,
    findings: report.code_findings,
    mismatches: report.mismatches,
  });

  return (
    <AppShell
      assetId={id}
      assetMeta={`${report.scan_run.scan_id} · ${formatKst(report.scan_run.completed_at)}`}
      current="scan"
      reportId={summary.reportId}
      blockNumber={summary.blockNumber}
      mode={summary.mode}
      fixtureVersion={summary.evidence?.fixture_version}
      evidenceAside={
        evidence ? (
          <div className="sticky-panel">{evidence}</div>
        ) : (
          <p className="muted">연결된 증거가 없습니다.</p>
        )
      }
    >
      <PollingRefresher active={isPollingStatus(report.scan_run.status)} />
      <div>
        <h1 className="screen-title">검증 결과</h1>
        <p className="screen-lead">
          결정론적 룰이 컨트랙트를 검사한 결과와, 발행 문서와 어긋난 지점입니다.
        </p>
      </div>
      <p className="screen-note">이 결과는 기술적 통제 보조 자료이며 자동 발행 승인·거래정지 또는 투자 판단을 수행하지 않습니다.</p>

      {state === "loading" ? (
        <SkeletonScreen label="검증 결과를" />
      ) : empty ? (
        <EmptyState
          title="표시할 검사 결과가 없습니다."
          detail="저장된 scan 상태를 다시 확인하세요."
        />
      ) : verdict === "PASS" ? (
        <StateNotice
          tone="neutral"
          title="자동검사 통과 — 담당자 검토 필요"
          detail="결정론적 룰에서 발견사항이 없었습니다. 이는 자동 승인을 의미하지 않습니다."
        />
      ) : (
        <>
          <PartialScanNotice scan={report.scan_run} />
          <section className="audit-verdict-strip" aria-label="검사 판정 요약">
            <RiskRuler risk={report.exploit_risk} compact />
            <p>
              통제조건 {report.controls.length}개 중 위반 <strong>{coverage.mismatched}개</strong>
              <span className="muted"> · 통제 공백 {coverage.missing}개 · 부분 구현 {coverage.partial}개</span>
            </p>
            {reviewFindings.length ? <Badge tone="warn">NEEDS_REVIEW {reviewFindings.length}</Badge> : null}
            {report.scan_run.status === "PARTIAL" ? <Badge tone="warn">PARTIAL</Badge> : null}
          </section>

          <WorkbenchGrid
            className="scan-audit-workbench"
            rail={
              <nav className="finding-rail" aria-label="발견사항 선택">
                <div className="audit-section-head">
                  <h2>발견사항</h2>
                  <span className="row-meta">코드 결함 {report.code_findings.length}건</span>
                </div>
                <ul className="rows">
                  {[...confirmedFindings, ...reviewFindings].map((finding) => {
                    const diffStatus = diffByFinding.get(finding.finding_id);
                    const selected = finding.finding_id === selectedFindingId;
                    return (
                      <li key={finding.finding_id}>
                        <Link
                          className="row finding-row"
                          id={`finding-${finding.finding_id}`}
                          href={`?scan=${report.scan_run.scan_id}&finding=${finding.finding_id}${urlState.value.base ? `&base=${urlState.value.base}` : ""}`}
                          aria-current={selected ? "true" : undefined}
                          data-selected={selected || undefined}
                          autoFocus={urlState.value.finding === finding.finding_id}
                        >
                          <span
                            className="row-mark"
                            data-status={unknownImplementationIds.has(finding.finding_id) ? "PARTIAL" : finding.status === "CONFIRMED" ? "MISSING" : "PARTIAL"}
                            data-diff={diffStatus}
                          />
                          <span className="finding-row-copy">
                            <strong className="row-name">{finding.title}</strong>
                            <span className="row-meta">{finding.rule_id}</span>
                          </span>
                          <span className="row-tail finding-row-badges">
                            {diffStatus ? <Badge tone={diffStatus === "RESOLVED" ? "safe" : diffStatus === "NEW" ? "breach" : "warn"}>{diffStatus}</Badge> : null}
                            <Badge tone={finding.status === "CONFIRMED" ? finding.severity === "CRITICAL" ? "breach-solid" : "warn" : "neutral"}>
                              {unknownImplementationIds.has(finding.finding_id) ? "판단 불가" : finding.status === "CONFIRMED" ? finding.severity : finding.status}
                            </Badge>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            }
            content={
              selectedMismatch && selectedLinked ? await ComparePanel({
                linked: selectedLinked,
                assetId: id,
                selected: true,
                diffStatus: selectedDiffStatus,
                excerpt: selectedLinked.finding
                  ? {
                      firstLine: selectedLinked.finding.code_location.start_line,
                      source: selectedLinked.finding.code_location.excerpt,
                    }
                  : undefined,
              }) : (
                <StateNotice
                  tone={verdict === "UNMAPPED_FINDING" || verdict === "CONFIRMED_RISK" ? "breach" : "warn"}
                  title={
                    verdict === "CONTROL_REVIEW_REQUIRED"
                        ? "미확정 통제조건 — 문서 검토 필요"
                        : verdict === "FINDING_REVIEW_REQUIRED"
                          ? "NEEDS_REVIEW/UNKNOWN 발견 — 담당자 확인 필요"
                          : verdict === "PROBABLE_REVIEW_REQUIRED"
                            ? "유력 — 담당자 확인 필요"
                            : selectedFinding && !selectedMismatch
                              ? "선택 발견사항의 문서 연결이 없습니다"
                            : "검사 결과 연결을 확인하세요"
                  }
                  detail="자동 통과로 표시하지 않습니다. 문서 확정 상태와 발견사항의 증거 연결을 확인하세요."
                />
              )
            }
            evidenceSummary={
              <div className="audit-evidence-summary">
                <strong>선택 증거</strong>
                <span className="row-meta">
                  {selectedLinked?.control
                    ? `문서 p.${selectedLinked.control.evidence_span.page}`
                    : "문서 근거 없음"}
                  {" → "}
                  {selectedLinked?.finding
                    ? `${selectedLinked.finding.code_location.file}:${selectedLinked.finding.code_location.start_line}`
                    : "코드 근거 없음"}
                </span>
              </div>
            }
            actions={
              <div className="audit-sticky-actions">
                <Link className="btn" href={`/assets/${id}/document${selectedLinked?.control ? `?constraint=${selectedLinked.control.constraint_id}` : ""}`}>문서 검토</Link>
                <Link className="btn btn-primary" href={`/reports/${summary.reportId}${selectedFindingId ? `?finding=${selectedFindingId}` : ""}`}>리포트에서 보기</Link>
              </div>
            }
          />

          {diff.some((item) => item.change === "RESOLVED") ? (
            <p className="state" data-tone="accent">
              이번 검사에서 해결된 항목 {diff.filter((item) => item.change === "RESOLVED").length}건은 현재 finding rail에서 제외됩니다.
            </p>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
