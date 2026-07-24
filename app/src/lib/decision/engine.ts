import type { ActionCard, IncidentState } from "@/lib/contracts";

import { PROHIBITIONS } from "./prohibitions";
import {
  COUNTER_SCAM_1394_GUIDANCE,
  RULES,
  WRITTEN_FOLLOWUP_PREREQUISITE,
  WRITTEN_FOLLOWUP_PURPOSE,
  WRITTEN_FOLLOWUP_REQUIREMENT,
  WRITTEN_FOLLOWUP_TITLE,
  type MergeKey,
  type RuleAction,
  type RuleId,
} from "./rules";
import {
  POTENTIAL_SEVERITY,
  ruleRowSeverity,
  type QuestionAxis,
  type SeverityRank,
} from "./severity";
import {
  InvalidIncidentStateError,
  validateIncidentState,
} from "./validation";

const SAFE_DEVICE_PREREQUISITE =
  "의심 기기와 분리된 안전한 기기에서 실행";
const FAMILY_PROXY_PREREQUISITE = "가족을 대신해 확인 중";
const PROCEDURE_KEYS: readonly MergeKey[] = [
  "call:bank_fraud",
  "call:112",
  "procedure:written_followup",
];
const SAFE_DEVICE_ACTION_KEYS: readonly MergeKey[] = [
  "call:bank_fraud",
  "call:112",
  "call:1332",
  "action:credential_recovery",
];
export const DECISION_RESULT_DISCLAIMER =
  "이 서비스는 지급정지·신고 접수·수사 판정을 수행하지 않습니다.";

interface CollectedRow extends RuleAction {
  rule_id: RuleId;
  row_severity: SeverityRank;
  question_axes?: QuestionAxis[];
}

export interface DecisionActionCard extends ActionCard {
  title: string;
  severity: SeverityRank;
  order: number;
  forced: boolean;
  question_axes?: QuestionAxis[];
  question_position?: "first" | "after_emergency";
}

export interface DecisionResult {
  actions: DecisionActionCard[];
  next_steps: DecisionActionCard[];
}

function uniqueInOrder<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function compareCollectedRows(
  left: CollectedRow,
  right: CollectedRow,
): number {
  return (
    left.row_severity - right.row_severity ||
    left.rule_id.localeCompare(right.rule_id) ||
    left.order - right.order
  );
}

function compareCards(
  left: DecisionActionCard,
  right: DecisionActionCard,
): number {
  if (left.question_position && right.question_position) {
    return 0;
  }
  if (left.question_position === "first") {
    return -1;
  }
  if (right.question_position === "first") {
    return 1;
  }
  if (left.question_position === "after_emergency") {
    return right.severity <= 5 ? 1 : -1;
  }
  if (right.question_position === "after_emergency") {
    return left.severity <= 5 ? -1 : 1;
  }

  return (
    left.severity - right.severity ||
    left.order - right.order ||
    (left.rule_ids[0] ?? "").localeCompare(right.rule_ids[0] ?? "") ||
    left.merge_key.localeCompare(right.merge_key)
  );
}

function applyQuestionPosition(
  cards: readonly DecisionActionCard[],
  rows: readonly CollectedRow[],
): DecisionActionCard[] {
  const questionCard = cards.find(
    (card) =>
      card.merge_key === "question:state_confirm" &&
      card.question_axes !== undefined,
  );
  if (!questionCard) {
    return [...cards];
  }

  const confirmedHighestSeverity = rows
    .filter((row) => row.rule_id !== "R7")
    .reduce<SeverityRank>(
      (minimum, row) =>
        row.row_severity < minimum ? row.row_severity : minimum,
      7,
    );
  const questionPosition =
    questionCard.severity < confirmedHighestSeverity
      ? "first"
      : "after_emergency";

  return cards.map((card) =>
    card.id === questionCard.id
      ? { ...card, question_position: questionPosition }
      : card,
  );
}

