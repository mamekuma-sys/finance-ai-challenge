import type {
  DeviceCompromiseState,
  ExposureState,
  IncidentState,
  SafeDeviceAvailable,
} from "@/lib/contracts";
import type { TemplateVersion } from "@/lib/templates/registry";

import type { ProhibitionId } from "./prohibitions";
import type { SourceId } from "./sources";

export const RULE_IDS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7"] as const;
export type RuleId = (typeof RULE_IDS)[number];

export const MERGE_KEYS = [
  "device:isolate",
  "call:bank_fraud",
  "call:112",
  "call:1332",
  "procedure:written_followup",
  "verify:official_channel",
  "action:credential_recovery",
  "action:stop_contact",
  "action:stop_risky",
  "question:state_confirm",
  "notice:proxy_scope",
] as const;

export type MergeKey = (typeof MERGE_KEYS)[number];

export interface RuleAction {
  order: number;
  merge_key: MergeKey;
  title: string;
  purpose_slot: string;
  prerequisite: string[];
  required_followup: string[];
  source_ids: SourceId[];
  template_versions: TemplateVersion[];
}

export interface Rule {
  id: RuleId;
  match: (state: IncidentState) => boolean;
  actions: RuleAction[];
  prohibition_ids: ProhibitionId[];
}

const COMPROMISED_DEVICES: readonly DeviceCompromiseState[] = [
  "suspected_app",
  "remote_control",
];
const UNSAFE_OR_UNKNOWN_DEVICE_AVAILABILITY: readonly SafeDeviceAvailable[] = [
  "no",
  "unknown",
];
const EXPOSED_STATES: readonly ExposureState[] = ["suspected", "shared"];
export const WRITTEN_FOLLOWUP_TITLE =
  "긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우, 신청한 날부터 3일 이내에 피해구제신청서를 해당 금융회사에 제출해야 합니다.";
export const WRITTEN_FOLLOWUP_PURPOSE =
  "긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우, 신청한 날부터 3일 이내에 피해구제신청서를 해당 금융회사에 제출해야 합니다.";
export const WRITTEN_FOLLOWUP_PREREQUISITE =
  "긴급·부득이한 사유로 전화·구술로 피해구제를 신청한 경우";
export const WRITTEN_FOLLOWUP_REQUIREMENT =
  "긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우, 신청한 날부터 3일 이내에 피해구제신청서를 해당 금융회사에 제출해야 합니다.";
export const COUNTER_SCAM_1394_GUIDANCE =
  "1394 — 전기통신금융사기 통합대응단의 피해상담, 의심 전화번호·사이트 제보, 관계기관 연계";

