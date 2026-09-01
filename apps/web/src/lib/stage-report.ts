import { coverageOf } from "@/lib/control-coverage";
import type { EvidenceReport, ScanRun } from "@/types/ui";
import type { ScreenState } from "@/lib/screen-state";

/**
 * `?state=`로 요청한 화면 상태를 report에 적용한다.
 *
 * 상태표(docs/product/screens-and-states.md)가 요구하는 여섯 상태를 실제
 * 데이터 위에서 재현하기 위한 개발용 경로다. 정상 상태에서는 아무것도
 * 바꾸지 않으므로 운영 화면에는 영향이 없다.
 */
export interface Staged {
  report: EvidenceReport;
  /** 화면이 비어야 하는 상태인가. */
  empty: boolean;
}

export function stageReport(report: EvidenceReport, state: ScreenState): Staged {
  if (state === "empty") {
    return {
      empty: true,
      report: {
        ...report,
        controls: [],
        code_findings: [],
        mismatches: [],
        onchain_evidence: [],
        exploit_risk: null,
      },
    };
  }

  if (state === "partial") {
    const scan: ScanRun = {
      ...report.scan_run,
      status: "PARTIAL",
      failed_stages: [
        {
          stage: "contract_analysis",
          rule_id: "ORACLE_RANGE_MISSING",
          reason: "solc AST 생성 시간이 초과했습니다",
        },
      ],
    };
    // 실패한 룰의 결과만 걷어내고 나머지는 그대로 둔다.
    return {
      empty: false,
      report: {
        ...report,
        scan_run: scan,
        code_findings: report.code_findings.filter(
          (finding) => finding.rule_id !== "ORACLE_RANGE_MISSING",
        ),
        mismatches: report.mismatches.filter(
          (mismatch) => mismatch.finding_id !== "finding_oracle_range_missing",
        ),
        exploit_risk: null,
      },
    };
  }

  if (state === "unknown") {
    return {
      empty: false,
      report: {
        ...report,
        code_findings: report.code_findings.map((finding) => ({
          ...finding,
          status: "NEEDS_REVIEW" as const,
        })),
        mismatches: report.mismatches.map((mismatch) => ({
          ...mismatch,
          implementation_status: "UNKNOWN" as const,
        })),
        controls: report.controls.map((control) => ({ ...control, confirmed: false })),
        exploit_risk: null,
      },
    };
  }

  if (state === "replay") {
    return {
      empty: false,
      report: {
        ...report,
        onchain_evidence: report.onchain_evidence.map((entry) => ({
          ...entry,
          mode: "REPLAY" as const,
        })),
      },
    };
  }

  return { empty: false, report };
}

export function summaryOf(report: EvidenceReport) {
  const coverage = coverageOf(report);
  const evidence = report.onchain_evidence[0];

  return {
    coverage,
    evidence,
    assetId: report.scan_run.asset_id,
    reportId: report.report_id,
    mode: evidence?.mode ?? null,
    blockNumber: evidence?.block_number ?? null,
  };
}