export function selectQuestionAxes(state: IncidentState): QuestionAxis[] {
  const axes: QuestionAxis[] = [];
  if (state.device_compromise_state === "unknown") {
    axes.push("device");
  }
  if (state.transfer_state === "unknown") {
    axes.push("transfer");
  }
  if (state.credential_exposure_state === "unknown") {
    axes.push("credential");
  }
  if (state.personal_data_exposure_state === "unknown") {
    axes.push("personal_data");
  }

  const sorted = axes.toSorted(
    (left, right) =>
      POTENTIAL_SEVERITY[left] - POTENTIAL_SEVERITY[right],
  );
  if (sorted.length === 4) {
    return sorted.filter((axis) => axis !== "personal_data");
  }
  return sorted.slice(0, 3);
}

function collectRows(state: IncidentState): CollectedRow[] {
  const questionAxes = selectQuestionAxes(state);
  const questionSeverity =
    questionAxes.length > 0
      ? Math.min(...questionAxes.map((axis) => POTENTIAL_SEVERITY[axis]))
      : 7;

  return RULES.flatMap((rule) => {
    if (!rule.match(state)) {
      return [];
    }

    return rule.actions.map((action): CollectedRow => {
      const isUnknownQuestion =
        rule.id === "R7" && action.merge_key === "question:state_confirm";
      return {
        ...action,
        rule_id: rule.id,
        row_severity: isUnknownQuestion
          ? (questionSeverity as SeverityRank)
          : ruleRowSeverity(rule.id, state),
        ...(isUnknownQuestion ? { question_axes: questionAxes } : {}),
      };
    });
  });
}

function mergeRows(rows: readonly CollectedRow[]): DecisionActionCard[] {
  const rowsByMergeKey = new Map<MergeKey, CollectedRow[]>();
  for (const row of rows) {
    const groupedRows = rowsByMergeKey.get(row.merge_key);
    if (groupedRows) {
      groupedRows.push(row);
    } else {
      rowsByMergeKey.set(row.merge_key, [row]);
    }
  }

  return [...rowsByMergeKey.entries()].map(([mergeKey, groupedRows]) => {
    const sortedRows = groupedRows.toSorted(compareCollectedRows);
    const winner = sortedRows[0];
    const questionAxes = sortedRows.flatMap((row) => row.question_axes ?? []);

    return {
      id: `action:${mergeKey}`,
      priority: 0,
      title: winner.title,
      severity: winner.row_severity,
      order: winner.order,
      forced: false,
      rule_ids: uniqueInOrder(
        sortedRows.map((row) => row.rule_id).toSorted(),
      ),
      merge_key: mergeKey,
      trigger: uniqueInOrder(sortedRows.map((row) => row.rule_id)),
      prerequisite: [...winner.prerequisite],
      purpose_slots: uniqueInOrder(
        sortedRows.map((row) => row.purpose_slot),
      ),
      do_not_show_when: [],
      prohibited_actions: [],
      required_followup: uniqueInOrder(
        sortedRows.flatMap((row) => row.required_followup),
      ),
      official_sources: uniqueInOrder(
        sortedRows.flatMap((row) => row.source_ids),
      ),
      template_versions: uniqueInOrder(
        sortedRows.flatMap((row) => row.template_versions),
      ),
      ...(questionAxes.length > 0
        ? { question_axes: uniqueInOrder(questionAxes) }
        : {}),
    };
  });
}

function ensureWrittenFollowup(
  cards: readonly DecisionActionCard[],
  state: IncidentState,
): DecisionActionCard[] {
  if (state.transfer_state !== "already_sent") {
    return [...cards];
  }

  const existing = cards.find(
    (card) => card.merge_key === "procedure:written_followup",
  );
  if (existing) {
    return cards.map((card) =>
      card.merge_key === "procedure:written_followup"
        ? { ...card, forced: true }
        : card,
    );
  }

  return [
    ...cards,
    {
      id: "action:procedure:written_followup",
      priority: 0,
      title: WRITTEN_FOLLOWUP_TITLE,
      severity: 3,
      order: 3,
      forced: true,
      rule_ids: ["R3"],
      merge_key: "procedure:written_followup",
      trigger: ["transfer_state=already_sent"],
      prerequisite: [WRITTEN_FOLLOWUP_PREREQUISITE],
      purpose_slots: [WRITTEN_FOLLOWUP_PURPOSE],
      do_not_show_when: [],
      prohibited_actions: [],
      required_followup: [
        WRITTEN_FOLLOWUP_REQUIREMENT,
        COUNTER_SCAM_1394_GUIDANCE,
      ],
      official_sources: [
        "SRC-EASYLAW-CONTACT",
        "SRC-EASYLAW-STOPPAY",
        "SRC-LAW-DECREE3",
        "SRC-KOREA-1394",
      ],
      template_versions: ["TPL-WRITTEN-FOLLOWUP-001@1.1"],
    },
  ];
}

