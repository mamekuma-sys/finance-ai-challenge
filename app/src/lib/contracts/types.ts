export type VerdictLevel = "danger" | "caution" | "low" | "undetermined";
export type EvidenceStrength = "high" | "medium" | "low";
export type Channel =
  | "sms"
  | "messenger"
  | "call_transcript"
  | "email"
  | "web"
  | "other";
export type TransferState = "not_sent" | "already_sent" | "unknown";
export type DeviceCompromiseState =
  | "none"
  | "suspected_app"
  | "remote_control"
  | "unknown";
export type ExposureState = "none" | "suspected" | "shared" | "unknown";
export type UserRole = "self" | "family_proxy";
export type SafeDeviceAvailable = "yes" | "no" | "unknown";
export type ActionFactState =
  | "viewed"
  | "dialer_opened"
  | "user_reported_connected"
  | "user_reported_requested"
  | "user_reported_receipt_confirmed"
  | "not_applicable"
  | "unknown";
export type ActionFactSource = "ui_event" | "user_statement";

export interface IncidentState {
  transfer_state: TransferState;
  device_compromise_state: DeviceCompromiseState;
  credential_exposure_state: ExposureState;
  personal_data_exposure_state: ExposureState;
  user_role: UserRole;
  safe_device_available: SafeDeviceAvailable;
}

export interface AnalyzeRequest {
  scenario_id?: string;
  text?: string;
  masking_confirmed?: boolean;
  channel?: Channel;
  incident_state: IncidentState;
  easy_mode?: boolean;
}

// 행동 이벤트 이력(내 기기 보관): 브라우저 sessionStorage 전용, 서버 미전송.
export interface ActionFactEvent {
  event_id: string;
  action_id: string;
  event_type: "observation" | "correction";
  corrects_event_id?: string;
  occurred_at: string;
  state: ActionFactState;
  source: ActionFactSource;
  previous_state: ActionFactState | null;
}

export interface ActionCard {
  id: string;
  priority: number;
  rule_ids: string[];
  merge_key: string;
  trigger: string[];
  prerequisite: string[];
  purpose_slots: string[];
  do_not_show_when: string[];
  prohibited_actions: string[];
  required_followup: string[];
  official_sources: string[];
  template_versions: string[];
}

export interface AnalyzeResponse {
  request_id: string;
  status: "ready" | "needs_input" | "fallback";
  verdict: {
    level: VerdictLevel;
    evidence_strength: EvidenceStrength;
    summary: string;
    evidence_label: "공개 수법 패턴과의 유사 신호";
    evidence: Array<{
      indicator_id: string;
      label: string;
      source_refs: string[];
    }>;
  };
  questions: Array<{ id: string; prompt: string; options: string[] }>;
  actions: ActionCard[];
  next_steps: ActionCard[];
  disclaimer: string;
}

export const TRANSFER_STATES = [
  "not_sent",
  "already_sent",
  "unknown",
] as const satisfies readonly TransferState[];

export const DEVICE_COMPROMISE_STATES = [
  "none",
  "suspected_app",
  "remote_control",
  "unknown",
] as const satisfies readonly DeviceCompromiseState[];

export const EXPOSURE_STATES = [
  "none",
  "suspected",
  "shared",
  "unknown",
] as const satisfies readonly ExposureState[];

export const USER_ROLES = [
  "self",
  "family_proxy",
] as const satisfies readonly UserRole[];

export const SAFE_DEVICE_AVAILABILITIES = [
  "yes",
  "no",
  "unknown",
] as const satisfies readonly SafeDeviceAvailable[];

export const ACTION_FACT_STATES = [
  "viewed",
  "dialer_opened",
  "user_reported_connected",
  "user_reported_requested",
  "user_reported_receipt_confirmed",
  "not_applicable",
  "unknown",
] as const satisfies readonly ActionFactState[];

export const ACTION_FACT_SOURCES = [
  "ui_event",
  "user_statement",
] as const satisfies readonly ActionFactSource[];
