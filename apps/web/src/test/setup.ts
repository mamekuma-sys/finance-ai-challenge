import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest globals가 꺼져 있어 Testing Library의 자동 cleanup이 붙지 않는다.
// 케이스마다 DOM을 비우지 않으면 role 조회가 이전 렌더와 충돌한다.
afterEach(() => {
  cleanup();
});
