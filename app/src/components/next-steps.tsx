import type { DecisionActionCard } from "@/lib/decision";
import { displayCardTitle } from "@/lib/ui/labels";

interface NextStepsProps {
  cards: readonly DecisionActionCard[];
}

const NEXT_STEP_PHONE_ACTIONS: Readonly<
  Record<string, { href: string; label: string }>
> = {
  "call:112": { href: "tel:112", label: "112로 전화 걸기" },
  "call:1332": { href: "tel:1332", label: "1332로 전화 걸기" },
  "procedure:written_followup": {
    href: "tel:1394",
    label: "1394로 전화 걸기",
  },
};

export function NextSteps({ cards }: NextStepsProps) {
  if (cards.length === 0) {
    return null;
  }
  return (
    <details className="next-steps">
      <summary>접힌 다음 행동 (전부 보존됨)</summary>
      <ol start={cards[0].priority}>
        {cards.map((card) => (
          <li key={card.id} value={card.priority}>
            <strong>
              {card.priority}. {displayCardTitle(card)}
            </strong>
            {card.question_axes && card.question_axes.length > 0 ? (
              <p>할 일: 질문에 답하면 행동 순서가 바로 바뀝니다.</p>
            ) : (
              <p>할 일: {card.purpose_slots.join(", ")}</p>
            )}
            {card.prerequisite.length > 0 ? (
              <p>먼저 확인할 조건: {card.prerequisite.join(", ")}</p>
            ) : null}
            {NEXT_STEP_PHONE_ACTIONS[card.merge_key] ? (
              <a
                className="next-step-call"
                href={NEXT_STEP_PHONE_ACTIONS[card.merge_key].href}
              >
                <span aria-hidden="true">☎</span>{" "}
                {NEXT_STEP_PHONE_ACTIONS[card.merge_key].label}
              </a>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
