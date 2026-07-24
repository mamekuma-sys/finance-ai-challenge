import { describe, expect, it } from "vitest";

import type { IncidentState } from "@/lib/contracts";

import { decideActions } from "../engine";
import { DECISION_SNAPSHOT_FIXTURES } from "./snapshot-fixtures";

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

function uniqueTemplateVersions(
  result: ReturnType<typeof decideActions>,
): string[] {
  return [
    ...new Set(
      [...result.actions, ...result.next_steps].flatMap(
        (card) => card.template_versions,
      ),
    ),
  ];
}

describe("§4.5.4 복합 조합 독립 인수 픽스처", () => {
  it.each(DECISION_SNAPSHOT_FIXTURES)(
    "$id: $label",
    (fixture) => {
      const result = decideActions(fixture.state);

      expect(result.actions.map((card) => card.merge_key)).toEqual(
        fixture.action_merge_keys,
      );
      expect(result.next_steps.map((card) => card.merge_key)).toEqual(
        fixture.next_step_merge_keys,
      );
      expect(
        [...result.actions, ...result.next_steps].map(
          (card) => card.priority,
        ),
      ).toEqual(
        Array.from(
          {
            length:
              fixture.action_merge_keys.length +
              fixture.next_step_merge_keys.length,
          },
          (_, index) => index + 1,
        ),
      );
      expect(result.actions[0].prohibited_actions).toEqual(
        fixture.prohibited_actions,
      );
      expect(uniqueTemplateVersions(result)).toEqual(
        fixture.template_versions,
      );
    },
  );

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
        "SRC-LAW-DECREE3",
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
