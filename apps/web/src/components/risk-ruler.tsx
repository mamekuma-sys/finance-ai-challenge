import { gradeOf, scoreOf, topContributors } from "@/lib/exploit-risk";
import type { CodeFinding } from "@/types/ui";

/**
 * Exploit Risk 눈금자.
 *
 * 원형 게이지를 쓰지 않는다. 0~100 임계값이 보이는 눈금자로 표시하고 점수
 * 아래에 상위 원인을 둔다. 숫자를 장식하지 않고 계산 가능한 판정으로 보이게
 * 한다.
 *
 * 계약에 risk score 필드가 아직 없어 화면이 PRD FR-06 산식으로 계산한다.
 * 지어낸 숫자가 아니며, 서버 확정 전임을 함께 표시한다.
 */
const TICKS = [0, 20, 40, 60, 80, 100];

export function RiskRuler({
  findings,
  compact = false,
}: {
  findings: readonly CodeFinding[];
  compact?: boolean;
}) {
  const score = scoreOf(findings);
  const grade = gradeOf(score);
  const contributors = topContributors(findings);

  return (
    <section aria-label="Exploit Risk">
      <p className="key" style={{ margin: 0 }}>
        EXPLOIT RISK
      </p>

      <p className="risk-score">
        <span className="risk-number" data-testid="risk-score">
          {score}
        </span>
        <span className="risk-grade" data-grade={grade}>
          {grade}
        </span>
      </p>

      <div
        className="risk-track"
        role="meter"
        aria-label="Exploit Risk 점수"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <span className="risk-fill" style={{ width: `${score}%` }} />
        <span className="risk-marker" style={{ left: `${score}%` }} />
      </div>

      {compact ? (
        <div className="risk-ticks">
          <span>0</span>
          <span>100</span>
        </div>
      ) : (
        <div className="risk-ticks">
          {TICKS.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      )}

      {contributors.length > 0 ? (
        <ul className="rows" style={{ marginTop: 14 }}>
          {contributors.map((finding) => (
            <li key={finding.finding_id}>
              <div
                className="row"
                style={{ padding: "8px 0", gap: 10, borderColor: "var(--line-quiet)" }}
              >
                <span className="mono" style={{ fontSize: "var(--t-label)" }}>
                  {finding.rule_id}
                </span>
                <span
                  className="row-tail"
                  style={{
                    color:
                      finding.severity === "CRITICAL" ? "var(--breach)" : "var(--warn)",
                    fontSize: "var(--t-label)",
                    fontWeight: 700,
                  }}
                >
                  {finding.severity}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="risk-note">FR-06 산식 기준 · 서버 확정 전</p>
    </section>
  );
}
