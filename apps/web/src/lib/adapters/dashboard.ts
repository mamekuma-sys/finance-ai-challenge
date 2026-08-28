import { api } from "@/lib/api-client";
import { apiRequest } from "@/lib/adapters/errors";
import type { components } from "@/types/generated/api";

export type Dashboard = components["schemas"]["DashboardResponse"];

export function getDashboard(): Promise<Dashboard> {
  return apiRequest(() => api.GET("/v1/dashboard"));
}
