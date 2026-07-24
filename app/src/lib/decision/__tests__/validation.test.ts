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
  decideActions,
  decideActionsSafe,
  InvalidIncidentStateError,
} from "../index";

const VALID_STATES: IncidentState[] = TRANSFER_STATES.flatMap(
  (transfer) =>
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

function callWithUnknown(value: unknown) {
  return decideActions(value as IncidentState);
}

function expectInvalid(value: unknown): InvalidIncidentStateError {
  try {
    callWithUnknown(value);
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidIncidentStateError);
    expect(error).toMatchObject({
      code: "INVALID_INCIDENT_STATE",
      name: "InvalidIncidentStateError",
    });
    return error as InvalidIncidentStateError;
  }
  throw new Error("비정상 incident_state가 거부되지 않았습니다.");
}

describe("A1 incident_state 런타임 검증", () => {
  it.each([
    ["빈 객체", {}],
    ["부분 입력", { transfer_state: "already_sent" }],
    [
      "계약 밖 열거값",
      {
        transfer_state: "sent-outside-contract",
        device_compromise_state: "compromised-outside-contract",
        credential_exposure_state: "leaked-outside-contract",
        personal_data_exposure_state: "leaked-outside-contract",
        user_role: "delegate-outside-contract",
        safe_device_available: "maybe-outside-contract",
      },
    ],
    ["null", null],
    ["undefined", undefined],
    ["배열", []],
    [
      "추가 키",
      {
        transfer_state: "not_sent",
        device_compromise_state: "none",
        credential_exposure_state: "none",
        personal_data_exposure_state: "none",
        user_role: "self",
        safe_device_available: "yes",
        extra: "must-not-be-accepted",
      },
    ],
  ])("%s를 빈 결과 대신 명시적으로 거부한다", (_label, value) => {
    expectInvalid(value);
  });

  it("오류가 입력 값이나 추가 키 이름을 반사하지 않는다", () => {
    const secretValue = "010-0000-0000-secret-value";
    const secretKey = "secret-input-key";
    const error = expectInvalid({
      transfer_state: secretValue,
      device_compromise_state: "none",
      credential_exposure_state: "none",
      personal_data_exposure_state: "none",
      user_role: "self",
      safe_device_available: "yes",
      [secretKey]: "another-secret",
    });
    const serializedError = JSON.stringify({
      message: error.message,
      issues: error.issues,
    });

    expect(serializedError).not.toContain(secretValue);
    expect(serializedError).not.toContain(secretKey);
    expect(serializedError).not.toContain("another-secret");
    expect(serializedError).toContain("transfer_state");
    expect(serializedError).toContain("not_sent");
  });

  it("Result API도 같은 비반사 오류 계약을 제공한다", () => {
    const result = decideActionsSafe({
      transfer_state: "private-value",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INCIDENT_STATE");
      expect(result.error.message).not.toContain("private-value");
    }
  });

  it("유효한 1,152개 조합을 한 건도 거부하지 않는다", () => {
    expect(VALID_STATES).toHaveLength(1_152);
    let rejected = 0;

    for (const state of VALID_STATES) {
      const result = decideActionsSafe(state);
      if (!result.ok) {
        rejected += 1;
      }
    }

    expect(rejected).toBe(0);
  });
});
