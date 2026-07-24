import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "../route";

describe("B5 llms.txt 현재 기능 정직 표기", () => {
  it("합성 샘플을 암시하지 않고 구조화 상태 선택 데모와 미제공 경계를 밝힌다", async () => {
    const request = {
      nextUrl: new URL("https://goldentime.example/llms.txt"),
    } as NextRequest;
    const response = GET(request);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("현재 데스크는 구조화 상태 선택 데모만 제공함");
    expect(body).not.toContain("합성 샘플");
    expect(body).toContain("현재 배포본 미제공");
  });
});
