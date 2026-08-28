import type { EvidenceReport, ImplementationStatus } from "@/types/ui";

/**
 * 통제조건이 코드에 얼마나 반영됐는지 세는 단일 규칙.
 *
 * 화면마다 따로 세면 같은 자산을 두고 서로 다른 숫자를 말하게 된다.
 * 관제 홈의 커버리지, 검증 결과의 불일치 건수, 자산 상세의 상태 목록이
 * 모두 이 함수를 쓴다.
 */
export interface ControlCoverage {
  implemented: number;
  partial: number;
  missing: number;
  /** 검사 대상이 아니었거나 판단하지 못한 조건. 구현됨으로 세지 않는다. */
  unjudged: number;
  /** 완전 구현이 아닌 모든 조건. 부분 구현도 불일치다. */
  mismatched: number;
  total: number;
}

export function coverageOf(report: EvidenceReport): ControlCoverage {
  const byConstraint = new Map<string, ImplementationStatus>();
  for (const mismatch of report.mismatches) {
    byConstraint.set(mismatch.constraint_id, mismatch.implementation_status);
  }

  const coverage: ControlCoverage = {
    implemented: 0,
    partial: 0,
    missing: 0,
    unjudged: 0,
    mismatched: 0,
    total: report.controls.length,
  };

  for (const control of report.controls) {
    switch (byConstraint.get(control.constraint_id)) {
      case "IMPLEMENTED":
        coverage.implemented += 1;
        break;
      case "PARTIAL":
        coverage.partial += 1;
        coverage.mismatched += 1;
        break;
      case "MISSING":
        coverage.missing += 1;
        coverage.mismatched += 1;
        break;
      default:
        // mismatch 행이 없는 조건은 아직 검사하지 않은 것이다.
        coverage.unjudged += 1;
    }
  }

  return coverage;
}
