import "server-only";

import {
  handleOperatorSession,
  operatorEnvironmentFromProcess,
} from "@/lib/operator-boundary";

export function POST(request: Request): Promise<Response> {
  return handleOperatorSession(request, operatorEnvironmentFromProcess());
}

export function DELETE(request: Request): Promise<Response> {
  return handleOperatorSession(request, operatorEnvironmentFromProcess());
}
