import { describe, expect, it } from "vitest";

import { SCREEN_STATES, parseScreenState } from "../screen-state";

describe("parseScreenState", () => {
  it("defaults to normal when no state param is given", () => {
    expect(parseScreenState(undefined)).toBe("normal");
  });

  it("accepts every state named in the screen state table", () => {
    for (const state of SCREEN_STATES) {
      expect(parseScreenState(state)).toBe(state);
    }
  });

  it("falls back to normal instead of erroring on an unknown state", () => {
    expect(parseScreenState("bogus")).toBe("normal");
  });
});