function addProxyCard(
  cards: readonly DecisionActionCard[],
  state: IncidentState,
): DecisionActionCard[] {
  const hasProcedureCard = cards.some((card) =>
    PROCEDURE_KEYS.includes(card.merge_key as MergeKey),
  );
  if (state.user_role !== "family_proxy" || !hasProcedureCard) {
    return [...cards];
  }

  return [
    ...cards,
    {
      id: "action:notice:proxy_scope",
      priority: 0,
      title: "본인 제한 절차 안내",
      severity: 7,
      order: 1,
      forced: true,
      rule_ids: [],
      merge_key: "notice:proxy_scope",
      trigger: ["user_role=family_proxy", "신고·지급정지 절차 카드 존재"],
      prerequisite: [],
      purpose_slots: [
        "본인 제한 절차는 본인이 수행하고 가족은 준비를 보조",
      ],
      do_not_show_when: [],
      prohibited_actions: [],
      required_followup: [
        "ECRM 온라인 신고 등 본인 제한 절차는 본인이 수행하고, 가족은 준비를 보조합니다.",
      ],
      official_sources: ["SRC-EASYLAW-CONTACT"],
      template_versions: ["TPL-PROXY-SCOPE-001@1.0"],
    },
  ];
}

function collectProhibitedActions(
  state: IncidentState,
  cards: readonly DecisionActionCard[],
): string[] {
  const matchedRuleProhibitions = RULES.flatMap((rule) =>
    rule.match(state)
      ? rule.prohibition_ids.map((id) => PROHIBITIONS[id])
      : [],
  );
  const needsDeviceModifier =
    state.device_compromise_state === "suspected_app" ||
    state.device_compromise_state === "remote_control" ||
    state.device_compromise_state === "unknown";
  const hasProxyCard = cards.some(
    (card) => card.merge_key === "notice:proxy_scope",
  );

  return uniqueInOrder([
    ...matchedRuleProhibitions,
    ...(needsDeviceModifier ? [PROHIBITIONS["PRH-MOD-DEVICE"]] : []),
    ...(hasProxyCard ? [PROHIBITIONS["PRH-MOD-PROXY"]] : []),
  ]);
}

function applyModifiers(
  cards: readonly DecisionActionCard[],
  state: IncidentState,
): DecisionActionCard[] {
  const prohibitedActions = collectProhibitedActions(state, cards);
  const needsSafeDevice =
    state.device_compromise_state === "suspected_app" ||
    state.device_compromise_state === "remote_control" ||
    state.device_compromise_state === "unknown";

  return cards.map((card) => {
    const prerequisite = [...card.prerequisite];
    if (
      needsSafeDevice &&
      SAFE_DEVICE_ACTION_KEYS.includes(card.merge_key as MergeKey)
    ) {
      prerequisite.push(SAFE_DEVICE_PREREQUISITE);
    }
    if (state.user_role === "family_proxy") {
      prerequisite.push(FAMILY_PROXY_PREREQUISITE);
    }

    return {
      ...card,
      prerequisite: uniqueInOrder(prerequisite),
      prohibited_actions: prohibitedActions,
    };
  });
}

