import { describe, expect, it } from "vitest";

import {
  DEVICE_COMPROMISE_STATES,
  EXPOSURE_STATES,
  SAFE_DEVICE_AVAILABILITIES,
  TRANSFER_STATES,
  USER_ROLES,
  type IncidentState,
} from "@/lib/contracts";
import { TEMPLATE_REGISTRY } from "@/lib/templates/registry";

import { decideActions, type DecisionActionCard } from "../engine";
import { PROHIBITIONS } from "../prohibitions";
import { RULES, type MergeKey, type RuleId } from "../rules";
import { OFFICIAL_SOURCES } from "../sources";

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

const POTENTIAL_SEVERITY = {
  device: 1,
  transfer: 3,
  credential: 4,
  personal_data: 6,
} as const;

type ExpectedQuestionAxis = keyof typeof POTENTIAL_SEVERITY;

function allCards(result: ReturnType<typeof decideActions>) {
  return [...result.actions, ...result.next_steps];
}

function ruleSeverity(ruleId: RuleId, state: IncidentState): number {
  if (ruleId === "R1" || ruleId === "R2") {
    return state.device_compromise_state === "remote_control" ? 1 : 2;
  }
  if (ruleId === "R3") {
    return 3;
  }
  if (ruleId === "R4") {
    return state.credential_exposure_state === "shared" ? 4 : 5;
  }
  if (ruleId === "R5") {
    return 6;
  }
  return 7;
}

function expectedQuestionAxes(state: IncidentState): ExpectedQuestionAxis[] {
  const axes: ExpectedQuestionAxis[] = [];
  if (state.device_compromise_state === "unknown") {
    axes.push("device");
  }
  if (state.transfer_state === "unknown") {
    axes.push("transfer");
  }
  if (state.credential_exposure_state === "unknown") {
    axes.push("credential");
  }
  if (state.personal_data_exposure_state === "unknown") {
    axes.push("personal_data");
  }
  axes.sort(
    (left, right) => POTENTIAL_SEVERITY[left] - POTENTIAL_SEVERITY[right],
  );
  return axes.length === 4
    ? axes.filter((axis) => axis !== "personal_data")
    : axes.slice(0, 3);
}

interface ExpectedMerge {
  purposeSlots: Set<string>;
  officialSources: Set<string>;
  templateVersions: Set<string>;
}

function expectedMerges(state: IncidentState): Map<MergeKey, ExpectedMerge> {
  const expected = new Map<MergeKey, ExpectedMerge>();
  for (const rule of RULES) {
    if (!rule.match(state)) {
      continue;
    }
    for (const action of rule.actions) {
      const current = expected.get(action.merge_key) ?? {
        purposeSlots: new Set<string>(),
        officialSources: new Set<string>(),
        templateVersions: new Set<string>(),
      };
      current.purposeSlots.add(action.purpose_slot);
      action.source_ids.forEach((sourceId) =>
        current.officialSources.add(sourceId),
      );
      action.template_versions.forEach((templateVersion) =>
        current.templateVersions.add(templateVersion),
      );
      expected.set(action.merge_key, current);
    }
  }

  const hasProcedure = [
    "call:bank_fraud",
    "call:112",
    "procedure:written_followup",
  ].some((mergeKey) => expected.has(mergeKey as MergeKey));
  if (state.user_role === "family_proxy" && hasProcedure) {
    expected.set("notice:proxy_scope", {
      purposeSlots: new Set([
        "본인 제한 절차는 본인이 수행하고 가족은 준비를 보조",
      ]),
      officialSources: new Set(["SRC-EASYLAW-CONTACT"]),
      templateVersions: new Set(["TPL-PROXY-SCOPE-001@1.0"]),
    });
  }
  return expected;
}

function expectSameSet(actual: readonly string[], expected: Set<string>) {
  expect(new Set(actual)).toEqual(expected);
}

