import { Badge } from "@/components/badge";
import { Icon } from "@/components/icon";
import { sourceOfControl, sourceOfFinding } from "@/lib/evidence-source";
import type { EvidenceSource } from "@/lib/evidence-source";
import type { CodeFinding, ControlSpec } from "@/types/ui";

/**
 * 판정 출처 배지.
 *
 * 이 제품이 금융 심사에서 신뢰를 얻는 지점이다. "AI가 다 찾아준다"가 아니라
 * "AI는 여기까지, 확정은 룰이 한다"를 화면이 스스로 보여준다.
 * 모델 이름은 노출하지 않는다.
 */
function toneOf(source: EvidenceSource) {
  switch (source.kind) {
    case "DETERMINISTIC":
    case "REVIEWED":
      return "safe" as const;
    case "ANALYSIS":
      return "accent" as const;
    default:
      return "neutral" as const;
  }
}

export function SourceBadge({ source }: { source: EvidenceSource }) {
  const deterministic = source.kind === "DETERMINISTIC" || source.kind === "REVIEWED";

  return (
    <Badge tone={toneOf(source)} icon={deterministic ? Icon.check(10) : Icon.spark(10)}>
      {source.label}
    </Badge>
  );
}

export function ControlSourceBadge({ control }: { control: ControlSpec }) {
  return <SourceBadge source={sourceOfControl(control)} />;
}

export function FindingSourceBadge({ finding }: { finding: CodeFinding }) {
  return <SourceBadge source={sourceOfFinding(finding)} />;
}
