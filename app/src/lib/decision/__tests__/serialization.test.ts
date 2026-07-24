import { describe, expect, it } from "vitest";

import {
  DEVICE_COMPROMISE_STATES,
  EXPOSURE_STATES,
  SAFE_DEVICE_AVAILABILITIES,
  TRANSFER_STATES,
  USER_ROLES,
  type IncidentState,
} from "@/lib/contracts";

import {
  DECISION_RESULT_DISCLAIMER,
  decideActions,
  serializeDecisionResult,
} from "../engine";

const ALL_STATES: IncidentState[] = TRANSFER_STATES.flatMap((transfer) =>
  DEVICE_COMPROMISE_STATES.flatMap((device) =>
    EXPOSURE_STATES.flatMap((credential) =>
      EXPOSURE_STATES.flatMap((personalData) =>
        USER_ROLES.flatMap((userRole) =>
          SAFE_DEVICE_AVAILABILITIES.map((safeDevice) => ({
            transfer_state: transfer,
            device_compromise_state: device,
            credential_exposure_state: credential,
            personal_data_exposure_state: personalData,
            user_role: userRole,
            safe_device_available: safeDevice,
          })),
        ),
      ),
    ),
  ),
);

describe("A4 결정 결과 권한 한계 직렬화", () => {
  it("1,152개 모든 직렬화 결과에 고정 disclaimer를 결합한다", () => {
    expect(ALL_STATES).toHaveLength(1_152);

    for (const state of ALL_STATES) {
      const serialized = serializeDecisionResult(decideActions(state));
      expect(serialized.disclaimer).toBe(DECISION_RESULT_DISCLAIMER);
      expect(serialized.disclaimer.trim().length).toBeGreaterThan(0);
      expect(serialized).toHaveProperty("actions");
      expect(serialized).toHaveProperty("next_steps");
    }
  });
});
