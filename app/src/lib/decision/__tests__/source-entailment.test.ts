import { describe, expect, it } from "vitest";

import {
  DEVICE_COMPROMISE_STATES,
  EXPOSURE_STATES,
  SAFE_DEVICE_AVAILABILITIES,
  TRANSFER_STATES,
  USER_ROLES,
  type IncidentState,
} from "@/lib/contracts";

import { decideActions } from "../engine";
import { RULES, type RuleId } from "../rules";
import { OFFICIAL_SOURCES } from "../sources";
import { SOURCE_ENTAILMENT_FIXTURES } from "./source-entailment-fixtures";

const ALL_STATES: IncidentState[] = TRANSFER_STATES.flatMap((transfer) =>
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

describe("A3 행동 카드 출처 entailment", () => {
  it("모든 규칙 행에 핵심 동사·공식 출처·원문 지지 문장 픽스처가 있다", () => {
    for (const rule of RULES) {
      for (const action of rule.actions) {
        const fixtures = SOURCE_ENTAILMENT_FIXTURES.filter(
          (fixture) =>
            fixture.rule_id === rule.id &&
            fixture.row_order === action.order &&
            fixture.merge_key === action.merge_key,
        );

        expect(fixtures.length).toBeGreaterThan(0);
        for (const fixture of fixtures) {
          expect(action.source_ids).toContain(fixture.source_id);
          expect(OFFICIAL_SOURCES[fixture.source_id]).toBeDefined();
          expect(fixture.core_verb.trim()).not.toBe("");
          expect(fixture.supporting_sentence.trim()).not.toBe("");
        }
      }
    }
  });

  it("1,152조합의 노출·접힘 카드가 기여한 모든 행의 지지 출처를 보존한다", () => {
    expect(ALL_STATES).toHaveLength(1_152);

    for (const state of ALL_STATES) {
      const result = decideActions(state);
      const cards = [...result.actions, ...result.next_steps];

      for (const card of cards) {
        if (card.rule_ids.length === 0) {
          const modifierFixtures = SOURCE_ENTAILMENT_FIXTURES.filter(
            (fixture) =>
              fixture.rule_id === "MOD-PROXY" &&
              fixture.merge_key === card.merge_key,
          );
          expect(modifierFixtures.length).toBeGreaterThan(0);
          expect(
            modifierFixtures.some((fixture) =>
              card.official_sources.includes(fixture.source_id),
            ),
          ).toBe(true);
          continue;
        }

        for (const ruleId of card.rule_ids as RuleId[]) {
          const rule = RULES.find((candidate) => candidate.id === ruleId);
          const action = rule?.actions.find(
            (candidate) => candidate.merge_key === card.merge_key,
          );
          expect(action).toBeDefined();

          const fixtures = SOURCE_ENTAILMENT_FIXTURES.filter(
            (fixture) =>
              fixture.rule_id === ruleId &&
              fixture.row_order === action?.order &&
              fixture.merge_key === card.merge_key,
          );
          expect(fixtures.length).toBeGreaterThan(0);
          for (const fixture of fixtures) {
            expect(card.official_sources).toContain(fixture.source_id);
          }
        }
      }
    }
  });
});
