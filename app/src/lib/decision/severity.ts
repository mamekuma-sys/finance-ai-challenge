import type { IncidentState } from "@/lib/contracts";

import type { RuleId } from "./rules";

export type SeverityRank = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type QuestionAxis =
  | "transfer"
  | "device"
  | "credential"
  | "personal_data";

export const POTENTIAL_SEVERITY: Readonly<
  Record<QuestionAxis, SeverityRank>
> = {
  device: 1,
  transfer: 3,
  credential: 4,
  personal_data: 6,
};

export function severityOf(state: IncidentState): SeverityRank {
  if (state.device_compromise_state === "remote_control") {
    return 1;
  }
  if (state.device_compromise_state === "suspected_app") {
    return 2;
  }
  if (state.transfer_state === "already_sent") {
    return 3;
  }
  if (state.credential_exposure_state === "shared") {
    return 4;
  }
  if (state.credential_exposure_state === "suspected") {
    return 5;
  }
  if (
    state.personal_data_exposure_state === "shared" ||
    state.personal_data_exposure_state === "suspected"
  ) {
    return 6;
  }
  return 7;
}

export function ruleRowSeverity(
  ruleId: RuleId,
  state: IncidentState,
): SeverityRank {
  switch (ruleId) {
    case "R1":
    case "R2":
      return state.device_compromise_state === "remote_control" ? 1 : 2;
    case "R3":
      return 3;
    case "R4":
      return state.credential_exposure_state === "shared" ? 4 : 5;
    case "R5":
      return 6;
    case "R6":
    case "R7":
      return 7;
  }
}
