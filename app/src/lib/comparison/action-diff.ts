import type { DecisionActionCard, DecisionResult } from "@/lib/decision";

export type ChangeKind = "added" | "removed" | "rank_changed" | "unchanged";

export interface CardChange {
  kind: ChangeKind;
  previous_priority?: number;
  next_priority?: number;
  added_prerequisites: string[];
}

function allCards(result: DecisionResult): DecisionActionCard[] {
  return [...result.actions, ...result.next_steps];
}

export function compareCard(
  mergeKey: string,
  before: DecisionResult,
  after: DecisionResult,
): CardChange {
  const previous = allCards(before).find(
    (card) => card.merge_key === mergeKey,
  );
  const next = allCards(after).find((card) => card.merge_key === mergeKey);

  if (!previous && next) {
    return {
      kind: "added",
      next_priority: next.priority,
      added_prerequisites: [...next.prerequisite],
    };
  }
  if (previous && !next) {
    return {
      kind: "removed",
      previous_priority: previous.priority,
      added_prerequisites: [],
    };
  }
  if (!previous || !next) {
    return { kind: "unchanged", added_prerequisites: [] };
  }

  const addedPrerequisites = next.prerequisite.filter(
    (item) => !previous.prerequisite.includes(item),
  );
  return {
    kind:
      previous.priority === next.priority ? "unchanged" : "rank_changed",
    previous_priority: previous.priority,
    next_priority: next.priority,
    added_prerequisites: addedPrerequisites,
  };
}

export function prohibitedUnion(result: DecisionResult): string[] {
  return [
    ...new Set(
      allCards(result).flatMap((card) => card.prohibited_actions),
    ),
  ];
}
