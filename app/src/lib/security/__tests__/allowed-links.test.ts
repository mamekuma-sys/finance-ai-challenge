import { describe, expect, it } from "vitest";

import { isAllowedExternalUrl } from "../allowed-links";

describe("외부 링크 허용 목록", () => {
  it("검수된 공식 도메인과 확정 근거 URL만 통과시킨다", () => {
    expect(isAllowedExternalUrl("https://www.fsc.go.kr/a")).toBe(true);
    expect(isAllowedExternalUrl("https://easylaw.go.kr/CSP/test")).toBe(true);
    expect(isAllowedExternalUrl("https://fine.fss.or.kr")).toBe(true);
    expect(
      isAllowedExternalUrl("https://www.counterscam112.go.kr"),
    ).toBe(true);
    expect(isAllowedExternalUrl("https://www.korea.kr/a")).toBe(true);
    expect(
      isAllowedExternalUrl(
        "https://www.nongmin.com/article/20210702340948",
      ),
    ).toBe(true);
  });

  it("HTTP·유사 도메인·허용 목록 밖 URL을 차단한다", () => {
    expect(isAllowedExternalUrl("http://www.fsc.go.kr/a")).toBe(false);
    expect(isAllowedExternalUrl("https://fsc.go.kr.attacker.example/a")).toBe(
      false,
    );
    expect(isAllowedExternalUrl("https://example.com")).toBe(false);
    expect(isAllowedExternalUrl("not-a-url")).toBe(false);
  });
});
