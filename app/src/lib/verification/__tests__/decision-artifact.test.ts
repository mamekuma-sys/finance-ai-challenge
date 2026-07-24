import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEVICE_COMPROMISE_STATES,
  EXPOSURE_STATES,
  SAFE_DEVICE_AVAILABILITIES,
  TRANSFER_STATES,
  USER_ROLES,
  type IncidentState,
} from "@/lib/contracts";
import { decideActions } from "@/lib/decision";

describe("결정 엔진 빌드 표시용 테스트 산출물", () => {
  it("실제로 통과한 전체 조합 수를 JSON으로 내보낸다", () => {
    const states: IncidentState[] = TRANSFER_STATES.flatMap((transfer) =>
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

    let verifiedCombinations = 0;
    for (const state of states) {
      const result = decideActions(state);
      expect(result.actions.length).toBeGreaterThan(0);
      verifiedCombinations += 1;
    }
    expect(verifiedCombinations).toBe(states.length);

    const outputDirectory = path.join(process.cwd(), "public", "generated");
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(
      path.join(outputDirectory, "decision-verification.json"),
      `${JSON.stringify(
        {
          generated_by: "vitest:decision-artifact",
          verified_combinations: verifiedCombinations,
          status: "passed",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});
