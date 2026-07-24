import type {
  ActionFactEvent,
  ActionFactSource,
  ActionFactState,
} from "@/lib/contracts";

export type ActionFactInput = Omit<ActionFactEvent, "previous_state"> & {
  previous_state?: ActionFactState | null;
};

export type ActionFactRejectionCode =
  | "DUPLICATE_EVENT_ID"
  | "INVALID_SOURCE"
  | "INVALID_TRANSITION"
  | "MISSING_CORRECTION_TARGET"
  | "CORRECTION_TARGET_NOT_FOUND"
  | "CORRECTION_TARGET_ACTION_MISMATCH"
  | "CORRECTION_TARGET_NOT_OBSERVATION"
  | "CORRECTION_TARGET_ALREADY_CORRECTED";

export interface ActionFactRejection {
  code: ActionFactRejectionCode;
  message: string;
}

export interface AppendActionFactResult {
  events: ActionFactEvent[];
  rejected?: ActionFactRejection;
  deduplicated?: true;
}

const PROGRESS_STATES: readonly ActionFactState[] = [
  "viewed",
  "dialer_opened",
  "user_reported_connected",
  "user_reported_requested",
  "user_reported_receipt_confirmed",
];

const SOURCE_BY_STATE: Readonly<
  Partial<Record<ActionFactState, readonly ActionFactSource[]>>
> = {
  viewed: ["ui_event"],
  dialer_opened: ["ui_event"],
  user_reported_connected: ["user_statement"],
  user_reported_requested: ["user_statement"],
  user_reported_receipt_confirmed: ["user_statement"],
  not_applicable: ["user_statement"],
  unknown: ["ui_event", "user_statement"],
};

function rejected(
  events: readonly ActionFactEvent[],
  code: ActionFactRejectionCode,
  message: string,
): AppendActionFactResult {
  return {
    events: [...events],
    rejected: { code, message },
  };
}

function correctedEventIds(
  events: readonly ActionFactEvent[],
): ReadonlySet<string> {
  return new Set(
    events.flatMap((event) =>
      event.event_type === "correction" && event.corrects_event_id
        ? [event.corrects_event_id]
        : [],
    ),
  );
}

export function reduceCurrentState(
  events: readonly ActionFactEvent[],
  actionId: string,
): ActionFactState | null {
  const correctedIds = correctedEventIds(events);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (
      event.action_id === actionId &&
      event.event_type === "observation" &&
      !correctedIds.has(event.event_id)
    ) {
      return event.state;
    }
  }
  return null;
}

function sourceIsAllowed(
  state: ActionFactState,
  source: ActionFactSource,
): boolean {
  return SOURCE_BY_STATE[state]?.includes(source) ?? false;
}

function transitionIsAllowed(
  previousState: ActionFactState | null,
  nextState: ActionFactState,
): boolean {
  if (nextState === "not_applicable" || nextState === "unknown") {
    return true;
  }
  if (
    previousState === "not_applicable" ||
    previousState === "unknown"
  ) {
    return true;
  }
  if (previousState === null) {
    return nextState === "viewed";
  }

  const previousIndex = PROGRESS_STATES.indexOf(previousState);
  const nextIndex = PROGRESS_STATES.indexOf(nextState);
  return nextIndex === previousIndex + 1;
}

function appendCorrection(
  events: readonly ActionFactEvent[],
  input: ActionFactInput,
  previousState: ActionFactState | null,
): AppendActionFactResult {
  if (!input.corrects_event_id) {
    return rejected(
      events,
      "MISSING_CORRECTION_TARGET",
      "정정할 행동 이벤트 ID가 필요합니다.",
    );
  }

  const target = events.find(
    (event) => event.event_id === input.corrects_event_id,
  );
  if (!target) {
    return rejected(
      events,
      "CORRECTION_TARGET_NOT_FOUND",
      "정정할 행동 이벤트를 찾을 수 없습니다.",
    );
  }
  if (target.action_id !== input.action_id) {
    return rejected(
      events,
      "CORRECTION_TARGET_ACTION_MISMATCH",
      "같은 행동의 이벤트만 정정할 수 있습니다.",
    );
  }
  if (target.event_type !== "observation") {
    return rejected(
      events,
      "CORRECTION_TARGET_NOT_OBSERVATION",
      "관찰 이벤트만 정정할 수 있습니다.",
    );
  }
  if (correctedEventIds(events).has(target.event_id)) {
    return rejected(
      events,
      "CORRECTION_TARGET_ALREADY_CORRECTED",
      "이미 정정된 행동 이벤트입니다.",
    );
  }

  const event: ActionFactEvent = {
    ...input,
    event_type: "correction",
    corrects_event_id: target.event_id,
    previous_state: previousState,
  };
  return { events: [...events, event] };
}

export function appendActionFact(
  events: readonly ActionFactEvent[],
  input: ActionFactInput,
): AppendActionFactResult {
  if (events.some((event) => event.event_id === input.event_id)) {
    return rejected(
      events,
      "DUPLICATE_EVENT_ID",
      "이미 사용된 행동 이벤트 ID입니다.",
    );
  }

  const previousState = reduceCurrentState(events, input.action_id);
  if (input.event_type === "correction") {
    return appendCorrection(events, input, previousState);
  }

  if (!sourceIsAllowed(input.state, input.source)) {
    return rejected(
      events,
      "INVALID_SOURCE",
      "이 상태에는 허용되지 않은 기록 출처입니다.",
    );
  }

  const latest = events.at(-1);
  if (
    latest?.event_type === "observation" &&
    latest.action_id === input.action_id &&
    latest.state === input.state &&
    !correctedEventIds(events).has(latest.event_id)
  ) {
    return { events: [...events], deduplicated: true };
  }

  if (!transitionIsAllowed(previousState, input.state)) {
    return rejected(
      events,
      "INVALID_TRANSITION",
      "행동 사실 상태는 허용된 순방향으로만 기록할 수 있습니다.",
    );
  }

  const event: ActionFactEvent = {
    ...input,
    event_type: "observation",
    previous_state: previousState,
  };
  return { events: [...events, event] };
}
