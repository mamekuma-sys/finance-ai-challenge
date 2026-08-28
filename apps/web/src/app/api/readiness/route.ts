import "server-only";

import {
  handleReadiness,
  operatorEnvironmentFromProcess,
} from "@/lib/operator-boundary";

export function GET(request: Request): Promise<Response> {
  return handleReadiness(request, operatorEnvironmentFromProcess());
}
