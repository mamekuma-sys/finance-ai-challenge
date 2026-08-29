import Link from "next/link";

import { Badge } from "@/components/badge";
import { Icon } from "@/components/icon";
import { FindingSourceBadge } from "@/components/source-badge";
import { leadMismatch, linkOf, numeric } from "@/lib/evidence-report";
import type { EvidenceReport } from "@/types/ui";

/**
 * 화면 맨 위 한 줄 판정.
 *
 * 심사자는 10초 안에 "가장 위험한 자산은 무엇이고, 문제는 어디이며, 근거는
 * 어디에 있는가"를 확인해야 한다. 숫자만 크게 띄우면 셋 중 아무것도 답하지
 * 못하므로 무엇이 왜 잘못됐는지를 문장으로 먼저 말하고 다음 행동을 준다.
 */
export function VerdictBanner({
  report,
  assetId,
  reportId,
  theater = false,
}: {
  report: EvidenceReport;
  assetId: string;
  reportId: string;
  theater?: boolean;
}) {
  const mismatch = leadMismatch(report);
  const linked = mismatch ? linkOf(report, mismatch) : undefined;

  if (!mismatch || !linked?.finding || mismatch.implementation_status === "IMPLEMENTED") {
    return (
      <section className="verdict" data-tone="clear" aria-label={theater ? "최우선 판정" : undefined}>
        <div className="verdict-body">
          <div className="verdict-tags">
            <Badge tone="safe" icon={Icon.check(10)}>
              자동검사 통과
            </Badge>
          </div>
          {theater ? (
            <h1 className="verdict-display" data-testid="theater-verdict-sentence">
              결정론적 검사에서 결함을 찾지 못했습니다.
            </h1>
          ) : (
            <h2>결정론적 검사에서 결함을 찾지 못했습니다.</h2>
          )}
          <p className="verdict-detail">담당자 검토가 필요한 상태입니다.</p>
        </div>
      </section>
    );
  }

  const { control, finding } = linked;

  if (theater) {
    const needsReview =
      finding.status !== "CONFIRMED" || mismatch.implementation_status === "UNKNOWN";
    const reviewLabel = mismatch.implementation_status === "UNKNOWN"
      ? "판단 불가 · 담당자 확인"
      : `${finding.status} · 담당자 확인`;
    return (
      <section
        className="verdict"
        data-tone={needsReview ? "HIGH" : mismatch.severity}
        aria-label="최우선 판정"
      >
        <div className="verdict-body">
          <div className="verdict-tags">
            <Badge tone={needsReview ? "warn" : "breach-solid"}>
              {needsReview ? reviewLabel : mismatch.severity}
            </Badge>
            <FindingSourceBadge finding={finding} />
            <span className="mono verdict-rule">rule {finding.rule_id}</span>
          </div>
          <h1 className="verdict-display" data-testid="theater-verdict-sentence">
            {needsReview
              ? `자동 분석에서 “${finding.title}” 후보가 감지됐지만 확정 근거가 부족해 담당자 확인 필요 상태입니다.`
              : control
              ? `발행 문서는 “${control.evidence_span.quote}”라고 약속하지만, 코드는 이를 강제하지 않습니다.`
              : `문서 통제와 코드 현실의 불일치가 확인됐지만 연결된 문서 조항이 없습니다.`}
          </h1>
          <p className="verdict-detail">{finding.title}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="verdict" data-tone={mismatch.severity}>
      <div className="verdict-body">
        <div className="verdict-tags">
          <Badge tone="breach-solid">{mismatch.severity}</Badge>
          <FindingSourceBadge finding={finding} />
          <span className="mono" style={{ fontSize: "10.5px", color: "var(--ink-muted)" }}>
            rule {finding.rule_id}
          </span>
        </div>

        <h2>{finding.title}</h2>

        {control ? (
          <p className="verdict-detail">
            발행 문서는{" "}
            <strong>
              {control.field} {numeric(control.value)}
              {control.unit ? ` ${control.unit}` : ""}
            </strong>{" "}
            을 요구하지만 코드가 이를 강제하지 않습니다.
          </p>
        ) : null}
      </div>

      <div className="verdict-actions">
        <Link className="btn btn-primary" href={`/assets/${assetId}/scan`}>
          근거 보기
        </Link>
        <Link className="btn" href={`/reports/${reportId}`}>
          리포트
        </Link>
      </div>
    </section>
  );
}
