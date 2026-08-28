/**
 * 생성된 OpenAPI 타입만 쓰는 API client.
 *
 * 계약이 바뀌면 `npm run gen:api` 이후 typecheck에서 소비처가 먼저 깨진다.
 */
import createClient from "openapi-fetch";

import type { paths } from "@/types/generated/api";

type ApiRuntime = "browser" | "server";
type ApiEnvironment = {
  NEXT_PUBLIC_API_BASE_URL?: string;
  BACKEND_API_BASE_URL?: string;
};

export function detectApiRuntime(
  globalObject: { window?: unknown } = globalThis,
): ApiRuntime {
  return typeof globalObject.window === "undefined" ? "server" : "browser";
}

export function resolveApiBaseUrl(
  runtime: ApiRuntime,
  environment: ApiEnvironment = {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    BACKEND_API_BASE_URL: process.env.BACKEND_API_BASE_URL,
  },
): string {
  if (runtime === "browser") {
    const publicPath = environment.NEXT_PUBLIC_API_BASE_URL?.trim() || "/backend-api";
    if (!publicPath.startsWith("/") || publicPath.startsWith("//")) {
      throw new Error("browser API base must be a relative same-origin path");
    }
    return publicPath.replace(/\/+$/, "") || "/";
  }
  const serverBase = environment.BACKEND_API_BASE_URL?.trim() || "http://localhost:8000";
  let parsed: URL;
  try {
    parsed = new URL(serverBase);
  } catch {
    throw new Error("server API base must be an absolute http(s) URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("server API base must be an absolute http(s) URL");
  }
  return serverBase.replace(/\/+$/, "");
}

const runtime = detectApiRuntime();
const baseUrl = resolveApiBaseUrl(runtime);

export const api = createClient<paths>({
  baseUrl,
  // 모듈 로드 시점에 globalThis.fetch를 붙잡지 않도록 감싼다.
  fetch: (request) => globalThis.fetch(request),
});

const mutationBaseUrl =
  runtime === "browser" ? "/api/backend" : "http://localhost/api/backend";

export const mutationApi = createClient<paths>({
  baseUrl: mutationBaseUrl,
  fetch: (request) => globalThis.fetch(request),
});
