import {
  DEVICE_COMPROMISE_STATES,
  EXPOSURE_STATES,
  SAFE_DEVICE_AVAILABILITIES,
  TRANSFER_STATES,
  USER_ROLES,
  type ActionFactEvent,
  type IncidentState,
} from "@/lib/contracts";
import type { DecisionResult } from "@/lib/decision";

export const DESK_SESSION_KEY = "goldentime.rule0-desk.v1";

export type EmergencyChoice =
  | "sent"
  | "installed"
  | "credentials"
  | "unknown";

export interface DeskSessionSnapshot {
  version: 1;
  emergency_choice: EmergencyChoice;
  incident_state: IncidentState;
  decision_result: DecisionResult;
  action_events: ActionFactEvent[];
  template_versions: string[];
  easy_mode: boolean;
  non_call_confirmations: string[];
  rule0_samples_ms: number[];
  comparison_samples_ms: number[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIncidentState(value: unknown): value is IncidentState {
  if (!isRecord(value)) {
    return false;
  }
  return (
    TRANSFER_STATES.includes(
      value.transfer_state as (typeof TRANSFER_STATES)[number],
    ) &&
    DEVICE_COMPROMISE_STATES.includes(
      value.device_compromise_state as (typeof DEVICE_COMPROMISE_STATES)[number],
    ) &&
    EXPOSURE_STATES.includes(
      value.credential_exposure_state as (typeof EXPOSURE_STATES)[number],
    ) &&
    EXPOSURE_STATES.includes(
      value.personal_data_exposure_state as (typeof EXPOSURE_STATES)[number],
    ) &&
    USER_ROLES.includes(value.user_role as (typeof USER_ROLES)[number]) &&
    SAFE_DEVICE_AVAILABILITIES.includes(
      value.safe_device_available as (typeof SAFE_DEVICE_AVAILABILITIES)[number],
    )
  );
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === "number" && Number.isFinite(item) && item >= 0,
    )
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isActionEvents(value: unknown): value is ActionFactEvent[] {
  return (
    Array.isArray(value) &&
    value.every(
      (event) =>
        isRecord(event) &&
        typeof event.event_id === "string" &&
        typeof event.action_id === "string" &&
        typeof event.occurred_at === "string",
    )
  );
}

function isDecisionResult(value: unknown): value is DecisionResult {
  return (
    isRecord(value) &&
    Array.isArray(value.actions) &&
    Array.isArray(value.next_steps)
  );
}

function parseSnapshot(value: unknown): DeskSessionSnapshot | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }
  if (
    !["sent", "installed", "credentials", "unknown"].includes(
      String(value.emergency_choice),
    ) ||
    !isIncidentState(value.incident_state) ||
    !isDecisionResult(value.decision_result) ||
    !isActionEvents(value.action_events) ||
    !isStringArray(value.template_versions) ||
    typeof value.easy_mode !== "boolean" ||
    !isStringArray(value.non_call_confirmations) ||
    !isNumberArray(value.rule0_samples_ms) ||
    !isNumberArray(value.comparison_samples_ms)
  ) {
    return null;
  }
  return value as unknown as DeskSessionSnapshot;
}

export function saveDeskSession(
  storage: Pick<Storage, "setItem">,
  snapshot: DeskSessionSnapshot,
): void {
  const safePayload: DeskSessionSnapshot = {
    version: 1,
    emergency_choice: snapshot.emergency_choice,
    incident_state: snapshot.incident_state,
    decision_result: snapshot.decision_result,
    action_events: snapshot.action_events,
    template_versions: snapshot.template_versions,
    easy_mode: snapshot.easy_mode,
    non_call_confirmations: snapshot.non_call_confirmations,
    rule0_samples_ms: snapshot.rule0_samples_ms,
    comparison_samples_ms: snapshot.comparison_samples_ms,
  };
  storage.setItem(DESK_SESSION_KEY, JSON.stringify(safePayload));
}

export function loadDeskSession(
  storage: Pick<Storage, "getItem">,
): DeskSessionSnapshot | null {
  const raw = storage.getItem(DESK_SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return parseSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearDeskSession(
  storage: Pick<Storage, "removeItem">,
): void {
  storage.removeItem(DESK_SESSION_KEY);
}
