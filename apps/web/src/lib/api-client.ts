/**
 * 생성된 OpenAPI 타입만 사용하는 API client.
 *
 * 경로와 응답 형태가 `src/types/api.ts`에 고정돼 있어, backend 계약이 바뀌면
 * `npm run gen:api` 이후 `npm run typecheck`에서 소비처가 먼저 깨진다.
 */
import createClient from "openapi-fetch";

import type { paths } from "@/types/api";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const api = createClient<paths>({
  baseUrl,
  // createClient가 globalThis.fetch를 생성 시점에 붙잡지 않도록 감싼다.
  // 모듈 최상위에서 한 번 캡처되면 런타임에 교체된 fetch를 쓰지 못한다.
  fetch: (request) => globalThis.fetch(request),
});
