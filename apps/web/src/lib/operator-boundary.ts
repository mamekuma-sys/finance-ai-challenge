import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { isIP } from "node:net";

export const OPERATOR_SESSION_COOKIE = "rwa_operator_session";
const SESSION_TTL_SECONDS = 30 * 60;
const OPERATOR_UNLOCK_MAX_BODY_BYTES = 1024;

export interface OperatorEnvironment {
  accessCode?: string;
  backendBaseUrl: string;
  backendOperatorToken?: string;
  nodeEnv: string;
  publicWebOrigin?: string;
  sessionSecret?: string;
  trustedClientIpHeader?: string;
  allowInsecureDemoOperator?: boolean;
  allowInsecureLocalSession?: boolean;
}

type Fetcher = (request: Request) => Promise<Response>;

export function operatorEnvironmentFromProcess(): OperatorEnvironment {
  return {
    accessCode: process.env.OPERATOR_ACCESS_CODE,
    backendBaseUrl: process.env.BACKEND_API_BASE_URL ?? "http://localhost:8000",
    backendOperatorToken: process.env.BACKEND_OPERATOR_TOKEN,
    nodeEnv: process.env.NODE_ENV ?? "development",
    publicWebOrigin: process.env.PUBLIC_WEB_ORIGIN,
    sessionSecret: process.env.OPERATOR_SESSION_SECRET,
    trustedClientIpHeader: process.env.TRUSTED_CLIENT_IP_HEADER,
    allowInsecureDemoOperator: process.env.ALLOW_INSECURE_DEMO_OPERATOR === "true",
    allowInsecureLocalSession: process.env.ALLOW_INSECURE_LOCAL_SESSION === "true",
  };
}

export function sessionCookiePolicy(
  environment: OperatorEnvironment,
): { valid: boolean; secure: boolean } {
  if (environment.nodeEnv !== "production") return { valid: true, secure: false };
  const configuredOrigin = environment.publicWebOrigin?.trim();
  if (!configuredOrigin) return { valid: false, secure: true };
  let parsed: URL;
  try {
    parsed = new URL(configuredOrigin);
  } catch {
    return { valid: false, secure: true };
  }
  const exactOrigin = parsed.origin === configuredOrigin;
  if (environment.allowInsecureLocalSession === true) {
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    return {
      valid: exactOrigin && parsed.protocol === "http:" && loopback && parsed.port === "3000",
      secure: false,
    };
  }
  return {
    valid: exactOrigin && parsed.protocol === "https:",
    secure: true,
  };
}

function trustedClientIpConfigured(environment: OperatorEnvironment): boolean {
  const header = environment.trustedClientIpHeader?.trim();
  if (header && /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(header)) return true;
  return environment.nodeEnv !== "production"
    && environment.allowInsecureDemoOperator === true
    && !header;
}

function configured(environment: OperatorEnvironment): boolean {
  return Boolean(
    isStrongAccessCode(environment.accessCode)
      && environment.backendOperatorToken
      && environment.sessionSecret
      && environment.sessionSecret.length >= 32
      && trustedClientIpConfigured(environment)
      && sessionCookiePolicy(environment).valid,
  );
}

export function isStrongAccessCode(value: string | undefined): boolean {
  return Boolean(
    value
      && value.length >= 20
      && value.length <= 256
      && /[A-Z]/.test(value)
      && /[a-z]/.test(value)
      && /[0-9]/.test(value)
      && /[^A-Za-z0-9]/.test(value),
  );
}

function canonicalClientIp(
  request: Request,
  environment: OperatorEnvironment,
): string | null {
  const configuredHeader = environment.trustedClientIpHeader?.trim().toLowerCase();
  let candidate: string;
  if (configuredHeader) {
    const supplied = request.headers.get(configuredHeader);
    if (!supplied || supplied.includes(",")) return null;
    candidate = supplied.trim();
  } else if (
    environment.nodeEnv !== "production"
    && environment.allowInsecureDemoOperator === true
  ) {
    candidate = "127.0.0.1";
  } else {
    return null;
  }
  const version = isIP(candidate);
  if (version === 4) {
    return candidate.split(".").map((part) => String(Number(part))).join(".");
  }
  if (version === 6) {
    return new URL(`http://[${candidate}]/`).hostname.slice(1, -1).toLowerCase();
  }
  return null;
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function createSessionToken(
  secret: string,
  nowSeconds: number,
  ttlSeconds = SESSION_TTL_SECONDS,
): string {
  const payload = `${Math.floor(nowSeconds + ttlSeconds)}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  nowSeconds: number,
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiresText, nonce, suppliedSignature] = parts;
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires < nowSeconds || !nonce || !suppliedSignature) {
    return false;
  }
  const payload = `${expiresText}.${nonce}`;
  let supplied: Buffer;
  try {
    supplied = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return false;
  }
  const expected = signature(payload, secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function cookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  for (const item of cookie.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

function canonicalRequestOrigin(request: Request): string | null {
  const host = request.headers.get("host");
  if (!host) return null;
  try {
    const forwardedProto = request.headers.get("x-forwarded-proto");
    let requestProtocol: "http:" | "https:";
    if (forwardedProto !== null) {
      const candidate = forwardedProto.trim();
      if (candidate.includes(",") || (candidate !== "http" && candidate !== "https")) {
        return null;
      }
      requestProtocol = `${candidate}:`;
    } else {
      const protocol = new URL(request.url).protocol;
      if (protocol !== "http:" && protocol !== "https:") return null;
      requestProtocol = protocol;
    }
    return new URL(`${requestProtocol}//${host}`).origin;
  } catch {
    return null;
  }
}

