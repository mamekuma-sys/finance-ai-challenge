import type { IncidentState } from "@/lib/contracts";

import type { MergeKey } from "../rules";

export interface DecisionSnapshotFixture {
  readonly id: "a" | "b" | "c" | "d" | "e";
  readonly label: string;
  readonly state: IncidentState;
  readonly action_merge_keys: readonly MergeKey[];
  readonly next_step_merge_keys: readonly MergeKey[];
  readonly prohibited_actions: readonly string[];
  readonly template_versions: readonly string[];
}

export const DECISION_SNAPSHOT_FIXTURES = [
  {
    id: "a",
    label: "송금 완료 + 의심 앱 + 안전 기기 없음",
    state: {
      transfer_state: "already_sent",
      device_compromise_state: "suspected_app",
      credential_exposure_state: "none",
      personal_data_exposure_state: "none",
      user_role: "self",
      safe_device_available: "no",
    },
    action_merge_keys: [
      "device:isolate",
      "call:bank_fraud",
      "call:112",
      "procedure:written_followup",
    ],
    next_step_merge_keys: [],
    prohibited_actions: [
      "감염이 의심되는 기기에서 금융 앱을 사용하지 마세요.",
      "그 기기에서 대표번호를 검색하거나 인증정보를 다시 입력하지 마세요.",
      "재판정 결과를 기다리느라 지급정지 요청을 미루지 마세요.",
      "본인계좌 일괄지급정지를 상대 계좌 지급정지의 대체로 여기지 마세요.",
      "해당(의심·미확인) 기기의 금융 앱 사용·검색을 하지 마세요.",
    ],
    template_versions: [
      "TPL-SAFE-DEVICE-001@1.0",
      "TPL-BANK-STOP-001@1.0",
      "TPL-WRITTEN-FOLLOWUP-001@1.1",
    ],
  },
  {
    id: "b",
    label: "송금 완료 + 원격제어 + 인증정보 공유 + 안전 기기 있음",
    state: {
      transfer_state: "already_sent",
      device_compromise_state: "remote_control",
      credential_exposure_state: "shared",
      personal_data_exposure_state: "none",
      user_role: "self",
      safe_device_available: "yes",
    },
    action_merge_keys: [
      "call:bank_fraud",
      "call:112",
      "action:credential_recovery",
      "procedure:written_followup",
    ],
    next_step_merge_keys: [],
    prohibited_actions: [
      "감염이 의심되는 기기의 금융 앱·통화·검색으로 긴급 조치를 하지 마세요.",
      "재판정 결과를 기다리느라 지급정지 요청을 미루지 마세요.",
      "본인계좌 일괄지급정지를 상대 계좌 지급정지의 대체로 여기지 마세요.",
      "AI 분석 결과를 기다리느라 조치를 미루지 마세요.",
      "상대가 알려준 번호·링크·앱을 사용하지 마세요.",
      "해당(의심·미확인) 기기의 금융 앱 사용·검색을 하지 마세요.",
    ],
    template_versions: [
      "TPL-SAFE-DEVICE-001@1.0",
      "TPL-BANK-STOP-001@1.0",
      "TPL-CREDENTIAL-RECOVERY-001@1.0",
      "TPL-WRITTEN-FOLLOWUP-001@1.1",
    ],
  },
  {
    id: "c",
    label: "송금 여부 미확인 + 인증정보 공유",
    state: {
      transfer_state: "unknown",
      device_compromise_state: "none",
      credential_exposure_state: "shared",
      personal_data_exposure_state: "none",
      user_role: "self",
      safe_device_available: "yes",
    },
    action_merge_keys: [
      "question:state_confirm",
      "call:bank_fraud",
      "call:112",
      "action:credential_recovery",
    ],
    next_step_merge_keys: [
      "verify:official_channel",
      "call:1332",
    ],
    prohibited_actions: [
      "AI 분석 결과를 기다리느라 조치를 미루지 마세요.",
      "상대가 알려준 번호·링크·앱을 사용하지 마세요.",
      "‘낮음’ 판정이나 비긴급 경로를 확정된 것으로 여기지 마세요.",
    ],
    template_versions: [
      "TPL-UNDETERMINED-001@1.0",
      "TPL-CREDENTIAL-RECOVERY-001@1.0",
    ],
  },
  {
    id: "d",
    label: "가족 확인 + 송금 완료",
    state: {
      transfer_state: "already_sent",
      device_compromise_state: "none",
      credential_exposure_state: "none",
      personal_data_exposure_state: "none",
      user_role: "family_proxy",
      safe_device_available: "yes",
    },
    action_merge_keys: [
      "call:bank_fraud",
      "call:112",
      "procedure:written_followup",
      "notice:proxy_scope",
    ],
    next_step_merge_keys: [],
    prohibited_actions: [
      "재판정 결과를 기다리느라 지급정지 요청을 미루지 마세요.",
      "본인계좌 일괄지급정지를 상대 계좌 지급정지의 대체로 여기지 마세요.",
      "가족이 대신 신고·접수할 수 있다고 여기지 마세요 — ECRM 온라인 신고 등 본인 제한 절차는 본인이 직접 수행해야 합니다.",
    ],
    template_versions: [
      "TPL-BANK-STOP-001@1.0",
      "TPL-WRITTEN-FOLLOWUP-001@1.1",
      "TPL-PROXY-SCOPE-001@1.0",
    ],
  },
  {
    id: "e",
    label: "미송금 + 개인정보 공유 + 기기·안전 기기 미확인",
    state: {
      transfer_state: "not_sent",
      device_compromise_state: "unknown",
      credential_exposure_state: "none",
      personal_data_exposure_state: "shared",
      user_role: "self",
      safe_device_available: "unknown",
    },
    action_merge_keys: [
      "question:state_confirm",
      "action:stop_contact",
      "verify:official_channel",
      "call:1332",
    ],
    next_step_merge_keys: [],
    prohibited_actions: [
      "개인정보 노출만으로 상대 계좌 지급정지나 신고 접수가 확정되지는 않습니다.",
      "‘낮음’ 판정이나 비긴급 경로를 확정된 것으로 여기지 마세요.",
      "해당(의심·미확인) 기기의 금융 앱 사용·검색을 하지 마세요.",
    ],
    template_versions: [
      "TPL-UNDETERMINED-001@1.0",
      "TPL-OFFICIAL-VERIFY-001@1.0",
    ],
  },
] as const satisfies readonly DecisionSnapshotFixture[];
