import { describe, expect, it } from "vitest";

import { numeric } from "../evidence-report";

describe("numeric — 통제조건 값 표기", () => {
  it("groups thousands so large limits stay readable", () => {
    expect(numeric(100000)).toBe("100,000");
  });

  it("keeps a boolean requirement readable instead of turning it into 1", () => {
    // collateral_verified=true 를 1로 보여주면 준법 담당자가 읽을 수 없다.
    expect(numeric(true)).toBe("true");
    expect(numeric(false)).toBe("false");
  });

  it("leaves a role name alone", () => {
    expect(numeric("ISSUER_ROLE")).toBe("ISSUER_ROLE");
  });

  it("groups a numeric string that arrived as text", () => {
    expect(numeric("120000")).toBe("120,000");
  });

  it("does not turn an empty value into zero", () => {
    expect(numeric("")).toBe("");
  });
});
