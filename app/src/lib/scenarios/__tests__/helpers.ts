import {
  DEVICE_COMPROMISE_STATES,
  EXPOSURE_STATES,
  SAFE_DEVICE_AVAILABILITIES,
  TRANSFER_STATES,
  USER_ROLES,
  type IncidentState,
} from "@/lib/contracts";

/** §4.1 Channel 열거값 — 테스트 전용 사본(계약 변경 시 여기서 깨져야 한다). */
export const CHANNELS_FOR_TEST = [
  "sms",
  "messenger",
  "call_transcript",
  "email",
  "web",
  "other",
] as const;

/** §4.4의 6개 필드가 전부 존재하고 열거값 안에 있는지 독립 검사한다. */
export function isValidIncidentState(state: IncidentState): boolean {
  return (
    (TRANSFER_STATES as readonly string[]).includes(state.transfer_state) &&
    (DEVICE_COMPROMISE_STATES as readonly string[]).includes(
      state.device_compromise_state,
    ) &&
    (EXPOSURE_STATES as readonly string[]).includes(
      state.credential_exposure_state,
    ) &&
    (EXPOSURE_STATES as readonly string[]).includes(
      state.personal_data_exposure_state,
    ) &&
    (USER_ROLES as readonly string[]).includes(state.user_role) &&
    (SAFE_DEVICE_AVAILABILITIES as readonly string[]).includes(
      state.safe_device_available,
    )
  );
}
