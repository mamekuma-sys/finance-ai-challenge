export type AppErrorKind =
  | "not_found"
  | "conflict"
  | "unauthorized"
  | "validation"
  | "server"
  | "network"
  | "integrity"
  | "unavailable";

export interface AppErrorMetadata {
  resource?: string;
  requestedId?: string;
  operation?: string;
  code?: string;
}

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly status: number | null;
  readonly detail: unknown;
  readonly metadata: AppErrorMetadata;

  constructor(
    kind: AppErrorKind,
    status: number | null,
    detail?: unknown,
    metadata: AppErrorMetadata = {},
  ) {
    super(`API_${kind.toUpperCase()}`);
    this.name = "AppError";
    this.kind = kind;
    this.status = status;
    this.detail = detail;
    this.metadata = metadata;
  }
}

type ApiResult<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

function kindOf(status: number): AppErrorKind {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422) return "validation";
  if (status >= 500) return "server";
  return "unavailable";
}

function backendMetadata(detail: unknown): AppErrorMetadata {
  if (typeof detail !== "object" || detail === null || !("error" in detail)) return {};
  const error = detail.error;
  if (typeof error !== "object" || error === null) return {};
  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  const message =
    "message" in error && typeof error.message === "string" ? error.message : undefined;
  const resourceMatch = code?.match(/^(.+)_NOT_FOUND$/);
  const requestedMatch = message?.match(/:\s*([^\s]+)\s*$/);
  return {
    code,
    resource: resourceMatch?.[1]?.toLowerCase(),
    requestedId: requestedMatch?.[1],
  };
}

export async function apiRequest<T>(
  request: () => Promise<ApiResult<T>>,
  metadata: AppErrorMetadata = {},
): Promise<T> {
  let result: ApiResult<T>;

  try {
    result = await request();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("network", null, error, metadata);
  }

  if (result.data !== undefined && result.response.ok) return result.data;
  throw new AppError(kindOf(result.response.status), result.response.status, result.error, {
    ...metadata,
    ...backendMetadata(result.error),
  });
}

export function assertAssetId(expected: string, actual: string | null | undefined): void {
  if (actual !== expected) {
    throw new AppError(
      "integrity",
      409,
      { field: "asset_id", expected, actual },
      { resource: "asset", requestedId: expected },
    );
  }
}

export function assertIntegrity(
  field: string,
  expected: string,
  actual: string | null | undefined,
): void {
  if (actual !== expected) {
    throw new AppError("integrity", 409, { field, expected, actual }, { resource: field });
  }
}
