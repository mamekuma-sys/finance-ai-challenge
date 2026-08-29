import "server-only";

import {
  handleMutationProxy,
  operatorEnvironmentFromProcess,
} from "@/lib/operator-boundary";

async function forwardMutation(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  return handleMutationProxy(request, path, operatorEnvironmentFromProcess());
}

export const POST = forwardMutation;
export const PATCH = forwardMutation;
