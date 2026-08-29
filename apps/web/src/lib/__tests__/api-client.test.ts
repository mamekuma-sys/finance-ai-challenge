import { describe, expect, it } from "vitest";

import { detectApiRuntime, resolveApiBaseUrl } from "@/lib/api-client";

describe("API runtime base selection", () => {
  const environment = {
    NEXT_PUBLIC_API_BASE_URL: "/backend-api",
    BACKEND_API_BASE_URL: "http://api:8000",
  };

  it("detects browser runtime only when window exists", () => {
    expect(detectApiRuntime({ window: {} })).toBe("browser");
    expect(detectApiRuntime({})).toBe("server");
  });

  it("uses only the relative same-origin public path in browsers", () => {
    expect(resolveApiBaseUrl("browser", environment)).toBe("/backend-api");
  });

  it("uses only the internal server base during server rendering", () => {
    expect(resolveApiBaseUrl("server", environment)).toBe("http://api:8000");
  });

  it("rejects a cross-origin browser API base", () => {
    expect(() => resolveApiBaseUrl("browser", {
      ...environment,
      NEXT_PUBLIC_API_BASE_URL: "https://api.example",
    })).toThrow("same-origin path");
  });
});
