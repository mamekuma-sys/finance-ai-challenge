import Link from "next/link";

import type { EvidenceReport, ImplementationStatus } from "@/types/contracts";

/**
 * 문서 조항과 코드 구현이 어긋난 지점 목록.
 *
 * 불변식 5: 모든 Critical/High는 문서 page/span과 코드 file/line을 연결한다.
 * 그래서 행마다 문서 조항과 코드 라인으로 가는 링크를 둘 다 둔다.
 */
/** 수치는 콘솔 전체에서 같은 방식으로 읽히도록 천 단위를 구분한다. */
function formatValue(value: unknown, unit: string | null | undefined): string {
  const shown = typeof value === "number" ? value.toLocaleString("en-US") : String(value);
  return unit ? `${shown} ${unit}` : shown;
}

const STATUS_LABEL: Record<ImplementationStatus, string> = {
  IMPLEMENTED: "구현됨",
  PARTIAL: "부분 구현",
  MISSING: "미구현",
  UNKNOWN: "판단 불가",
};

export function MismatchList({
  report,
  assetId,
}: {
  report: EvidenceReport;
  assetId: string;
}) {
  if (report.mismatches.length === 0) {
    return (
      <p className="mismatch-clear">
        자동검사 통과 — 담당자 검토 필요
      </p>
    );
  }

  return (
    <ul className="mismatch-list">
      {report.mismatches.map((mismatch) => {
        const control = report.controls.find(
          (entry) => entry.constraint_id === mismatch.constraint_id,
        );
        const finding = report.code_findings.find(
          (entry) => entry.finding_id === mismatch.finding_id,
        );

        return (
          <li className="mismatch" key={mismatch.mismatch_id}>
            <header className="mismatch-head">
              <span className="mismatch-severity" data-severity={mismatch.severity}>
                {mismatch.severity}
              </span>
              <span className="mismatch-status">{STATUS_LABEL[mismatch.implementation_status]}</span>
            </header>

            <div className="mismatch-sides">
              <div>
                <p className="mismatch-eyebrow">발행 문서가 요구하는 것</p>
                <p className="mismatch-control">
                  {control
                    ? `${control.field} ${formatValue(control.value, control.unit)}`
                    : "연결된 조항 없음"}
                </p>
                {control ? (
                  <Link
                    href={`/assets/${assetId}/document?constraint=${control.constraint_id}`}
                  >
                    문서 조항 보기
                  </Link>
                ) : null}
              </div>

              <div>
                <p className="mismatch-eyebrow">코드가 실제로 하는 것</p>
                <p className="mismatch-finding">{finding?.title ?? "연결된 발견사항 없음"}</p>
                {finding ? (
                  <Link
                    href={`#${finding.code_location.file}-L${finding.code_location.start_line}`}
                  >
                    코드 라인 보기
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
