import { describe, expect, it } from "vitest";

import { decideActions } from "@/lib/decision";

import {
  loadDeskSession,
  saveDeskSession,
  type DeskSessionSnapshot,
} from "../desk-session";

class MemoryStorage {
  value: string | null = null;

  setItem(key: string, value: string) {
    void key;
    this.value = value;
  }

  getItem(key: string) {
    void key;
    return this.value;
  }
}

const state = {
  transfer_state: "already_sent",
  device_compromise_state: "none",
  credential_exposure_state: "none",
  personal_data_exposure_state: "none",
  user_role: "self",
  safe_device_available: "yes",
} as const;

describe("사기대응 데스크 sessionStorage 경계", () => {
  it("허용된 상태·결과·이벤트·버전을 왕복 복구한다", () => {
    const storage = new MemoryStorage();
    const snapshot: DeskSessionSnapshot = {
      version: 1,
      emergency_choice: "sent",
      incident_state: state,
      decision_result: decideActions(state),
      action_events: [],
      template_versions: ["TPL-BANK-STOP-001@1.0"],
      easy_mode: true,
      non_call_confirmations: [],
      rule0_samples_ms: [18.2],
      comparison_samples_ms: [7.1],
    };
    saveDeskSession(storage, snapshot);
    expect(loadDeskSession(storage)).toEqual(snapshot);
  });

  it("호출 객체에 섞인 원문·민감 키를 저장 payload에서 제거한다", () => {
    const storage = new MemoryStorage();
    const snapshot = {
      version: 1,
      emergency_choice: "sent",
      incident_state: state,
      decision_result: decideActions(state),
      action_events: [],
      template_versions: [],
      easy_mode: false,
      non_call_confirmations: [],
      rule0_samples_ms: [],
      comparison_samples_ms: [],
      raw_text: "저장되면 안 되는 원문",
      account_number: "저장되면 안 되는 계좌",
      resident_number: "저장되면 안 되는 식별값",
      password: "저장되면 안 되는 비밀번호",
    } as DeskSessionSnapshot & Record<string, unknown>;

    saveDeskSession(storage, snapshot);
    expect(storage.value).not.toContain("raw_text");
    expect(storage.value).not.toContain("account_number");
    expect(storage.value).not.toContain("resident_number");
    expect(storage.value).not.toContain("password");
  });
});