function publicOriginMatchesRequest(
  request: Request,
  environment: OperatorEnvironment,
): boolean {
  if (environment.nodeEnv !== "production") return true;
  return environment.publicWebOrigin === canonicalRequestOrigin(request);
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const requestOrigin = canonicalRequestOrigin(request);
    return requestOrigin !== null && parsed.origin === requestOrigin;
  } catch {
    return false;
  }
}

const ALLOWED_MUTATIONS: ReadonlyArray<{
  method: "POST" | "PATCH";
  path: RegExp;
}> = [
  { method: "POST", path: /^v1\/demo\/bootstrap$/ },
  { method: "POST", path: /^v1\/assets$/ },
  { method: "POST", path: /^v1\/assets\/[^/]+\/(?:documents|contracts|scans)$/ },
  { method: "PATCH", path: /^v1\/assets\/[^/]+\/policies$/ },
  { method: "PATCH", path: /^v1\/alerts\/[^/]+$/ },
];

export function isAllowedMutation(method: string, path: string[]): boolean {
  if (path.some((part) => !part || part === "." || part === ".." || part.includes("/"))) {
    return false;
  }
  const joined = path.join("/");
  return ALLOWED_MUTATIONS.some((rule) => rule.method === method && rule.path.test(joined));
}

function jsonError(status: number, code: string, detail: string): Response {
  return Response.json({ error: { code, detail } }, { status });
}

export async function handleOperatorSession(
  request: Request,
  environment: OperatorEnvironment,
  nowSeconds = Date.now() / 1_000,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonError(403, "ORIGIN_REJECTED", "동일 출처 요청만 허용됩니다.");
  }
  const cookiePolicy = sessionCookiePolicy(environment);
  if (!cookiePolicy.valid || !publicOriginMatchesRequest(request, environment)) {
    return jsonError(503, "OPERATOR_SESSION_NOT_CONFIGURED", "검토자 세션이 구성되지 않았습니다.");
  }
  if (request.method === "DELETE") {
    const secure = cookiePolicy.secure ? "; Secure" : "";
    return new Response(null, {
      status: 204,
      headers: {
        "set-cookie":
          `${OPERATOR_SESSION_COOKIE}=; HttpOnly; Path=/; `
          + `Max-Age=0; SameSite=Strict${secure}`,
      },
    });
  }
  if (request.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "허용되지 않은 요청 방식입니다.");
  }
  if (!configured(environment)) {
    return jsonError(503, "OPERATOR_SESSION_NOT_CONFIGURED", "검토자 세션이 구성되지 않았습니다.");
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsed = Number(declaredLength);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      return jsonError(400, "INVALID_SESSION_REQUEST", "접근 코드를 확인하세요.");
    }
    if (parsed > OPERATOR_UNLOCK_MAX_BODY_BYTES) {
      return jsonError(413, "SESSION_REQUEST_TOO_LARGE", "요청을 처리할 수 없습니다.");
    }
  }
  let raw: ArrayBuffer;
  try {
    raw = await request.arrayBuffer();
  } catch {
    return jsonError(400, "INVALID_SESSION_REQUEST", "접근 코드를 확인하세요.");
  }
  if (raw.byteLength > OPERATOR_UNLOCK_MAX_BODY_BYTES) {
    return jsonError(413, "SESSION_REQUEST_TOO_LARGE", "요청을 처리할 수 없습니다.");
  }
  let accessCode = "";
  try {
    const body = JSON.parse(new TextDecoder().decode(raw)) as { access_code?: unknown };
    if (typeof body.access_code === "string") accessCode = body.access_code;
  } catch {
    return jsonError(400, "INVALID_SESSION_REQUEST", "접근 코드를 확인하세요.");
  }
  if (!accessCode || accessCode.length > 256) {
    return jsonError(400, "INVALID_SESSION_REQUEST", "접근 코드를 확인하세요.");
  }

  const clientAddress = canonicalClientIp(request, environment);
  if (clientAddress === null) {
    return jsonError(400, "INVALID_CLIENT_IP", "클라이언트 주소를 확인할 수 없습니다.");
  }
  const fingerprint = `fp_${createHmac("sha256", environment.sessionSecret!)
    .update(clientAddress)
    .digest("hex")}`;
  let verification: Response;
  try {
    verification = await fetcher(new Request(
      new URL("/v1/operator/session/verify", environment.backendBaseUrl),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${environment.backendOperatorToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ fingerprint, access_code: accessCode }),
      },
    ));
  } catch {
    return jsonError(503, "OPERATOR_VERIFY_UNAVAILABLE", "검토자 확인을 완료할 수 없습니다.");
  }
  if (verification.status === 429) {
    return jsonError(429, "OPERATOR_VERIFY_RATE_LIMITED", "잠시 후 다시 시도하세요.");
  }
  if (verification.status === 503) {
    return jsonError(503, "OPERATOR_VERIFY_UNAVAILABLE", "검토자 확인을 완료할 수 없습니다.");
  }
  if (verification.status === 401 || verification.status === 403) {
    return jsonError(401, "INVALID_ACCESS_CODE", "접근 코드를 확인하세요.");
  }
  if (verification.status !== 200) {
    return jsonError(503, "OPERATOR_VERIFY_UNAVAILABLE", "검토자 확인을 완료할 수 없습니다.");
  }
  try {
    const result = await verification.json() as { verified?: unknown };
    if (result.verified !== true) {
      return jsonError(503, "OPERATOR_VERIFY_UNAVAILABLE", "검토자 확인을 완료할 수 없습니다.");
    }
  } catch {
    return jsonError(503, "OPERATOR_VERIFY_UNAVAILABLE", "검토자 확인을 완료할 수 없습니다.");
  }
  const token = createSessionToken(environment.sessionSecret!, nowSeconds);
  const secure = cookiePolicy.secure ? "; Secure" : "";
  return new Response(null, {
    status: 204,
    headers: {
      "set-cookie":
        `${OPERATOR_SESSION_COOKIE}=${token}; HttpOnly; Path=/; `
        + `Max-Age=${SESSION_TTL_SECONDS}; SameSite=Strict${secure}`,
    },
  });
}

