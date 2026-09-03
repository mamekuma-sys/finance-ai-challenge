import { describe, expect, it } from "vitest";

import {
  P0_CONTROL_FIELDS,
  hasConfirmedP0Controls,
  p0ConfirmationProgress,
} from "@/lib/document-review-state";

const all = P0_CONTROL_FIELDS.map((field) => ({ field, confirmed: true }));

describe("P0 확정 진행률", () => {
  it("아무것도 확정되지 않으면 0/6과 6개 전부를 남은 항목으로 돌려준다", () => {
    const progress = p0ConfirmationProgress([]);

    expect(progress).toEqual({
      confirmed: 0,
      total: 6,
      missing: [...P0_CONTROL_FIELDS],
    });
  });

  it("일부만 확정되면 남은 필드 이름을 그대로 돌려준다", () => {
    const progress = p0ConfirmationProgress([
      { field: "max_supply", confirmed: true },
      { field: "issuer_role", confirmed: true },
      { field: "collateral_verified", confirmed: false },
    ]);

    expect(progress.confirmed).toBe(2);
    expect(progress.missing).toEqual([
      "collateral_verified",
      "oracle_max_age",
      "price_band_breach",
      "pauser_role",
    ]);
  });

  it("게이트가 열리는 시점과 진행률 완료가 정확히 일치한다", () => {
    expect(p0ConfirmationProgress(all)).toEqual({ confirmed: 6, total: 6, missing: [] });
    expect(hasConfirmedP0Controls(all)).toBe(true);

    const oneShort = all.slice(0, 5);
    expect(p0ConfirmationProgress(oneShort).confirmed).toBe(5);
    expect(hasConfirmedP0Controls(oneShort)).toBe(false);
  });

  it("중복 필드를 두 번 세지 않는다", () => {
    const progress = p0ConfirmationProgress([
      { field: "max_supply", confirmed: true },
      { field: "max_supply", confirmed: true },
    ]);

    expect(progress.confirmed).toBe(1);
  });
});
