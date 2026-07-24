import type { MergeKey, RuleId } from "../rules";
import type { SourceId } from "../sources";

export interface SourceEntailmentFixture {
  readonly rule_id: RuleId | "MOD-PROXY";
  readonly row_order: number;
  readonly merge_key: MergeKey;
  readonly core_verb: string;
  readonly source_id: SourceId;
  readonly supporting_sentence: string;
}

export const SOURCE_ENTAILMENT_FIXTURES = [
  {
    rule_id: "R1",
    row_order: 1,
    merge_key: "device:isolate",
    core_verb: "의심 기기 사용 중지·별도 안전 기기 확보",
    source_id: "SRC-FSC-CARDNEWS",
    supporting_sentence: "다른 휴대전화 및 PC 사용 권장",
  },
  {
    rule_id: "R1",
    row_order: 1,
    merge_key: "device:isolate",
    core_verb: "악성 앱 검사·삭제 또는 휴대전화 초기화",
    source_id: "SRC-FSC-MALAPP",
    supporting_sentence:
      "악성앱을 이미 설치했다면 모바일 백신앱으로 검사 후 삭제, 휴대폰 초기화",
  },
  {
    rule_id: "R1",
    row_order: 2,
    merge_key: "call:bank_fraud",
    core_verb: "별도 기기에서 금융회사 공식 대표번호 확인·연락",
    source_id: "SRC-FSC-CARDNEWS",
    supporting_sentence: "다른 휴대전화 및 PC 사용 권장",
  },
  {
    rule_id: "R1",
    row_order: 2,
    merge_key: "call:bank_fraud",
    core_verb: "금융회사에 신고",
    source_id: "SRC-FSC-MALAPP",
    supporting_sentence:
      "금융회사나 보이스피싱 통합신고대응센터(112)로 지체없이 신고",
  },
  {
    rule_id: "R1",
    row_order: 3,
    merge_key: "call:112",
    core_verb: "별도 기기에서 112 연락",
    source_id: "SRC-FSC-MALAPP",
    supporting_sentence:
      "금융회사나 보이스피싱 통합신고대응센터(112)로 지체없이 신고",
  },
  {
    rule_id: "R1",
    row_order: 3,
    merge_key: "call:112",
    core_verb: "별도 안전 기기 사용",
    source_id: "SRC-FSC-CARDNEWS",
    supporting_sentence: "다른 휴대전화 및 PC 사용 권장",
  },
  {
    rule_id: "R2",
    row_order: 1,
    merge_key: "call:bank_fraud",
    core_verb: "안전한 별도 기기에서 금융회사 연락",
    source_id: "SRC-FSC-CARDNEWS",
    supporting_sentence: "다른 휴대전화 및 PC 사용 권장",
  },
  {
    rule_id: "R2",
    row_order: 1,
    merge_key: "call:bank_fraud",
    core_verb: "금융회사에 신고",
    source_id: "SRC-FSC-MALAPP",
    supporting_sentence:
      "금융회사나 보이스피싱 통합신고대응센터(112)로 지체없이 신고",
  },
  {
    rule_id: "R2",
    row_order: 2,
    merge_key: "call:112",
    core_verb: "안전한 별도 기기에서 112 연락",
    source_id: "SRC-FSC-CARDNEWS",
    supporting_sentence: "다른 휴대전화 및 PC 사용 권장",
  },
  {
    rule_id: "R2",
    row_order: 2,
    merge_key: "call:112",
    core_verb: "112 신고",
    source_id: "SRC-FSC-MALAPP",
    supporting_sentence:
      "금융회사나 보이스피싱 통합신고대응센터(112)로 지체없이 신고",
  },
  {
    rule_id: "R2",
    row_order: 3,
    merge_key: "action:credential_recovery",
    core_verb: "인증수단 폐기·재발급",
    source_id: "SRC-KISA-PHISHING",
    supporting_sentence:
      "공인인증서, 보안카드 등의 금융정보를 폐기하고 재발급",
  },
  {
    rule_id: "R2",
    row_order: 3,
    merge_key: "action:credential_recovery",
    core_verb: "악성 앱 검사·삭제 또는 휴대전화 초기화",
    source_id: "SRC-FSC-MALAPP",
    supporting_sentence:
      "악성앱을 이미 설치했다면 모바일 백신앱으로 검사 후 삭제, 휴대폰 초기화",
  },
  {
    rule_id: "R3",
    row_order: 1,
    merge_key: "call:bank_fraud",
    core_verb: "금융회사에 사기이용계좌 지급정지 요청",
    source_id: "SRC-EASYLAW-STOPPAY",
    supporting_sentence:
      "피해금을 송금·이체한 계좌를 관리하는 금융회사에 피해구제를 신청",
  },
  {
    rule_id: "R3",
    row_order: 2,
    merge_key: "call:112",
    core_verb: "112 피해 신고·지급정지 연계 요청",
    source_id: "SRC-EASYLAW-CONTACT",
    supporting_sentence:
      "금융사기로 인한 피해 신고 및 피해금을 입금한 계좌에 대한 지급정지 요청",
  },
  {
    rule_id: "R3",
    row_order: 3,
    merge_key: "procedure:written_followup",
    core_verb: "신청한 날부터 3일 이내 피해구제신청서 제출",
    source_id: "SRC-LAW-DECREE3",
    supporting_sentence:
      "전화 또는 구술로 신청한 경우 신청한 날부터 3일 이내에 신청서를 제출",
  },
  {
    rule_id: "R3",
    row_order: 3,
    merge_key: "procedure:written_followup",
    core_verb: "1394 피해상담·제보·관계기관 연계",
    source_id: "SRC-KOREA-1394",
    supporting_sentence:
      "보이스피싱 피해상담 / 전화번호·사이트 제보 / 관계기관 연계조치",
  },
  {
    rule_id: "R4",
    row_order: 1,
    merge_key: "call:bank_fraud",
    core_verb: "공식 금융회사 채널에 인증정보 노출 통지·보호조치 요청",
    source_id: "SRC-FSC-10RULES",
    supporting_sentence:
      "즉시 중단하고 해당 금융회사의 공식 앱 또는 고객센터를 통해 진위 여부를 확인",
  },
  {
    rule_id: "R4",
    row_order: 2,
    merge_key: "call:112",
    core_verb: "112에 인증정보 노출 상황 상담",
    source_id: "SRC-FSC-10RULES",
    supporting_sentence:
      "악성앱 설치 시 112·1332 전화도 가로채질 수 있으므로 비행기 모드 또는 초기화 후 신고",
  },
  {
    rule_id: "R4",
    row_order: 3,
    merge_key: "action:credential_recovery",
    core_verb: "인증수단 폐기·재발급",
    source_id: "SRC-KISA-PHISHING",
    supporting_sentence:
      "공인인증서, 보안카드 등의 금융정보를 폐기하고 재발급",
  },
  {
    rule_id: "R4",
    row_order: 3,
    merge_key: "action:credential_recovery",
    core_verb: "추가 금융 피해 보호조치",
    source_id: "SRC-FSC-MALAPP",
    supporting_sentence:
      "금융회사나 보이스피싱 통합신고대응센터(112)로 지체없이 신고",
  },
  {
    rule_id: "R5",
    row_order: 1,
    merge_key: "action:stop_contact",
    core_verb: "상대와 추가 접촉·정보 제공 중단",
    source_id: "SRC-FSC-10RULES",
    supporting_sentence:
      "즉시 중단하고 해당 금융회사의 공식 앱 또는 고객센터를 통해 진위 여부를 확인",
  },
  {
    rule_id: "R5",
    row_order: 2,
    merge_key: "verify:official_channel",
    core_verb: "공식 기관 대표채널로 사실 교차 확인",
    source_id: "SRC-FSC-10RULES",
    supporting_sentence:
      "즉시 중단하고 해당 금융회사의 공식 앱 또는 고객센터를 통해 진위 여부를 확인",
  },
  {
    rule_id: "R5",
    row_order: 3,
    merge_key: "call:1332",
    core_verb: "1332 금융 피해상담·접수·구제 안내",
    source_id: "SRC-FSC-1332",
    supporting_sentence:
      "보이스피싱 피해상담, 접수, 구제 / 국번없이 1332",
  },
  {
    rule_id: "R6",
    row_order: 1,
    merge_key: "action:stop_risky",
    core_verb: "송금·링크 클릭·앱 설치 중단",
    source_id: "SRC-FSC-10RULES",
    supporting_sentence:
      "즉시 중단하고 해당 금융회사의 공식 앱 또는 고객센터를 통해 진위 여부를 확인",
  },
  {
    rule_id: "R6",
    row_order: 2,
    merge_key: "verify:official_channel",
    core_verb: "메시지 속 연락처가 아닌 공식 대표채널 교차 확인",
    source_id: "SRC-FSC-10RULES",
    supporting_sentence:
      "즉시 중단하고 해당 금융회사의 공식 앱 또는 고객센터를 통해 진위 여부를 확인",
  },
  {
    rule_id: "R6",
    row_order: 3,
    merge_key: "question:state_confirm",
    core_verb: "의심 절차 중단 뒤 근거 판정과 확인 질문 검토",
    source_id: "SRC-FSC-10RULES",
    supporting_sentence:
      "즉시 중단하고 해당 금융회사의 공식 앱 또는 고객센터를 통해 진위 여부를 확인",
  },
  {
    rule_id: "R7",
    row_order: 1,
    merge_key: "question:state_confirm",
    core_verb: "미확인 금융 상태 질문",
    source_id: "SRC-FSS-1332",
    supporting_sentence:
      "금융거래와 관련한 질문, 요청, 이의신청 등의 내용을 상담",
  },
  {
    rule_id: "R7",
    row_order: 2,
    merge_key: "verify:official_channel",
    core_verb: "공식 대표채널 교차 확인",
    source_id: "SRC-FSC-10RULES",
    supporting_sentence:
      "즉시 중단하고 해당 금융회사의 공식 앱 또는 고객센터를 통해 진위 여부를 확인",
  },
  {
    rule_id: "R7",
    row_order: 3,
    merge_key: "call:1332",
    core_verb: "판단 유보와 1332 피해상담·구제 안내",
    source_id: "SRC-FSC-1332",
    supporting_sentence:
      "보이스피싱 피해상담, 접수, 구제 / 국번없이 1332",
  },
  {
    rule_id: "MOD-PROXY",
    row_order: 1,
    merge_key: "notice:proxy_scope",
    core_verb: "피해 당사자가 공식 피해구제 절차를 수행",
    source_id: "SRC-EASYLAW-CONTACT",
    supporting_sentence:
      "금융사기로 인한 피해 신고 및 피해금을 입금한 계좌에 대한 지급정지 요청",
  },
] as const satisfies readonly SourceEntailmentFixture[];
