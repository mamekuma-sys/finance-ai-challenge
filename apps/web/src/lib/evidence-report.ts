import {
  fetchEvidenceReportForAsset,
  getReport,
} from "@/lib/adapters/reports";
import { AppError } from "@/lib/adapters/errors";
import { getDashboard } from "@/lib/adapters/dashboard";
import { sourceOfControl, sourceOfFinding } from "@/lib/evidence-source";
import { SUBMISSION_DEMO } from "@/lib/submission-demo";
import type {
  AlertSummary,
  AssetSummary,
  CodeFinding,
  ControlSpec,
  EvidenceMode,
  EvidenceReport,
  MismatchFinding,
  OnchainEvidence,
} from "@/types/ui";

/**
 * Persisted asset → scan → report 경로와 화면용 셀렉터.
 */
export function fetchEvidenceReport(
  assetId: string,
  selection: { scanId?: string; reportId?: string; base?: string } = {},
): Promise<EvidenceReport> {
  return fetchEvidenceReportForAsset(assetId, selection);
}

export interface HomeEvidenceSelection {
  asset: AssetSummary;
  report: EvidenceReport;
}

type ReportLoader = (
  assetId: string,
  selection?: { scanId?: string; reportId?: string },
) => Promise<EvidenceReport>;

/** 판단 불가 연결은 확정 Risk 집계에서 제외한다. */
export function confirmedRiskFindings(report: EvidenceReport): CodeFinding[] {
  const unknownFindingIds = new Set(
    report.mismatches
      .filter((item) => item.implementation_status === "UNKNOWN")
      .map((item) => item.finding_id),
  );
  return report.code_findings.filter(
    (finding) =>
      finding.status === "CONFIRMED" && !unknownFindingIds.has(finding.finding_id),
  );
}

/**
 * 제출 홈은 canonical 합성 fixture의 저장 리포트만 선택한다.
 * 타 자산은 보존하되 theater fallback으로 사용하지 않으며, canonical 리포트가 아직
 * 없으면 정상적인 partial 상태로 처리하고 무결성 오류는 숨기지 않는다.
 */
export async function selectHomeEvidenceReport(
  assets: readonly AssetSummary[],
  loadReport: ReportLoader = fetchEvidenceReportForAsset,
): Promise<HomeEvidenceSelection | null> {
  const asset = assets.find(
    (candidate) => candidate.asset_id === SUBMISSION_DEMO.assetId,
  );
  if (!asset) return null;

  try {
    const report = await loadReport(asset.asset_id, {
      scanId: SUBMISSION_DEMO.scanId,
      reportId: SUBMISSION_DEMO.reportId,
    });
    // AssetSummary는 최신 완료 scan의 점수이고 홈 theater는 고정된 제출용
    // canonical report를 연다. 두 점수가 같은 scan을 가리킬 때만 무결성을
    // 비교해야 하며, 정상적인 재검사 후 최신 점수가 달라진 것을 손상으로
    // 오인해서는 안 된다.
    if (
      asset.exploit_risk &&
      report.exploit_risk &&
      asset.exploit_risk.scan_id === report.scan_run.scan_id &&
      JSON.stringify(asset.exploit_risk) !== JSON.stringify(report.exploit_risk)
    ) {
      throw new AppError(
        "integrity",
        409,
        { field: "exploit_risk" },
        { resource: "exploit_risk" },
      );
    }
    return { asset, report };
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.kind === "not_found" || error.kind === "unavailable")
    ) {
      return null;
    }
    throw error;
  }
}

/** 홈 호환 진입점. demo endpoint로 퇴행하지 않고 저장된 리포트만 반환한다. */
export async function fetchHomeEvidenceReport(): Promise<EvidenceReport> {
  const dashboard = await getDashboard();
  const selected = await selectHomeEvidenceReport(dashboard.assets);
  if (!selected) {
    throw new AppError("unavailable", 409, { resource: "persisted_report" });
  }
  return selected.report;
}

export async function fetchReportById(reportId: string): Promise<EvidenceReport> {
  const response = await getReport(reportId);
  if (!response.report) {
    throw new AppError("unavailable", 409, { reportId, status: response.status });
  }
  return response.report;
}

export interface Linked {
  mismatch: MismatchFinding;
  control?: ControlSpec;
  finding?: CodeFinding;
}

/** 불일치 한 건에 걸린 문서 조항과 코드 발견사항을 함께 묶는다. */
export function linkOf(report: EvidenceReport, mismatch: MismatchFinding): Linked {
  return {
    mismatch,
    control: report.controls.find((c) => c.constraint_id === mismatch.constraint_id),
    finding: report.code_findings.find((f) => f.finding_id === mismatch.finding_id),
  };
}

/** 화면이 먼저 말해야 할 불일치. 심각도가 높고 구현이 덜 된 것이 앞에 온다. */
const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const STATUS_ORDER = ["MISSING", "PARTIAL", "UNKNOWN", "IMPLEMENTED"];

