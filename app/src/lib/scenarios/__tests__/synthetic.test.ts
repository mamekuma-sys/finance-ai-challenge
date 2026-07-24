import { describe, expect, it } from "vitest";

import {
  CHANNELS_FOR_TEST,
  isValidIncidentState,
} from "./helpers";
import { decideActions } from "@/lib/decision/engine";
import {
  FORBIDDEN_BODY_PATTERNS,
  SYNTHETIC_SCENARIOS,
  findSyntheticScenario,
} from "../synthetic";

describe("F-01 합성 시나리오", () => {
  it("§5.4 데모 집합 규모(합성 3건)와 합성 표식을 만족한다", () => {
    expect(SYNTHETIC_SCENARIOS).toHaveLength(3);
    for (const scenario of SYNTHETIC_SCENARIOS) {
      expect(scenario.is_synthetic).toBe(true);
      expect(scenario.scenario_id.startsWith("demo-")).toBe(true);
      expect(scenario.title.length).toBeGreaterThan(0);
      expect(scenario.summary.length).toBeGreaterThan(0);
      expect(scenario.body.length).toBeGreaterThan(0);
      expect(scenario.warning_signals.length).toBeGreaterThan(0);
      expect(scenario.derived_from.length).toBeGreaterThan(0);
    }
  });

  it("scenario_id가 서로 겹치지 않고 문장 템플릿도 중복되지 않는다", () => {
    const ids = SYNTHETIC_SCENARIOS.map((s) => s.scenario_id);
    expect(new Set(ids).size).toBe(ids.length);
    const bodies = SYNTHETIC_SCENARIOS.map((s) => s.body);
    expect(new Set(bodies).size).toBe(bodies.length);
  });

  it("본문에 활성 URL·실제 연락처·주민번호·계좌형 문자열이 없다", () => {
    for (const scenario of SYNTHETIC_SCENARIOS) {
      for (const rule of FORBIDDEN_BODY_PATTERNS) {
        expect(
          rule.pattern.test(scenario.body),
          `${scenario.scenario_id} 본문이 금지 패턴 ${rule.id}에 걸림`,
        ).toBe(false);
      }
      // 합성 표식이 본문 자체에 보인다
      expect(scenario.body).toContain("합성");
      expect(scenario.body).toContain("실제 사건 아님");
    }
  });

  it("더미 전화번호와 .invalid 도메인만 사용한다", () => {
    for (const scenario of SYNTHETIC_SCENARIOS) {
      const phones = scenario.body.match(/01\d-\d{4}-\d{4}/g) ?? [];
      for (const phone of phones) {
        expect(phone).toBe("010-0000-0000");
      }
      // 호스트만 추출: 스킴 뒤부터 첫 `/`·공백·닫는 괄호 앞까지
      const hosts = [
        ...scenario.body.matchAll(/hxxps?:\/\/([^\s/)\]]+)/gi),
      ].map((m) => m[1]);
      expect(hosts.length).toBeGreaterThan(0 - 1); // 링크가 없는 시나리오도 허용
      for (const host of hosts) {
        expect(
          host.endsWith(".invalid"),
          `${scenario.scenario_id}의 호스트 "${host}"가 .invalid가 아님`,
        ).toBe(true);
      }
    }
  });

  it("channel이 §4.1 열거값 안에 있다", () => {
    for (const scenario of SYNTHETIC_SCENARIOS) {
      expect(CHANNELS_FOR_TEST).toContain(scenario.channel);
    }
  });

  it("suggested_state가 §4.4 열거값을 지키고 엔진이 거부하지 않는다", () => {
    for (const scenario of SYNTHETIC_SCENARIOS) {
      expect(
        isValidIncidentState(scenario.suggested_state),
        `${scenario.scenario_id}의 suggested_state가 §4.4 열거값 위반`,
      ).toBe(true);
      const result = decideActions(scenario.suggested_state);
      expect(result.actions.length).toBeGreaterThanOrEqual(1);
      expect(result.actions.length).toBeLessThanOrEqual(4);
    }
  });

  it("세 시나리오가 서로 다른 상태 조합을 만든다(대표 흐름 분리)", () => {
    const keys = SYNTHETIC_SCENARIOS.map((s) =>
      JSON.stringify(s.suggested_state),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("판정·위험도 라벨을 싣지 않는다(F-03 미구현 — 미구현 기능 암시 금지)", () => {
    const forbidden = /위험도|판정 결과|danger|caution|verdict|evidence_strength/i;
    for (const scenario of SYNTHETIC_SCENARIOS) {
      const serialized = JSON.stringify(scenario);
      expect(
        forbidden.test(serialized),
        `${scenario.scenario_id}에 판정 라벨이 포함됨`,
      ).toBe(false);
    }
  });

  it("findSyntheticScenario가 ID로 찾고 없으면 null을 준다", () => {
    expect(findSyntheticScenario(SYNTHETIC_SCENARIOS[0].scenario_id)).toBe(
      SYNTHETIC_SCENARIOS[0],
    );
    expect(findSyntheticScenario("holdout-001")).toBeNull();
    expect(findSyntheticScenario("")).toBeNull();
  });
});