export async function handleMutationProxy(
  request: Request,
  path: string[],
  environment: OperatorEnvironment,
  fetcher: Fetcher = fetch,
  nowSeconds = Date.now() / 1_000,
): Promise<Response> {
  if (!configured(environment) || !publicOriginMatchesRequest(request, environment)) {
    return jsonError(503, "OPERATOR_SESSION_NOT_CONFIGURED", "검토자 세션이 구성되지 않았습니다.");
  }
  if (!isSameOrigin(request)) {
    return jsonError(403, "ORIGIN_REJECTED", "동일 출처 요청만 허용됩니다.");
  }
  if (!isAllowedMutation(request.method, path)) {
    return jsonError(404, "MUTATION_NOT_ALLOWED", "허용되지 않은 변경 요청입니다.");
  }
  const token = cookieValue(request, OPERATOR_SESSION_COOKIE);
  if (!verifySessionToken(token, environment.sessionSecret!, nowSeconds)) {
    return jsonError(401, "OPERATOR_SESSION_REQUIRED", "검토자 잠금 해제가 필요합니다.");
  }

  const incomingUrl = new URL(request.url);
  const target = new URL(`/${path.map(encodeURIComponent).join("/")}`, environment.backendBaseUrl);
  target.search = incomingUrl.search;
  const headers = new Headers({ Authorization: `Bearer ${environment.backendOperatorToken}` });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const body = await request.arrayBuffer();
  try {
    const backend = await fetcher(new Request(target, {
      method: request.method,
      headers,
      body: body.byteLength ? body : undefined,
    }));
    const responseHeaders = new Headers();
    for (const name of ["content-type", "content-disposition"]) {
      const value = backend.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(await backend.arrayBuffer(), {
      status: backend.status,
      headers: responseHeaders,
    });
  } catch {
    return jsonError(502, "BACKEND_UNAVAILABLE", "변경 요청을 전달하지 못했습니다.");
  }
}

export async function handleReadiness(
  request: Request,
  environment: OperatorEnvironment,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const serverConfigured = configured(environment)
    && publicOriginMatchesRequest(request, environment);
  const sessionActive =
    Boolean(environment.sessionSecret)
    && verifySessionToken(
      cookieValue(request, OPERATOR_SESSION_COOKIE),
      environment.sessionSecret!,
      Date.now() / 1_000,
    );
  if (!serverConfigured) {
    return Response.json({
      ready: false,
      server_configured: false,
      backend_operator: false,
      worker_ready: false,
      session_active: sessionActive,
    });
  }
  let backendOperator = false;
  let workerReady = false;
  try {
    const response = await fetcher(new Request(
      new URL("/health/operator", environment.backendBaseUrl),
      {
        headers: { Authorization: `Bearer ${environment.backendOperatorToken}` },
        cache: "no-store",
      },
    ));
    backendOperator = response.ok;
    if (backendOperator) {
      const readiness = await fetcher(new Request(
        new URL("/health/ready", environment.backendBaseUrl),
        {
          headers: { Authorization: `Bearer ${environment.backendOperatorToken}` },
          cache: "no-store",
        },
      ));
      workerReady = readiness.ok;
    }
  } catch {
    backendOperator = false;
    workerReady = false;
  }
  return Response.json({
    ready: serverConfigured && backendOperator && workerReady,
    server_configured: serverConfigured,
    backend_operator: backendOperator,
    worker_ready: workerReady,
    session_active: sessionActive,
  });
}
