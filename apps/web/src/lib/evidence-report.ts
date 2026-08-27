import { api } from "@/lib/api-client";
import type { EvidenceReport, SpineNode } from "@/types/contracts";

/**
 * Evidence Report 조회와 화면용 셀렉터.
 *
 * 데모 endpoint는 AI와 RPC 없이 결정론적 report를 돌려주는 P0 E2E 시드다.
 * 종인이의 실 endpoint가 붙기 전까지 화면은 이 경로로 실데이터를 받는다.
 */
export async function fetchDemoEvidenceReport(): Promise<EvidenceReport> {
  const { data, error } = await api.GET("/v1/demo/evidence-report");

  if (error !== undefined || data === undefined) {
    // 원본 오류를 그대로 올리지 않는다. 화면 문구는 error 경계가 만든다.
    throw new Error("EVIDENCE_REPORT_UNAVAILABLE");
  }

  return data;
}

function formatNumeric(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : value;
}

/**
 * 하나의 불일치가 어떤 증거 체인을 거쳤는지 위에서 아래로 읽히게 만든다.
 *
 * 순서는 문서 → 코드 → 체인 → 경보로 고정한다. 온체인 증거가 없으면
 * CHAIN 노드를 지어내지 않고 생략한다.
 */
export function toSpineNodes(report: EvidenceReport, mismatchId: string): SpineNode[] {
  const mismatch = report.mismatches.find((entry) => entry.mismatch_id === mismatchId);

  if (mismatch === undefined) {
    return [];
  }

  const control = report.controls.find(
    (entry) => entry.constraint_id === mismatch.constraint_id,
  );
  const finding = report.code_findings.find(
    (entry) => entry.finding_id === mismatch.finding_id,
  );
  const evidence = report.onchain_evidence.find(
    (entry) => entry.asset_id === report.scan_run.asset_id,
  );

  const nodes: SpineNode[] = [];

  if (control !== undefined) {
    const value =
      typeof control.value === "number" ? control.value.toLocaleString("en-US") : control.value;

    nodes.push({
      kind: "SPEC",
      title: `${control.field} ${value}${control.unit ? ` ${control.unit}` : ""}`,
      locator: `문서 p.${control.evidence_span.page} · span ${control.evidence_span.start}–${control.evidence_span.end}`,
    });
  }

  if (finding !== undefined) {
    nodes.push({
      kind: "CODE",
      title: finding.title,
      locator: `${finding.code_location.file}:${finding.code_location.start_line}–${finding.code_location.end_line}`,
    });
  }

  if (evidence !== undefined) {
    const changed = formatNumeric(evidence.changed_value);

    nodes.push({
      kind: "CHAIN",
      title: changed === undefined ? evidence.event_name : `${evidence.event_name} ${changed}`,
      // 재현 데이터를 실시간으로 위장하지 않는다.
      locator: `${evidence.mode} · block #${evidence.block_number.toLocaleString("en-US")}`,
    });
  }

  if (finding !== undefined) {
    nodes.push({
      kind: "ALERT",
      title: `구현 상태 ${mismatch.implementation_status}`,
      locator: `${mismatch.severity} · ${finding.rule_id}`,
    });
  }

  return nodes;
}
