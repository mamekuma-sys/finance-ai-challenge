import { describe, expect, it } from "vitest";

import type { IncidentState } from "@/lib/contracts";

import { decideActions } from "../engine";
import { PROHIBITIONS } from "../prohibitions";

function state(
  overrides: Partial<IncidentState> = {},
): IncidentState {
  return {
    transfer_state: "not_sent",
    device_compromise_state: "none",
    credential_exposure_state: "none",
    personal_data_exposure_state: "none",
    safe_device_available: "yes",
    user_role: "self",
    ...overrides,
  };
}

function mergeKeys(cards: ReturnType<typeof decideActions>["actions"]) {
  return cards.map((card) => card.merge_key);
}

function templateSet(result: ReturnType<typeof decideActions>) {
  return new Set(
    [...result.actions, ...result.next_steps].flatMap(
      (card) => card.template_versions,
    ),
  );
}

describe("§4.5.4 복합 조합 인수 스냅샷", () => {
  it("a: 송금 완료 + 의심 앱 + 안전 기기 없음", () => {
    const result = decideActions(
      state({
        transfer_state: "already_sent",
        device_compromise_state: "suspected_app",
        safe_device_available: "no",
      }),
    );

    expect(mergeKeys(result.actions)).toEqual([
      "device:isolate",
      "call:bank_fraud",
      "call:112",
      "procedure:written_followup",
    ]);
    expect(result.next_steps).toEqual([]);
    expect(result.actions[1].rule_ids).toEqual(["R1", "R3"]);
    expect(result.actions[2].rule_ids).toEqual(["R1", "R3"]);
    expect(templateSet(result)).toEqual(
      new Set([
        "TPL-SAFE-DEVICE-001@1.0",
        "TPL-BANK-STOP-001@1.0",
        "TPL-WRITTEN-FOLLOWUP-001@1.1",
      ]),
    );
    expect(result.actions[0].prohibited_actions).toEqual([
      PROHIBITIONS["PRH-R1-APP"],
      PROHIBITIONS["PRH-R1-SEARCH"],
      PROHIBITIONS["PRH-R3-WAIT"],
      PROHIBITIONS["PRH-R3-BULK"],
      PROHIBITIONS["PRH-MOD-DEVICE"],
    ]);
  });

  it("b: 송금 완료 + 원격제어 + 인증정보 공유 + 안전 기기 있음", () => {
    const result = decideActions(
      state({
        transfer_state: "already_sent",
        device_compromise_state: "remote_control",
        credential_exposure_state: "shared",
      }),
    );

    expect(mergeKeys(result.actions)).toEqual([
      "call:bank_fraud",
      "call:112",
      "action:credential_recovery",
      "procedure:written_followup",
    ]);
    expect(result.next_steps).toEqual([]);
    expect(result.actions[0].rule_ids).toEqual(["R2", "R3", "R4"]);
    expect(result.actions[2].rule_ids).toEqual(["R2", "R4"]);
    expect(result.actions[0].prohibited_actions).toEqual([
      PROHIBITIONS["PRH-R2-DEVICE"],
      PROHIBITIONS["PRH-R3-WAIT"],
      PROHIBITIONS["PRH-R3-BULK"],
      PROHIBITIONS["PRH-R4-WAITAI"],
      PROHIBITIONS["PRH-R4-THEIRCH"],
      PROHIBITIONS["PRH-MOD-DEVICE"],
    ]);
    expect(templateSet(result)).toEqual(
      new Set([
        "TPL-SAFE-DEVICE-001@1.0",
        "TPL-BANK-STOP-001@1.0",
        "TPL-CREDENTIAL-RECOVERY-001@1.0",
        "TPL-WRITTEN-FOLLOWUP-001@1.1",
      ]),
    );
  });

  it("c: 송금 여부 미확인 + 인증정보 공유", () => {
    const result = decideActions(
      state({
        transfer_state: "unknown",
        credential_exposure_state: "shared",
      }),
    );

    expect(mergeKeys(result.actions)).toEqual([
      "question:state_confirm",
      "call:bank_fraud",
      "call:112",
      "action:credential_recovery",
    ]);
    expect(mergeKeys(result.next_steps)).toEqual([
      "verify:official_channel",
      "call:1332",
    ]);
    expect(result.next_steps.map((card) => card.priority)).toEqual([5, 6]);
    expect(result.actions[0].question_axes).toEqual(["transfer"]);
    expect(result.actions[0].prohibited_actions).toEqual([
      PROHIBITIONS["PRH-R4-WAITAI"],
      PROHIBITIONS["PRH-R4-THEIRCH"],
      PROHIBITIONS["PRH-R7-FIXED"],
    ]);
    expect(templateSet(result)).toEqual(
      new Set([
        "TPL-UNDETERMINED-001@1.0",
        "TPL-CREDENTIAL-RECOVERY-001@1.0",
      ]),
    );
  });

  it("d: 가족 확인 + 송금 완료", () => {
    const result = decideActions(
      state({
        user_role: "family_proxy",
        transfer_state: "already_sent",
      }),
    );

    expect(mergeKeys(result.actions)).toEqual([
      "call:bank_fraud",
      "call:112",
      "procedure:written_followup",
      "notice:proxy_scope",
    ]);
    expect(result.next_steps).toEqual([]);
    expect(result.actions[0].prohibited_actions).toEqual([
      PROHIBITIONS["PRH-R3-WAIT"],
      PROHIBITIONS["PRH-R3-BULK"],
      PROHIBITIONS["PRH-MOD-PROXY"],
    ]);
    const proxyCard = result.actions[3];
    expect(
      [
        proxyCard.title,
        ...proxyCard.purpose_slots,
        ...proxyCard.required_followup,
      ].join(" "),
    ).not.toContain("대리 실행");
    expect(templateSet(result)).toEqual(
      new Set([
        "TPL-BANK-STOP-001@1.0",
        "TPL-WRITTEN-FOLLOWUP-001@1.1",
        "TPL-PROXY-SCOPE-001@1.0",
      ]),
    );
  });

  it("e: 미송금 + 개인정보 공유 + 기기·안전 기기 미확인", () => {
    const result = decideActions(
      state({
        personal_data_exposure_state: "shared",
        device_compromise_state: "unknown",
        safe_device_available: "unknown",
      }),
    );

    expect(mergeKeys(result.actions)).toEqual([
      "question:state_confirm",
      "action:stop_contact",
      "verify:official_channel",
      "call:1332",
    ]);
    expect(result.next_steps).toEqual([]);
    expect(result.actions[0].question_axes).toEqual(["device"]);
    expect(result.actions[2].rule_ids).toEqual(["R5", "R7"]);
    expect(result.actions[3].rule_ids).toEqual(["R5", "R7"]);
    expect(result.actions[0].prohibited_actions).toEqual([
      PROHIBITIONS["PRH-R5-CONFIRM"],
      PROHIBITIONS["PRH-R7-FIXED"],
      PROHIBITIONS["PRH-MOD-DEVICE"],
    ]);
    expect(templateSet(result)).toEqual(
      new Set([
        "TPL-UNDETERMINED-001@1.0",
        "TPL-OFFICIAL-VERIFY-001@1.0",
      ]),
    );
  });

  it("R3 서면 후속은 적용 대상·기한·1394 역할을 승인 문구로 고정한다", () => {
    const result = decideActions(
      state({
        transfer_state: "already_sent",
      }),
    );
    const writtenFollowup = result.actions.find(
      (card) => card.merge_key === "procedure:written_followup",
    );

    expect(writtenFollowup).toMatchObject({
      title:
        "긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우, 신청한 날부터 3일 이내에 피해구제신청서를 해당 금융회사에 제출해야 합니다.",
      prerequisite: [
        "긴급·부득이한 사유로 전화·구술로 피해구제를 신청한 경우",
      ],
      purpose_slots: [
        "긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우, 신청한 날부터 3일 이내에 피해구제신청서를 해당 금융회사에 제출해야 합니다.",
      ],
      required_followup: [
        "긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우, 신청한 날부터 3일 이내에 피해구제신청서를 해당 금융회사에 제출해야 합니다.",
        "1394 — 전기통신금융사기 통합대응단의 피해상담, 의심 전화번호·사이트 제보, 관계기관 연계",
      ],
      official_sources: [
        "SRC-EASYLAW-CONTACT",
        "SRC-EASYLAW-STOPPAY",
        "SRC-KOREA-1394",
      ],
      template_versions: ["TPL-WRITTEN-FOLLOWUP-001@1.1"],
      rule_ids: ["R3"],
      priority: 3,
      severity: 3,
      order: 3,
      forced: true,
    });
  });
});