describe("조치 결정 엔진 1,152개 전수 속성", () => {
  it("조합 수, 총함수 형태, 연속 priority, 결정론, 경고 필드 분리를 보장한다", () => {
    expect(ALL_STATES).toHaveLength(1_152);

    for (const state of ALL_STATES) {
      const first = decideActions(state);
      const second = decideActions(state);
      const cards = allCards(first);

      expect(first).toEqual(second);
      expect(first.actions.length).toBeGreaterThanOrEqual(1);
      expect(first.actions.length).toBeLessThanOrEqual(4);
      expect(cards.map((card) => card.priority)).toEqual(
        Array.from({ length: cards.length }, (_, index) => index + 1),
      );
      expect(cards.every((card) => card.do_not_show_when.length === 0)).toBe(
        true,
      );
      expect(new Set(cards.map((card) => card.merge_key)).size).toBe(
        cards.length,
      );
    }
  });

  it("긴급 우선, already_sent 후속, device·proxy 수정자를 보장한다", () => {
    expect(ALL_STATES).toHaveLength(1_152);

    for (const state of ALL_STATES) {
      const result = decideActions(state);
      const cards = allCards(result);
      const questionAxes = expectedQuestionAxes(state);
      const questionCard = cards.find(
        (card) =>
          card.merge_key === "question:state_confirm" &&
          card.question_axes !== undefined,
      );

      if (questionAxes.length > 0) {
        expect(questionCard?.question_axes).toEqual(questionAxes);
        const questionSeverity = Math.min(
          ...questionAxes.map((axis) => POTENTIAL_SEVERITY[axis]),
        );
        for (const rule of RULES) {
          if (rule.id === "R7" || !rule.match(state)) {
            continue;
          }
          const severity = ruleSeverity(rule.id, state);
          if (severity <= 5 && severity < questionSeverity) {
            for (const row of rule.actions) {
              const action = cards.find(
                (card) => card.merge_key === row.merge_key,
              );
              expect(action?.priority).toBeLessThan(
                questionCard?.priority ?? Number.POSITIVE_INFINITY,
              );
            }
          }
        }
      } else {
        expect(questionCard).toBeUndefined();
      }

      if (state.transfer_state === "already_sent") {
        const writtenCards = cards.filter(
          (card) => card.merge_key === "procedure:written_followup",
        );
        expect(writtenCards).toHaveLength(1);
        expect(
          result.actions.some(
            (card) => card.merge_key === "procedure:written_followup",
          ),
        ).toBe(true);
        expect(
          result.next_steps.some(
            (card) => card.merge_key === "procedure:written_followup",
          ),
        ).toBe(false);
        expect(writtenCards[0].forced).toBe(true);
      }

      const needsDeviceModifier = [
        "suspected_app",
        "remote_control",
        "unknown",
      ].includes(state.device_compromise_state);
      if (needsDeviceModifier) {
        expect(
          cards.every((card) =>
            card.prohibited_actions.includes(
              PROHIBITIONS["PRH-MOD-DEVICE"],
            ),
          ),
        ).toBe(true);
        const safeDeviceKeys = new Set([
          "call:bank_fraud",
          "call:112",
          "call:1332",
          "action:credential_recovery",
        ]);
        expect(
          cards
            .filter((card) => safeDeviceKeys.has(card.merge_key))
            .every((card) =>
              card.prerequisite.includes(
                "의심 기기와 분리된 안전한 기기에서 실행",
              ),
            ),
        ).toBe(true);
      }

      const hasProcedure = cards.some((card) =>
        [
          "call:bank_fraud",
          "call:112",
          "procedure:written_followup",
        ].includes(card.merge_key),
      );
      if (state.user_role === "family_proxy") {
        expect(
          cards.every((card) =>
            card.prerequisite.includes("가족을 대신해 확인 중"),
          ),
        ).toBe(true);
        if (hasProcedure) {
          expect(result.actions.at(-1)?.merge_key).toBe(
            "notice:proxy_scope",
          );
        }
      }
    }
  });

  it("next_steps 무손실과 병합 목적·출처 합집합을 독립 재계산해 보존한다", () => {
    expect(ALL_STATES).toHaveLength(1_152);

    for (const state of ALL_STATES) {
      const result = decideActions(state);
      const cards = allCards(result);
      const expected = expectedMerges(state);

      expect(new Set(cards.map((card) => card.merge_key))).toEqual(
        new Set(expected.keys()),
      );
      for (const card of cards) {
        const expectedMerge = expected.get(card.merge_key as MergeKey);
        expect(expectedMerge).toBeDefined();
        expectSameSet(card.purpose_slots, expectedMerge!.purposeSlots);
        expectSameSet(
          card.official_sources,
          expectedMerge!.officialSources,
        );
        expectSameSet(
          card.template_versions,
          expectedMerge!.templateVersions,
        );
      }
    }
  });

  it("proxy 안내 카드와 proxy 금지 문구가 양방향으로 일치한다", () => {
    expect(ALL_STATES).toHaveLength(1_152);

    for (const state of ALL_STATES) {
      const cards = allCards(decideActions(state));
      const hasProxyCard = cards.some(
        (card) => card.merge_key === "notice:proxy_scope",
      );
      const allCardsHaveProxyProhibition = cards.every((card) =>
        card.prohibited_actions.includes(
          PROHIBITIONS["PRH-MOD-PROXY"],
        ),
      );

      expect(hasProxyCard).toBe(allCardsHaveProxyProhibition);
    }
  });

  it("금지 합집합 공통 적용과 출처·템플릿 레지스트리 무결성을 보장한다", () => {
    expect(ALL_STATES).toHaveLength(1_152);

    for (const state of ALL_STATES) {
      const cards: DecisionActionCard[] = allCards(decideActions(state));
      const firstProhibitions = cards[0].prohibited_actions;

      expect(
        cards.every(
          (card) =>
            JSON.stringify(card.prohibited_actions) ===
            JSON.stringify(firstProhibitions),
        ),
      ).toBe(true);
      for (const card of cards) {
        for (const sourceId of card.official_sources) {
          expect(
            OFFICIAL_SOURCES[sourceId as keyof typeof OFFICIAL_SOURCES],
          ).toBeDefined();
        }
        for (const templateVersion of card.template_versions) {
          const template =
            TEMPLATE_REGISTRY[
              templateVersion as keyof typeof TEMPLATE_REGISTRY
            ];
          expect(template).toBeDefined();
          expect(template.template_id).not.toBe("");
          expect(template.template_version).not.toBe("");
          expect(template.official_source.url).not.toBe("");
          expect(template.source_effective_date).not.toBe("");
          expect(template.source_reviewed_at).not.toBe("");
          expect(template.next_review_at).not.toBe("");
          expect(Object.values(template.change_log).every(Boolean)).toBe(
            true,
          );
        }
      }
    }
  });
});
