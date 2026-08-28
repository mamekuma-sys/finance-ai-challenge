import { mutationApi } from "@/lib/api-client";
import { apiRequest } from "@/lib/adapters/errors";
import type { components } from "@/types/generated/api";

export type DemoBootstrap = components["schemas"]["DemoBootstrapResponse"];

export function bootstrapDemo(): Promise<DemoBootstrap> {
  return apiRequest(() => mutationApi.POST("/v1/demo/bootstrap"));
}
