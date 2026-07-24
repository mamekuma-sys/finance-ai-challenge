import type { Channel, IncidentState } from "@/lib/contracts";

/**
 * F-01 합성 기본 입력 — 데모용 합성 시나리오 3건.
 *
 * 계약: `docs/planning/11-spec-draft.md` §2.2 F-01, §5.4 평가셋 분리(데모 합성 3건),
 * `docs/planning/05-method-db-sources.md` 재작성 규칙.
 *
 * **전부 합성이다.** 공개 수법 자료(S1 금융위·금감원 「보이스피싱 피해예방 10계명」,
 * S2 KISA 보호나라 주의보)에서 **수법의 사실·순서·경고 신호만 원자화**해 새 문장으로
 * 다시 썼다. 원문 대화문·예시 전화번호·계좌·URL은 어느 것도 복제하지 않았다.
 * 전화번호는 더미 `010-0000-0000`, 도메인은 `.invalid`만 사용한다.
 *
 * **이 시나리오는 §5.4의 “데모” 집합이며 평가 분모에서 제외한다.**
 * 개발·회귀 40건, 비공개 홀드아웃 40건, 적대 입력 20건과 `scenario_id`·문장 템플릿을
 * 공유하지 않는다.
 *
 * **판정을 제공하지 않는다.** F-03 근거 판정은 현재 배포본 미구현이므로 이 시나리오는
 * 위험도·판정 라벨을 싣지 않고 **상태 필드 프리필과 채널·수법 맥락 제시**만 한다.
 */
export interface SyntheticScenario {
  /** 데모 집합 전용 ID. 다른 평가 집합과 공유하지 않는다. */
  readonly scenario_id: string;
  /** 합성 데이터임을 데이터 계층에서 강제한다(§5.1 서버 DB·공개 화면 조건). */
  readonly is_synthetic: true;
  /** 화면에 보이는 짧은 이름 — 수법 유형이며 위험도 라벨이 아니다. */
  readonly title: string;
  /** 어떤 상황인지 한 줄 설명. */
  readonly summary: string;
  /** §4.1 Channel 범주. */
  readonly channel: Channel;
  /** 정규화된 합성 메시지 본문. 원문 복제가 아니라 새로 작성한 문장이다. */
  readonly body: string;
  /** 이 시나리오가 재현하는 공개 수법의 경고 신호(사실 필드만). */
  readonly warning_signals: readonly string[];
  /** 선택 시 6개 상태 필드에 채워지는 값. 사용자가 언제든 바꿀 수 있다. */
  readonly suggested_state: IncidentState;
  /** 어떤 공개 출처의 수법 사실에서 재작성했는지. */
  readonly derived_from: readonly string[];
}

