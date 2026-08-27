import Link from "next/link";

import type { CodeFinding, EvidenceReport } from "@/types/contracts";

/**
 * 화면 맨 위 한 줄 판정.
 *
 * 시각 문서 §7.2: 심사자가 10초 안에 "지금 가장 위험한 자산은 무엇이고,
 * 문제는 어디이며, 근거는 어디에 있는가"를 확인해야 한다. 숫자만 크게
 * 띄우면 그 셋 중 아무것도 답하지 못하므로, 무엇이 왜 잘못됐는지를
 * 문장으로 먼저 말하고 바로 다음 행동을 준다.
 */
const DEMO_REPORT_ID = "report_demo_01";

function statusWord(status: CodeFinding["status"]): string {
  switch (status) {
    case "CONFIRMED":
      return "확정";
    case "PROBABLE":
      return "유력";
    case "NEEDS_REVIEW":
      return "확인 필요";
    default:
      return "판단 불가";
  }
}

export function VerdictBanner({
  report,
  assetId,
}: {
  report: EvidenceReport;
  assetId: string;
}) {
  const mismatch = report.mismatches[0];
  const finding = mismatch
    ? report.code_findings.find((entry) => entry.finding_id === mismatch.finding_id)
    : undefined;
  const control = mismatch
    ? report.controls.find((entry) => entry.constraint_id === mismatch.constraint_id)
    : undefined;

  if (!mismatch || !finding) {
    return (
      <section className="verdict" data-tone="clear">
        <p className="verdict-eyebrow">판정</p>
        <h2>자동검사 통과</h2>
        <p className="verdict-detail">
          결정론적 검사에서 결함을 찾지 못했습니다. 담당자 검토 필요 상태입니다.
        </p>
      </section>
    );
  }

  const value =
    control && typeof control.value === "number"
      ? control.value.toLocaleString("en-US")
      : control?.value;

  return (
    <section className="verdict" data-tone={mismatch.severity}>
      <p className="verdict-eyebrow">판정</p>
      <h2>{finding.title}</h2>

      <p className="verdict-detail">
        {control ? (
          <>
            발행 문서는{" "}
            <strong>
              {control.field} {value}
              {control.unit ? ` ${control.unit}` : ""}
            </strong>
            를 요구하지만 코드가 이를 강제하지 않습니다.
          </>
        ) : (
          "문서 조항과 코드 구현이 어긋납니다."
        )}
      </p>

      <div className="verdict-foot">
        <span className="verdict-severity">
          {statusWord(finding.status)} {mismatch.severity}
        </span>
        <Link className="verdict-action" href={`/assets/${assetId}/scan`}>
          근거 보기
        </Link>
        <Link className="verdict-action" href={`/reports/${DEMO_REPORT_ID}`}>
          리포트 열기
        </Link>
      </div>
    </section>
  );
}
