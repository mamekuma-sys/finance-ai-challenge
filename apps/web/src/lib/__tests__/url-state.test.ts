import { describe, expect, it } from "vitest";

import {
  missingReferenceFromError,
  parseRouteUrlState,
  parseUrlState,
  serializeUrlState,
  validateUrlStateReferences,
} from "@/lib/url-state";
import { AppError } from "@/lib/adapters/errors";

describe("URL state contract", () => {
  it("parses and serializes shareable selection state", () => {
    const parsed = parseUrlState(
      new URLSearchParams(
        "scan=scan_02&base=scan_01&finding=finding%3Acap&constraint=constraint_1&panel=simulator",
      ),
    );

    expect(parsed).toEqual({
      ok: true,
      value: {
        scan: "scan_02",
        base: "scan_01",
        finding: "finding:cap",
        constraint: "constraint_1",
        panel: "simulator",
      },
    });
    expect(
      serializeUrlState({
        finding: "finding:cap",
        scan: "scan_02",
      }),
    ).toEqual({
      ok: true,
      search: "scan=scan_02&finding=finding%3Acap",
    });
  });

  it.each([
    ["empty", new URLSearchParams("scan="), "empty"],
    ["duplicate", new URLSearchParams("scan=scan_1&scan=scan_2"), "duplicate"],
    ["route injection", new URLSearchParams("finding=../../reports/private"), "invalid"],
    ["unsupported panel", new URLSearchParams("panel=admin"), "invalid"],
  ])("returns an invalid result for %s values", (_label, input, reason) => {
    const parsed = parseUrlState(input);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.invalid[0]?.reason).toBe(reason);
    }
  });

  it("rejects unsafe values during serialization", () => {
    expect(serializeUrlState({ scan: "/internal/route" })).toEqual({
      ok: false,
      invalid: [{ key: "scan", reason: "invalid", values: ["/internal/route"] }],
    });
  });

  it.each([
    ["home", new URLSearchParams("scan=scan_1"), "scan"],
    ["asset", new URLSearchParams("finding=finding_1"), "finding"],
    ["document", new URLSearchParams("scan=scan_1"), "scan"],
    ["scan", new URLSearchParams("constraint=constraint_1"), "constraint"],
    ["report", new URLSearchParams("panel=simulator"), "panel"],
  ] as const)("rejects parameters outside the %s route allowlist", (route, input, key) => {
    const parsed = parseRouteUrlState(route, input);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.invalid).toContainEqual({
        key,
        reason: "not_allowed",
        values: input.getAll(key),
      });
    }
  });

  it("preserves duplicate values from Next searchParams records", () => {
    const parsed = parseRouteUrlState("scan", {
      scan: ["scan_1", "scan_2"],
      base: "scan_0",
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.invalid[0]?.reason).toBe("duplicate");
  });

  it("accepts only each route's supported state", () => {
    expect(
      parseRouteUrlState("scan", new URLSearchParams("scan=scan_2&base=scan_1&finding=f_1")),
    ).toEqual({
      ok: true,
      value: { scan: "scan_2", base: "scan_1", finding: "f_1" },
    });
    expect(
      parseRouteUrlState("asset", new URLSearchParams("scan=scan_2&panel=simulator")),
    ).toEqual({
      ok: true,
      value: { scan: "scan_2", panel: "simulator" },
    });
  });

  it.each([
    ["scan", { scan: "scan_missing" }, { scanIds: ["scan_1"] }, "scan"],
    ["base", { base: "scan_missing" }, { scanIds: ["scan_1"] }, "base"],
    ["finding", { finding: "finding_missing" }, { findingIds: ["finding_1"] }, "finding"],
    [
      "constraint",
      { constraint: "constraint_missing" },
      { constraintIds: ["constraint_1"] },
      "constraint",
    ],
  ] as const)("flags a missing %s reference before content renders", (_label, state, refs, key) => {
    expect(validateUrlStateReferences(state, refs)).toEqual([
      { key, reason: "missing_reference", values: [Object.values(state)[0]] },
    ]);
  });

  it("uses structured failure resource instead of scan-first URL priority", () => {
    const error = new AppError(
      "not_found",
      404,
      { error: { code: "SCAN_NOT_FOUND", message: "scan not found: base_missing" } },
      { resource: "base", requestedId: "base_missing" },
    );

    expect(
      missingReferenceFromError(error, {
        scan: "scan_selected",
        base: "base_missing",
      }),
    ).toEqual({
      key: "base",
      reason: "missing_reference",
      values: ["base_missing"],
    });
  });

  it("never converts an asset fetch failure into a URL reference failure", () => {
    const error = new AppError("not_found", 404, undefined, {
      resource: "asset",
      requestedId: "asset_missing",
    });

    expect(missingReferenceFromError(error, { scan: "scan_selected" })).toBeUndefined();
  });
});
