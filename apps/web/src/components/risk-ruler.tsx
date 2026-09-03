import { riskGradeLabel, topContributors } from "@/lib/exploit-risk";
import type { ExploitRisk } from "@/types/ui";

/**
 * Exploit Risk 눈금자.
 *
 * 원형 게이지를 쓰지 않는다. 0~100 임계값이 보이는 눈금자로 표시하고 점수
 * 아래에 상위 원인을 둔다. 숫자를 장식하지 않고 계산 가능한 판정으로 보이게
 * 한다.
 *
 * 점수와 기여도는 서버가 계산한 immutable 계약을 그대로 표시한다.
 */
const TICKS = [0, 20, 40, 60, 80, 100];

export function RiskRuler({
  risk,
  compact = false,
}: {
  risk: ExploitRisk | null | undefined;
  compact?: boolean;
}) {
  if (!risk) {
    return (
      <section aria-label="Exploit Risk">
        <p className="key" style={{ margin: 0 }}>EXPLOIT RISK</p>
        <p className="risk-score"><span className="risk-number">—</span><span className="risk-grade">미산출</span></p>
        <p className="risk-note">서버 점수가 없는 구형 또는 미완료 검사 · 담당자 검토 필요</p>
      </section>
    );
  }
  const score = risk.score;
  const grade = riskGradeLabel(risk.grade);
  const contributors = topContributors(risk);
  const totalContributors = risk.contributors?.length ?? 0;

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
        <>
        <p className="key" style={{ margin: "14px 0 0" }}>
          {totalContributors > contributors.length
            ? `상위 원인 ${contributors.length} / 전체 ${totalContributors}`
            : `상위 원인 ${totalContributors}`}
        </p>
        <ul className="rows" aria-label="Exploit Risk 상위 기여 원인">
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
                  +{finding.contribution.toFixed(2)} · {finding.confidence.toFixed(2)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        </>
      ) : null}

      <p className="risk-note">
        서버 결정론적 계산 · {risk.rule_versions?.EXPLOIT_RISK_SCORE ?? "룰 버전 미제공"}
      </p>
    </section>
  );
}
