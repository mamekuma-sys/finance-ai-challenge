import type {
  ActionFactSource,
  ActionFactState,
  IncidentState,
} from "@/lib/contracts";
import type { DecisionActionCard } from "@/lib/decision";

export const INITIAL_INCIDENT_STATE: IncidentState = {
  transfer_state: "unknown",
  device_compromise_state: "unknown",
  credential_exposure_state: "unknown",
  personal_data_exposure_state: "unknown",
  user_role: "self",
  safe_device_available: "unknown",
};

export const INCIDENT_FIELD_CONFIG = [
  {
    key: "transfer_state",
    legend: "돈을 보냈나요?",
    help: "송금이 끝났는지에 따라 금융회사 연락 순서가 달라집니다.",
    options: [
      ["not_sent", "아직 보내지 않았어요"],
      ["already_sent", "이미 보냈어요"],
      ["unknown", "모르겠어요"],
    ],
  },
  {
    key: "device_compromise_state",
    legend: "앱 설치나 원격제어가 있었나요?",
    help: "의심되는 기기에서는 금융 앱이나 번호 검색을 하지 않도록 안내합니다.",
    options: [
      ["none", "없어요"],
      ["suspected_app", "의심되는 앱을 설치했어요"],
      ["remote_control", "원격제어를 허용했어요"],
      ["unknown", "모르겠어요"],
    ],
  },
  {
    key: "credential_exposure_state",
    legend: "비밀번호·인증번호 같은 인증정보가 노출됐나요?",
    help: "실제 번호나 비밀번호는 입력하지 마세요. 노출 여부만 선택합니다.",
    options: [
      ["none", "없어요"],
      ["suspected", "노출됐을 수도 있어요"],
      ["shared", "알려줬어요"],
      ["unknown", "모르겠어요"],
    ],
  },
  {
    key: "personal_data_exposure_state",
    legend: "개인정보가 노출됐나요?",
    help: "주민번호 같은 구체 값은 받지 않습니다. 노출 여부만 선택합니다.",
    options: [
      ["none", "없어요"],
      ["suspected", "노출됐을 수도 있어요"],
      ["shared", "알려줬어요"],
      ["unknown", "모르겠어요"],
    ],
  },
  {
    key: "user_role",
    legend: "누구의 상황을 확인하고 있나요?",
    help: "본인만 할 수 있는 신고·접수 절차를 구분합니다.",
    options: [
      ["self", "제 상황이에요"],
      ["family_proxy", "가족을 도와 확인 중이에요"],
    ],
  },
  {
    key: "safe_device_available",
    legend: "의심 기기와 떨어진 안전한 기기를 쓸 수 있나요?",
    help: "다른 휴대전화나 신뢰할 수 있는 컴퓨터를 뜻합니다.",
    options: [
      ["yes", "쓸 수 있어요"],
      ["no", "지금은 없어요"],
      ["unknown", "모르겠어요"],
    ],
  },
] as const;

export const HUMAN_STATE_LABELS: Record<string, string> = {
  not_sent: "돈을 보내지 않음",
  already_sent: "돈을 보냈음",
  suspected_app: "의심 앱을 설치함",
  remote_control: "원격제어를 허용함",
  none: "노출·감염 없음",
  suspected: "노출 의심",
  shared: "정보를 알려줌",
  self: "본인 상황",
  family_proxy: "가족을 도와 확인 중",
  yes: "안전한 기기 있음",
  no: "안전한 기기 없음",
  unknown: "모르겠음",
};

export const ACTION_STATE_LABELS: Record<ActionFactState, string> = {
  viewed: "카드를 봄",
  dialer_opened: "전화 앱 열기를 선택함",
  user_reported_connected: "통화가 연결됐다고 확인함",
  user_reported_requested: "요청을 전달했다고 확인함",
  user_reported_receipt_confirmed: "기관 접수를 확인했다고 진술함",
  not_applicable: "현재 상황에 해당하지 않음",
  unknown: "아직 알 수 없음",
};

export const ACTION_SOURCE_LABELS: Record<ActionFactSource, string> = {
  ui_event: "자동 관측",
  user_statement: "사용자 진술",
};

const RULE_LABELS: Record<string, string> = {
  R1: "기기 감염 의심·안전 기기 미확보",
  R2: "기기 감염 의심·안전 기기 확보",
  R3: "송금 완료",
  R4: "인증정보 노출",
  R5: "개인정보 노출",
  R6: "송금 전·노출 없음",
  R7: "상태 확인 필요",
};

export function explainCardOrder(card: DecisionActionCard): string {
  function severityForRule(ruleId: string): string {
    if (ruleId === "R1" || ruleId === "R2") {
      return card.severity <= 2 ? String(card.severity) : "1~2";
    }
    if (ruleId === "R3") {
      return "3";
    }
    if (ruleId === "R4") {
      return "4~5";
    }
    if (ruleId === "R5") {
      return "6";
    }
    if (ruleId === "R7" && card.question_axes) {
      return `잠재 ${card.severity}`;
    }
    return "7";
  }

  const rules =
    card.rule_ids.length > 0
      ? card.rule_ids
          .map(
            (ruleId) =>
              `${ruleId}(${RULE_LABELS[ruleId] ?? "적용 규칙"}, 위해순위 ${severityForRule(ruleId)})`,
          )
          .join(" + ")
      : `필수 안내(위해순위 ${card.severity})`;
  const mergeNote =
    card.rule_ids.length > 1
      ? "이 같은 채널·목적의 행동으로 병합됐습니다."
      : "에 따라 이 순서에 놓였습니다.";
  return `${rules}${mergeNote}`;
}

export function templateBodiesForCard(
  card: DecisionActionCard,
  registry: Readonly<Record<string, { body: string }>>,
): string[] {
  return card.template_versions.flatMap((version) => {
    const template = registry[version];
    return template ? [template.body] : [];
  });
}
