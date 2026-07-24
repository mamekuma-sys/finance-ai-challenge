import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { SYNTHETIC_SCENARIOS } from "@/lib/scenarios/synthetic";
import { GET } from "../route";

async function body() {
  const request = {
    nextUrl: new URL("https://goldentime.example/llms.txt"),
  } as NextRequest;
  const response = GET(request);
  return { status: response.status, text: await response.text() };
}

describe("llms.txt 현재 기능 정직 표기", () => {
  it("실제로 제공하는 합성 샘플만 기술하고 미제공 경계를 밝힌다", async () => {
    const { status, text } = await body();

    expect(status).toBe(200);
    // 합성 샘플 언급은 F-01이 실제로 구현된 뒤에만 허용된다.
    expect(SYNTHETIC_SCENARIOS.length).toBe(3);
    expect(text).toContain("합성 샘플 3건");
    expect(text).toContain("실제 사건이 아님");
    expect(text).toContain("현재 배포본 미제공");
  });

  it("합성 샘플 표기의 건수가 실제 구현 건수와 일치한다", async () => {
    const { text } = await body();
    const match = text.match(/합성 샘플 (\d+)건/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(SYNTHETIC_SCENARIOS.length);
  });

  it("아직 없는 자유 입력·판정·REST·MCP를 있는 것처럼 쓰지 않는다", async () => {
    const { text } = await body();
    // 목록 항목(`- `로 시작)만 본다 — 섹션 제목은 상태 표기가 아니다.
    const bullets = text.split("\n").filter((l) => l.trimStart().startsWith("-"));
    for (const claim of [
      "자유 입력 가림 경로",
      "REST",
      "MCP",
    ]) {
      const lines = bullets.filter((l) => l.includes(claim));
      expect(lines.length, `${claim} 항목이 llms.txt 목록에 없음`).toBeGreaterThan(0);
      expect(
        lines.some((l) => /미제공|후속 단계|활성화되지 않음/.test(l)),
        `${claim} 항목이 미제공으로 표기되지 않음: ${lines.join(" | ")}`,
      ).toBe(true);
    }
    expect(text).toContain("판정 기능을 제공하지 않");
  });
});