export const SYNTHETIC_SCENARIOS: readonly SyntheticScenario[] = [
  {
    scenario_id: "demo-001-agency-impersonation-app",
    is_synthetic: true,
    title: "기관 사칭 + 앱 설치 요구",
    summary: "수사기관을 사칭해 통화를 이어가며 앱 설치와 계좌 이체를 요구하는 흐름",
    channel: "call_transcript",
    body: [
      "[합성 통화 요약 · 실제 사건 아님]",
      "상대가 자신을 수사기관 직원이라고 말하며 계좌가 범죄에 연루됐다고 합니다.",
      "수사 중이라 누구에게도 말하면 안 된다고 하고, 전화를 끊지 말라고 합니다.",
      "확인용 프로그램이라며 링크(hxxps://verify-check.invalid)를 눌러 앱을 설치하라고 하고,",
      "안전한 계좌로 옮겨야 한다며 이체를 요구합니다.",
      "회신 번호로는 010-0000-0000을 알려 줍니다.",
    ].join("\n"),
    warning_signals: [
      "수사기관을 사칭하며 비밀 유지·통화 유지를 요구",
      "출처가 확인되지 않은 앱·프로그램 설치 유도",
      "‘안전한 계좌’로의 이체 요구",
      "상대가 직접 알려 준 회신 번호 사용 유도",
    ],
    suggested_state: {
      transfer_state: "already_sent",
      device_compromise_state: "suspected_app",
      credential_exposure_state: "unknown",
      personal_data_exposure_state: "unknown",
      user_role: "self",
      safe_device_available: "unknown",
    },
    derived_from: [
      "S1 금융위원회·금융감독원 「보이스피싱 피해예방 10계명」의 수법 사실·순서(재작성)",
    ],
  },
  {
    scenario_id: "demo-002-delivery-smishing-link",
    is_synthetic: true,
    title: "배송 안내 위장 문자 + 링크",
    summary: "배송 오류를 미끼로 링크 클릭과 개인정보 입력을 유도하는 문자 흐름",
    channel: "sms",
    body: [
      "[합성 문자 · 실제 사건 아님]",
      "[국외발신] 배송지 정보가 확인되지 않아 물품이 보관 중입니다.",
      "아래에서 주소를 다시 입력해 주세요.",
      "hxxps://delivery-recheck.invalid/kr",
      "문의 010-0000-0000",
    ].join("\n"),
    warning_signals: [
      "배송 오류·보관을 미끼로 한 긴급성 조성",
      "문자 속 링크로 개인정보 재입력 유도",
      "공식 배송 조회 채널이 아닌 임의 도메인",
    ],
    suggested_state: {
      transfer_state: "not_sent",
      device_compromise_state: "unknown",
      credential_exposure_state: "unknown",
      personal_data_exposure_state: "suspected",
      user_role: "self",
      safe_device_available: "unknown",
    },
    derived_from: [
      "S2 KISA 보호나라 스미싱·피싱 주의보의 미끼·요구행동 패턴(재작성)",
    ],
  },
  {
    scenario_id: "demo-003-routine-notice-no-action",
    is_synthetic: true,
    title: "요구 행동이 없는 정기 안내",
    summary: "링크·회신·송금 요구가 없는 일반 안내 문자 — 대조용 흐름",
    channel: "sms",
    body: [
      "[합성 문자 · 실제 사건 아님]",
      "[안내] 이용 중인 상품의 정기 안내문이 등록되었습니다.",
      "자세한 내용은 평소 사용하시던 공식 앱 또는 공식 홈페이지에서 확인하실 수 있습니다.",
      "이 문자는 발신 전용이며 회신·링크·입금 요청을 포함하지 않습니다.",
    ].join("\n"),
    warning_signals: [
      "요구 행동 없음 — 링크·회신·송금 요청이 포함되지 않음",
      "확인 경로를 사용자가 이미 아는 공식 채널로 안내",
    ],
    suggested_state: {
      transfer_state: "not_sent",
      device_compromise_state: "none",
      credential_exposure_state: "none",
      personal_data_exposure_state: "none",
      user_role: "self",
      safe_device_available: "yes",
    },
    derived_from: [
      "S1 금융위원회·금융감독원 「보이스피싱 피해예방 10계명」의 공식 채널 확인 원칙(재작성)",
    ],
  },
] as const;

export type SyntheticScenarioId =
  (typeof SYNTHETIC_SCENARIOS)[number]["scenario_id"];

export function findSyntheticScenario(
  scenarioId: string,
): SyntheticScenario | null {
  return (
    SYNTHETIC_SCENARIOS.find(
      (scenario) => scenario.scenario_id === scenarioId,
    ) ?? null
  );
}

/**
 * 합성 본문에 실제 연락처·활성 URL·주민번호형 문자열이 없는지 검사한다.
 * 데이터 계층에서 강제해, 시나리오를 추가할 때 사람이 규칙을 잊어도 테스트가 잡는다.
 */
export const FORBIDDEN_BODY_PATTERNS: ReadonlyArray<{
  readonly id: string;
  readonly pattern: RegExp;
}> = [
  { id: "active-http-url", pattern: /https?:\/\//i },
  { id: "non-invalid-domain", pattern: /\.(com|net|org|kr|co\.kr|io)\b/i },
  { id: "real-phone", pattern: /01[016789]-(?!0000-0000)\d{3,4}-\d{4}/ },
  { id: "rrn-like", pattern: /\b\d{6}-[1-4]\d{6}\b/ },
  { id: "account-like", pattern: /\b\d{3,6}-\d{2,6}-\d{5,8}\b/ },
];
