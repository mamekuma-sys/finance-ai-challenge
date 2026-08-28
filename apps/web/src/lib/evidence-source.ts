import type { CodeFinding, ControlSpec } from "@/types/ui";

/**
 * 판정 출처.
 *
 * AGENTS.md 불변식 3·4가 이 모듈의 이유다. AI는 문서 구조화와 의미 매핑을
 * 담당하고, 확정 Critical/High는 결정론적 근거를 반드시 가진다. AI 단독
 * 결과는 NEEDS_REVIEW이며 CONFIRMED로 승격할 수 없다.
 *
 * 화면은 이 구분을 숨기지 않는다. 심사자가 "AI가 다 찾아준다"가 아니라
 * "AI는 여기까지, 확정은 룰이 한다"를 화면에서 바로 읽을 수 있어야 한다.
 */
export type EvidenceSourceKind = "DETERMINISTIC" | "REVIEWED" | "ANALYSIS" | "UNJUDGED";

export interface EvidenceSource {
  kind: EvidenceSourceKind;
  label: string;
  needsReview: boolean;
}

const DETERMINISTIC: EvidenceSource = {
  kind: "DETERMINISTIC",
  label: "AST 룰 확정",
  needsReview: false,
};
const REVIEWED: EvidenceSource = { kind: "REVIEWED", label: "담당자 확정", needsReview: false };
const ANALYSIS: EvidenceSource = { kind: "ANALYSIS", label: "의미 분석", needsReview: true };
const PROBABLE: EvidenceSource = { kind: "ANALYSIS", label: "유력", needsReview: true };
const UNJUDGED: EvidenceSource = { kind: "UNJUDGED", label: "판단 불가", needsReview: true };

/**
 * 문서에서 뽑은 통제조건은 결정론적일 수 없다. 사람이 확인해야 확정이 된다.
 */
export function sourceOfControl(control: ControlSpec): EvidenceSource {
  return control.confirmed ? REVIEWED : ANALYSIS;
}

/**
 * 코드 판정만 결정론적 근거를 가질 수 있다.
 */
export function sourceOfFinding(finding: CodeFinding): EvidenceSource {
  switch (finding.status) {
    case "CONFIRMED":
      return DETERMINISTIC;
    case "PROBABLE":
      return PROBABLE;
    case "NEEDS_REVIEW":
      return ANALYSIS;
    default:
      return UNJUDGED;
  }
}
