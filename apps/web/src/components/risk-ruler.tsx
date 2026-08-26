import { gradeOf, scoreOf, topContributors } from "@/lib/exploit-risk";
import type { CodeFinding } from "@/types/contracts";

/**
 * Exploit Risk 눈금자.
 *
 * 시각 문서 §7.7: 원형 게이지를 쓰지 않는다. 0~100 임계값이 보이는 눈금자로
 * 표시하고 점수 아래에 상위 원인을 둔다. 숫자를 장식하지 않고 계산 가능한
 * 판정으로 보이게 한다.
 */
const TICKS = [0, 20, 40, 60, 80, 100];

export function RiskRuler({ findings }: { findings: readonly CodeFinding[] }) {
  const score = scoreOf(findings);
  const grade = gradeOf(score);
  const contributors = topContributors(findings);

  return (
    <section className="risk" aria-label="Exploit Risk">
      <div className="risk-head">
        <span className="risk-label">EXPLOIT RISK</span>
        <span className="risk-grade" data-grade={grade}>
          {grade}
        </span>
      </div>

      <p className="risk-score" data-testid="risk-score">
        {score}
      </p>

      <div
        className="risk-track"
        role="meter"
        aria-label="Exploit Risk 점수"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <span className="risk-marker" style={{ left: `${score}%` }} />
        <span className="risk-ticks" aria-hidden="true">
          {TICKS.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </span>
      </div>

      <ul className="risk-contributors">
        {contributors.length === 0 ? (
          <li className="risk-empty">점수에 기여한 발견사항이 없습니다.</li>
        ) : (
          contributors.map((finding) => (
            <li key={finding.finding_id}>
              <span className="risk-rule">{finding.rule_id}</span>
              <span className="risk-severity">{finding.severity}</span>
            </li>
          ))
        )}
      </ul>

      {/* 계약에 risk score 필드가 없어 화면이 FR-06 공식으로 계산한 값이다. */}
      <p className="risk-provisional">FR-06 공식 기준 임시 계산 · 서버 확정 전</p>
    </section>
  );
}
