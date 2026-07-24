import { describe, expect, it } from "vitest";

import type {
  ActionFactEvent,
  ActionFactSource,
  ActionFactState,
} from "@/lib/contracts";

import {
  appendActionFact,
  reduceCurrentState,
  type ActionFactInput,
} from "../action-fact";

function input(
  eventId: string,
  state: ActionFactState,
  source: ActionFactSource,
  overrides: Partial<ActionFactInput> = {},
): ActionFactInput {
  return {
    event_id: eventId,
    action_id: "synthetic-action-1",
    event_type: "observation",
    occurred_at: "2026-07-25T00:00:00.000Z",
    state,
    source,
    ...overrides,
  };
}

describe("행동 이벤트 이력(내 기기 보관) 순수 로직", () => {
  it("허용된 순방향 전이를 append-only로 기록하고 previous_state를 계산한다", () => {
    const steps: Array<[ActionFactState, ActionFactSource]> = [
      ["viewed", "ui_event"],
      ["dialer_opened", "ui_event"],
      ["user_reported_connected", "user_statement"],
      ["user_reported_requested", "user_statement"],
      ["user_reported_receipt_confirmed", "user_statement"],
    ];
    let events: ActionFactEvent[] = [];

    steps.forEach(([state, source], index) => {
      const before = events;
      const result = appendActionFact(
        events,
        input(`evt-${index + 1}`, state, source),
      );
      expect(result.rejected).toBeUndefined();
      expect(before).toHaveLength(index);
      expect(result.events).toHaveLength(index + 1);
      expect(result.events.at(-1)?.previous_state).toBe(
        index === 0 ? null : steps[index - 1][0],
      );
      events = result.events;
    });

    expect(reduceCurrentState(events, "synthetic-action-1")).toBe(
      "user_reported_receipt_confirmed",
    );
  });

  it("건너뛰기·역방향 전이와 허용되지 않은 출처를 거부한다", () => {
    const viewed = appendActionFact(
      [],
      input("evt-viewed", "viewed", "ui_event"),
    ).events;
    const skipped = appendActionFact(
      viewed,
      input(
        "evt-skipped",
        "user_reported_connected",
        "user_statement",
      ),
    );
    expect(skipped.rejected?.code).toBe("INVALID_TRANSITION");
    expect(skipped.events).toEqual(viewed);

    const badSource = appendActionFact(
      viewed,
      input("evt-source", "dialer_opened", "user_statement"),
    );
    expect(badSource.rejected?.code).toBe("INVALID_SOURCE");

    const dialer = appendActionFact(
      viewed,
      input("evt-dialer", "dialer_opened", "ui_event"),
    ).events;
    const backward = appendActionFact(
      dialer,
      input("evt-backward", "viewed", "ui_event"),
    );
    expect(backward.rejected?.code).toBe("INVALID_TRANSITION");
  });

  it("not_applicable·unknown을 어느 상태에서든 기록하고 이후 확인을 재개한다", () => {
    const viewed = appendActionFact(
      [],
      input("evt-viewed", "viewed", "ui_event"),
    ).events;
    const unknown = appendActionFact(
      viewed,
      input("evt-unknown", "unknown", "user_statement"),
    );
    expect(unknown.rejected).toBeUndefined();
    const resumed = appendActionFact(
      unknown.events,
      input("evt-resumed", "dialer_opened", "ui_event"),
    );
    expect(resumed.rejected).toBeUndefined();

    const notApplicable = appendActionFact(
      resumed.events,
      input("evt-na", "not_applicable", "user_statement"),
    );
    expect(notApplicable.rejected).toBeUndefined();
  });

  it("occurred_at과 무관하게 append 순서의 최신 observation을 환원한다", () => {
    const first = appendActionFact(
      [],
      input("evt-late-clock", "viewed", "ui_event", {
        occurred_at: "2099-01-01T00:00:00.000Z",
      }),
    ).events;
    const second = appendActionFact(
      first,
      input("evt-early-clock", "dialer_opened", "ui_event", {
        occurred_at: "2000-01-01T00:00:00.000Z",
      }),
    ).events;

    expect(reduceCurrentState(second, "synthetic-action-1")).toBe(
      "dialer_opened",
    );
  });

  it("정정 이벤트로 이전 확인을 되돌리고 정정된 observation을 환원에서 제외한다", () => {
    const viewed = appendActionFact(
      [],
      input("evt-viewed", "viewed", "ui_event"),
    ).events;
    const dialer = appendActionFact(
      viewed,
      input("evt-dialer", "dialer_opened", "ui_event"),
    ).events;
    const correction = appendActionFact(
      dialer,
      input("evt-correction", "viewed", "user_statement", {
        event_type: "correction",
        corrects_event_id: "evt-dialer",
      }),
    );

    expect(correction.rejected).toBeUndefined();
    expect(correction.events).toHaveLength(3);
    expect(correction.events[2]).toMatchObject({
      event_type: "correction",
      corrects_event_id: "evt-dialer",
      previous_state: "dialer_opened",
    });
    expect(
      reduceCurrentState(correction.events, "synthetic-action-1"),
    ).toBe("viewed");

    const repeated = appendActionFact(
      correction.events,
      input("evt-correction-2", "viewed", "user_statement", {
        event_type: "correction",
        corrects_event_id: "evt-dialer",
      }),
    );
    expect(repeated.rejected?.code).toBe(
      "CORRECTION_TARGET_ALREADY_CORRECTED",
    );
  });

  it("동일 action_id+state 연속 중복은 새 이벤트 없이 축약한다", () => {
    const viewed = appendActionFact(
      [],
      input("evt-viewed", "viewed", "ui_event"),
    ).events;
    const duplicate = appendActionFact(
      viewed,
      input("evt-viewed-duplicate", "viewed", "ui_event"),
    );

    expect(duplicate.deduplicated).toBe(true);
    expect(duplicate.rejected).toBeUndefined();
    expect(duplicate.events).toEqual(viewed);
  });
});