export const RULES: readonly Rule[] = [
  {
    id: "R1",
    match: (state) =>
      COMPROMISED_DEVICES.includes(state.device_compromise_state) &&
      UNSAFE_OR_UNKNOWN_DEVICE_AVAILABILITY.includes(
        state.safe_device_available,
      ),
    actions: [
      {
        order: 1,
        merge_key: "device:isolate",
        title: "의심 기기 사용 중지·신뢰할 수 있는 별도 기기 확보",
        purpose_slot: "의심 기기 사용 중지·안전 기기 확보",
        prerequisite: [],
        required_followup: ["안전한 별도 기기에서 후속 조치를 계속"],
        source_ids: ["SRC-FSC-MALAPP"],
        template_versions: ["TPL-SAFE-DEVICE-001@1.0"],
      },
      {
        order: 2,
        merge_key: "call:bank_fraud",
        title: "별도 기기에서 해당 금융회사 공식 대표번호 확인·연락",
        purpose_slot: "금융회사 공식 대표번호 확인·연락",
        prerequisite: ["의심 기기와 분리된 안전한 기기에서 실행"],
        required_followup: [],
        source_ids: ["SRC-FSC-MALAPP"],
        template_versions: ["TPL-SAFE-DEVICE-001@1.0"],
      },
      {
        order: 3,
        merge_key: "call:112",
        title: "별도 기기에서 112 연락",
        purpose_slot: "112 연락",
        prerequisite: ["의심 기기와 분리된 안전한 기기에서 실행"],
        required_followup: [],
        source_ids: ["SRC-FSC-MALAPP"],
        template_versions: ["TPL-SAFE-DEVICE-001@1.0"],
      },
    ],
    prohibition_ids: ["PRH-R1-APP", "PRH-R1-SEARCH"],
  },
  {
    id: "R2",
    match: (state) =>
      COMPROMISED_DEVICES.includes(state.device_compromise_state) &&
      state.safe_device_available === "yes",
    actions: [
      {
        order: 1,
        merge_key: "call:bank_fraud",
        title: "안전한 별도 기기에서 해당 금융회사 공식 대표번호 확인·연락",
        purpose_slot: "긴급 확인·연락",
        prerequisite: ["의심 기기와 분리된 안전한 기기에서 실행"],
        required_followup: [],
        source_ids: ["SRC-FSC-MALAPP"],
        template_versions: ["TPL-SAFE-DEVICE-001@1.0"],
      },
      {
        order: 2,
        merge_key: "call:112",
        title: "안전한 별도 기기에서 112 연락",
        purpose_slot: "112 연락",
        prerequisite: ["의심 기기와 분리된 안전한 기기에서 실행"],
        required_followup: [],
        source_ids: ["SRC-FSC-MALAPP"],
        template_versions: ["TPL-SAFE-DEVICE-001@1.0"],
      },
      {
        order: 3,
        merge_key: "action:credential_recovery",
        title: "인증수단 폐기·재발급과 악성 앱 검사 안내 확인",
        purpose_slot: "인증수단 폐기·재발급·악성 앱 검사",
        prerequisite: ["의심 기기와 분리된 안전한 기기에서 실행"],
        required_followup: [],
        source_ids: ["SRC-FSC-MALAPP"],
        template_versions: ["TPL-SAFE-DEVICE-001@1.0"],
      },
    ],
    prohibition_ids: ["PRH-R2-DEVICE"],
  },
  {
    id: "R3",
    match: (state) => state.transfer_state === "already_sent",
    actions: [
      {
        order: 1,
        merge_key: "call:bank_fraud",
        title: "해당 금융회사 공식 대표번호로 사기이용계좌 지급정지 요청",
        purpose_slot: "지급정지 요청",
        prerequisite: ["해당 금융회사 공식 대표번호 확인"],
        required_followup: [WRITTEN_FOLLOWUP_REQUIREMENT],
        source_ids: ["SRC-EASYLAW-CONTACT", "SRC-EASYLAW-STOPPAY"],
        template_versions: ["TPL-BANK-STOP-001@1.0"],
      },
      {
        order: 2,
        merge_key: "call:112",
        title: "112 신고·지급정지 연계 요청",
        purpose_slot: "112 신고·지급정지 연계 요청",
        prerequisite: [],
        required_followup: [WRITTEN_FOLLOWUP_REQUIREMENT],
        source_ids: ["SRC-EASYLAW-CONTACT", "SRC-EASYLAW-STOPPAY"],
        template_versions: ["TPL-BANK-STOP-001@1.0"],
      },
      {
        order: 3,
        merge_key: "procedure:written_followup",
        title: WRITTEN_FOLLOWUP_TITLE,
        purpose_slot: WRITTEN_FOLLOWUP_PURPOSE,
        prerequisite: [WRITTEN_FOLLOWUP_PREREQUISITE],
        required_followup: [
          WRITTEN_FOLLOWUP_REQUIREMENT,
          COUNTER_SCAM_1394_GUIDANCE,
        ],
        source_ids: [
          "SRC-EASYLAW-CONTACT",
          "SRC-EASYLAW-STOPPAY",
          "SRC-KOREA-1394",
        ],
        template_versions: ["TPL-WRITTEN-FOLLOWUP-001@1.1"],
      },
    ],
    prohibition_ids: ["PRH-R3-WAIT", "PRH-R3-BULK"],
  },
  {
    id: "R4",
    match: (state) =>
      EXPOSED_STATES.includes(state.credential_exposure_state),
    actions: [
      {
        order: 1,
        merge_key: "call:bank_fraud",
        title:
          "안전한 기기에서 금융회사 공식 대표번호에 인증정보 노출 통지·보호조치 요청",
        purpose_slot: "인증정보 노출 통지·보호조치 요청",
        prerequisite: ["안전한 기기에서 실행"],
        required_followup: [],
        source_ids: ["SRC-FSC-10RULES"],
        template_versions: ["TPL-CREDENTIAL-RECOVERY-001@1.0"],
      },
      {
        order: 2,
        merge_key: "call:112",
        title: "112에 인증정보 노출 상황 상담",
        purpose_slot: "112 인증정보 노출 상담",
        prerequisite: ["안전한 기기에서 실행"],
        required_followup: [],
        source_ids: ["SRC-FSC-10RULES"],
        template_versions: ["TPL-CREDENTIAL-RECOVERY-001@1.0"],
      },
      {
        order: 3,
        merge_key: "action:credential_recovery",
        title: "인증수단 폐기·재발급과 본인계좌 보호 수단 확인",
        purpose_slot: "인증수단 폐기·재발급·본인계좌 보호 수단 확인",
        prerequisite: ["금융회사 안내에 따라 실행"],
        required_followup: [],
        source_ids: ["SRC-FSC-10RULES"],
        template_versions: ["TPL-CREDENTIAL-RECOVERY-001@1.0"],
      },
    ],
    prohibition_ids: ["PRH-R4-WAITAI", "PRH-R4-THEIRCH"],
  },
  {
    id: "R5",
    match: (state) =>
      EXPOSED_STATES.includes(state.personal_data_exposure_state),
    actions: [
      {
        order: 1,
        merge_key: "action:stop_contact",
        title: "상대와 추가 접촉·정보 제공 중단",
        purpose_slot: "추가 접촉·정보 제공 중단",
        prerequisite: [],
        required_followup: [],
        source_ids: ["SRC-FSS-1332"],
        template_versions: ["TPL-OFFICIAL-VERIFY-001@1.0"],
      },
      {
        order: 2,
        merge_key: "verify:official_channel",
        title: "공식 기관 대표채널로 사실 교차 확인",
        purpose_slot: "공식 대표채널 교차 확인",
        prerequisite: [],
        required_followup: [],
        source_ids: ["SRC-FSS-1332"],
        template_versions: ["TPL-OFFICIAL-VERIFY-001@1.0"],
      },
      {
        order: 3,
        merge_key: "call:1332",
        title: "1332에서 금융 피해예방·피해구제 상담 경로 확인",
        purpose_slot: "1332 금융 피해예방·피해구제 상담",
        prerequisite: [],
        required_followup: [],
        source_ids: ["SRC-FSS-1332"],
        template_versions: ["TPL-OFFICIAL-VERIFY-001@1.0"],
      },
    ],
    prohibition_ids: ["PRH-R5-CONFIRM"],
  },
  {
    id: "R6",
    match: (state) =>
      state.transfer_state === "not_sent" &&
      state.device_compromise_state === "none" &&
      state.credential_exposure_state === "none" &&
      state.personal_data_exposure_state === "none",
    actions: [
      {
        order: 1,
        merge_key: "action:stop_risky",
        title: "송금·링크 클릭·앱 설치 중단",
        purpose_slot: "송금·링크 클릭·앱 설치 중단",
        prerequisite: [],
        required_followup: [],
        source_ids: ["SRC-FSC-10RULES"],
        template_versions: ["TPL-OFFICIAL-VERIFY-001@1.0"],
      },
      {
        order: 2,
        merge_key: "verify:official_channel",
        title: "메시지 속 연락처가 아닌 공식 대표채널로 교차 확인",
        purpose_slot: "공식 대표채널 교차 확인",
        prerequisite: [],
        required_followup: [],
        source_ids: ["SRC-FSC-10RULES"],
        template_versions: ["TPL-OFFICIAL-VERIFY-001@1.0"],
      },
      {
        order: 3,
        merge_key: "question:state_confirm",
        title: "근거 판정과 확인 질문 검토",
        purpose_slot: "근거 판정·확인 질문 검토",
        prerequisite: [],
        required_followup: [],
        source_ids: ["SRC-FSC-10RULES"],
        template_versions: ["TPL-OFFICIAL-VERIFY-001@1.0"],
      },
    ],
    prohibition_ids: ["PRH-R6-DONE", "PRH-R6-SAFE"],
  },
  {
    id: "R7",
    match: (state) =>
      state.transfer_state === "unknown" ||
      state.device_compromise_state === "unknown" ||
      state.credential_exposure_state === "unknown" ||
      state.personal_data_exposure_state === "unknown",
    actions: [
      {
        order: 1,
        merge_key: "question:state_confirm",
        title: "미확인 상태 확인 질문",
        purpose_slot: "미확인 상태 최대 3개 확인",
        prerequisite: [],
        required_followup: [],
        source_ids: ["SRC-FSS-1332"],
        template_versions: ["TPL-UNDETERMINED-001@1.0"],
      },
      {
        order: 2,
        merge_key: "verify:official_channel",
        title: "공식 대표채널 교차 확인",
        purpose_slot: "공식 대표채널 교차 확인",
        prerequisite: [],
        required_followup: [],
        source_ids: ["SRC-FSS-1332"],
        template_versions: ["TPL-UNDETERMINED-001@1.0"],
      },
      {
        order: 3,
        merge_key: "call:1332",
        title: "근거 부족이면 판단 유보와 1332 안내",
        purpose_slot: "판단 유보·1332 안내",
        prerequisite: [],
        required_followup: [],
        source_ids: ["SRC-FSS-1332"],
        template_versions: ["TPL-UNDETERMINED-001@1.0"],
      },
    ],
    prohibition_ids: ["PRH-R7-FIXED"],
  },
];