function severityIndex(severity: MismatchFinding["severity"] | undefined): number {
  const index = severity ? SEVERITY_ORDER.indexOf(severity) : -1;
  return index < 0 ? SEVERITY_ORDER.length : index;
}

export function leadMismatch(report: EvidenceReport): MismatchFinding | undefined {
  return [...report.mismatches].sort((a, b) => {
    const byStatus =
      STATUS_ORDER.indexOf(a.implementation_status) -
      STATUS_ORDER.indexOf(b.implementation_status);
    if (byStatus !== 0) return byStatus;
    return severityIndex(a.severity) - severityIndex(b.severity);
  })[0];
}

/**
 * LIVE는 성공 receipt를 가진 증거가 있을 때만 노출한다.
 * receipt 없는 LIVE 레코드는 모드 근거로 사용하지 않는다.
 */
export function evidenceModeOf(report: EvidenceReport): EvidenceMode | null {
  if (
    report.onchain_evidence.some(
      (item) => item.mode === "LIVE" && item.receipt_status === "SUCCESS",
    )
  ) {
    return "LIVE";
  }
  return report.onchain_evidence.some((item) => item.mode === "REPLAY") ? "REPLAY" : null;
}

export function numeric(value: unknown): string {
  if (typeof value === "number") return value.toLocaleString("en-US");
  // boolean을 Number로 넘기면 true가 1이 되어 조건을 읽을 수 없게 된다.
  if (typeof value === "boolean") return String(value);

  const text = String(value);
  if (text.trim() === "") return text;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : text;
}

export interface SpineNode {
  kind: "SPEC" | "CODE" | "CHAIN" | "ALERT";
  label: string;
  title: string;
  locator: string;
  source?: string;
  href?: string;
  selected?: boolean;
}

/**
 * 하나의 불일치가 거친 증거 체인을 위에서 아래로 읽히게 만든다.
 * 온체인 증거가 없으면 CHAIN 노드를 지어내지 않고 생략한다.
 */
export function spineOf(
  report: EvidenceReport,
  mismatch: MismatchFinding,
  assetId: string,
  alert?: AlertSummary,
): SpineNode[] {
  const { control, finding } = linkOf(report, mismatch);
  const refs = new Set(mismatch.evidence_links.map((link) => `${link.kind}:${link.ref}`));
  const evidence: OnchainEvidence | undefined = report.onchain_evidence.find(
    (item) =>
      refs.has(`CHAIN:${item.tx_hash}`) ||
      refs.has(`CHAIN:${item.tx_hash}:${item.log_index}`),
  );
  const nodes: SpineNode[] = [];

  if (control && refs.has(`DOCUMENT:${control.constraint_id}`)) {
    nodes.push({
      kind: "SPEC",
      label: "문서 조항",
      title: `${control.field} ${numeric(control.value)}${control.unit ? ` ${control.unit}` : ""}`,
      locator: `p.${control.evidence_span.page} · span ${control.evidence_span.start}–${control.evidence_span.end}`,
      source: sourceOfControl(control).label,
      href: `/assets/${assetId}/document?constraint=${control.constraint_id}`,
    });
  }

  if (finding && refs.has(`CODE:${finding.finding_id}`)) {
    nodes.push({
      kind: "CODE",
      label: "코드",
      title: finding.title,
      locator: `${finding.code_location.file.split("/").pop()}:${finding.code_location.start_line}`,
      source: sourceOfFinding(finding).label,
      selected: true,
      href: `/assets/${encodeURIComponent(assetId)}/scan?scan=${encodeURIComponent(
        report.scan_run.scan_id,
      )}&finding=${encodeURIComponent(finding.finding_id)}`,
    });
  }

  if (evidence) {
    nodes.push({
      kind: "CHAIN",
      label: "온체인",
      title:
        evidence.previous_value && evidence.changed_value
          ? `${numeric(evidence.previous_value)} → ${numeric(evidence.changed_value)}`
          : evidence.event_name,
      locator: `block #${evidence.block_number.toLocaleString("en-US")}`,
      // 재현 데이터를 실시간으로 위장하지 않는다.
      source: evidence.mode === "REPLAY" ? "재현" : "실시간",
    });
  }

  const alertRefs = new Set(
    alert?.evidence_links.map((link) => `${link.kind}:${link.ref}`) ?? [],
  );
  const alertMismatchId =
    alert && typeof alert.cause.mismatch_id === "string" ? alert.cause.mismatch_id : undefined;
  const isLinkedAlert =
    alertMismatchId === mismatch.mismatch_id &&
    mismatch.evidence_links.every((link) => alertRefs.has(`${link.kind}:${link.ref}`));

  if (alert && isLinkedAlert) {
    nodes.push({
      kind: "ALERT",
      label: "경보",
      title: alert.alert_type,
      locator: `${alert.alert_id} · ${alert.status}`,
      source: "저장된 경보",
      href: `/reports/${encodeURIComponent(report.report_id)}?finding=${encodeURIComponent(
        mismatch.finding_id,
      )}#finding-${encodeURIComponent(mismatch.finding_id)}`,
    });
  }

  return nodes;
}
