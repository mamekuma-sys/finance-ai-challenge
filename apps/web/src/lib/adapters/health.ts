import { api } from "@/lib/api-client";
import { apiRequest, AppError } from "@/lib/adapters/errors";
import type { components } from "@/types/generated/api";

export type Health = components["schemas"]["HealthResponse"];
export interface Readiness {
  ready: boolean;
  server_configured: boolean;
  backend_operator: boolean;
  session_active: boolean;
}

export function getHealth(): Promise<Health> {
  return apiRequest(() => api.GET("/health"));
}

export function getReadiness(): Promise<Readiness> {
  return getOperatorReadiness();
}

export async function getOperatorReadiness(): Promise<Readiness> {
  try {
    const response = await fetch("/api/readiness", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new AppError("server", response.status);
    return await response.json() as Readiness;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("network", null);
  }
}

export async function unlockOperator(accessCode: string): Promise<void> {
  const response = await fetch("/api/operator/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ access_code: accessCode }),
  });
  if (!response.ok) {
    throw new AppError(
      response.status === 401 || response.status === 403 ? "unauthorized" : "server",
      response.status,
    );
  }
}

export async function logoutOperator(): Promise<void> {
  const response = await fetch("/api/operator/session", {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) throw new AppError("server", response.status);
}