function assertQuestionPlacement(
  cards: readonly DecisionActionCard[],
  rows: readonly CollectedRow[],
  state: IncidentState,
): void {
  const questionCard = cards.find(
    (card) =>
      card.merge_key === "question:state_confirm" &&
      card.question_axes !== undefined,
  );
  if (!questionCard) {
    return;
  }

  const sorted = cards.toSorted(compareCards);
  const questionIndex = sorted.findIndex(
    (card) => card.id === questionCard.id,
  );
  const confirmedHighestSeverity = rows
    .filter((row) => row.rule_id !== "R7")
    .reduce<SeverityRank>(
      (minimum, row) =>
        row.row_severity < minimum ? row.row_severity : minimum,
      7,
    );

  const placementMatches =
    questionCard.severity < confirmedHighestSeverity
      ? questionIndex === 0
      : sorted
          .slice(0, questionIndex)
          .filter(
            (card) =>
              card.question_axes === undefined && card.severity <= 5,
          ).length ===
        sorted.filter(
          (card) =>
            card.question_axes === undefined && card.severity <= 5,
        ).length;

  if (!placementMatches) {
    throw new Error(
      `확인 질문 카드 위치가 §4.5.1 ②와 일치하지 않습니다: ${JSON.stringify(state)}`,
    );
  }
}

function reserveVisibleSlots(
  cards: readonly DecisionActionCard[],
): {
  visible: DecisionActionCard[];
  next: DecisionActionCard[];
} {
  const sorted = cards.toSorted(compareCards);
  const proxyCard = sorted.find(
    (card) => card.merge_key === "notice:proxy_scope",
  );
  const forcedCards = sorted.filter((card) => card.forced);
  const remainingSlots = 4 - forcedCards.length;
  const selectedGeneral = sorted
    .filter((card) => !card.forced)
    .slice(0, remainingSlots);
  const selectedIds = new Set(
    [...forcedCards, ...selectedGeneral].map((card) => card.id),
  );

  const visibleWithoutProxy = sorted.filter(
    (card) => selectedIds.has(card.id) && card.id !== proxyCard?.id,
  );
  const visible = proxyCard
    ? [...visibleWithoutProxy, proxyCard]
    : visibleWithoutProxy;
  const next = sorted.filter((card) => !selectedIds.has(card.id));

  return { visible, next };
}

function assignPriorities(
  visible: readonly DecisionActionCard[],
  next: readonly DecisionActionCard[],
): DecisionResult {
  const actions = visible.map((card, index) => ({
    ...card,
    priority: index + 1,
  }));
  const nextSteps = next.map((card, index) => ({
    ...card,
    priority: actions.length + index + 1,
  }));
  return { actions, next_steps: nextSteps };
}

export function serializeActionCard(card: DecisionActionCard): ActionCard {
  return {
    id: card.id,
    priority: card.priority,
    rule_ids: [...card.rule_ids],
    merge_key: card.merge_key,
    trigger: [...card.trigger],
    prerequisite: [...card.prerequisite],
    purpose_slots: [...card.purpose_slots],
    do_not_show_when: [...card.do_not_show_when],
    prohibited_actions: [...card.prohibited_actions],
    required_followup: [...card.required_followup],
    official_sources: [...card.official_sources],
    template_versions: [...card.template_versions],
  };
}

export function serializeDecisionResult(result: DecisionResult): {
  actions: ActionCard[];
  next_steps: ActionCard[];
  disclaimer: string;
} {
  return {
    actions: result.actions.map(serializeActionCard),
    next_steps: result.next_steps.map(serializeActionCard),
    disclaimer: DECISION_RESULT_DISCLAIMER,
  };
}

export function decideActions(state: IncidentState): DecisionResult {
  validateIncidentState(state);
  const rows = collectRows(state);
  const mergedCards = mergeRows(rows);
  const positionedCards = applyQuestionPosition(mergedCards, rows);
  assertQuestionPlacement(positionedCards, rows, state);
  const withWrittenFollowup = ensureWrittenFollowup(positionedCards, state);
  const withProxy = addProxyCard(withWrittenFollowup, state);
  const modifiedCards = applyModifiers(withProxy, state);
  const { visible, next } = reserveVisibleSlots(modifiedCards);
  return assignPriorities(visible, next);
}

export type DecideActionsSafeResult =
  | { readonly ok: true; readonly value: DecisionResult }
  | {
      readonly ok: false;
      readonly error: InvalidIncidentStateError;
    };

export function decideActionsSafe(state: unknown): DecideActionsSafeResult {
  try {
    validateIncidentState(state);
    return { ok: true, value: decideActions(state) };
  } catch (error) {
    if (error instanceof InvalidIncidentStateError) {
      return { ok: false, error };
    }
    throw error;
  }
}
