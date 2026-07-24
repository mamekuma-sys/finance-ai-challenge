import type { DecisionActionCard } from "@/lib/decision";

interface NextStepsProps {
  cards: readonly DecisionActionCard[];
}

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
              {card.priority}. {card.title}
            </strong>
            <p>할 일: {card.purpose_slots.join(", ")}</p>
            {card.prerequisite.length > 0 ? (
              <p>먼저 확인할 조건: {card.prerequisite.join(", ")}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
