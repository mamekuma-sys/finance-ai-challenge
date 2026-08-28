import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  createSessionToken,
  handleMutationProxy,
  handleOperatorSession,
  handleReadiness,
  isAllowedMutation,
  isSameOrigin,
  operatorEnvironmentFromProcess,
  sessionCookiePolicy,
  verifySessionToken,
  type OperatorEnvironment,
} from "@/lib/operator-boundary";

const environment: OperatorEnvironment = {
  accessCode: "Strong-Operator-Code-2026!",
  backendBaseUrl: "http://backend:8000",
  backendOperatorToken: "backend-secret",
  nodeEnv: "test",
  publicWebOrigin: "https://rwa.example",
  sessionSecret: "s".repeat(32),
  trustedClientIpHeader: "x-real-ip",
};

const sameOriginHeaders = {
  Host: "rwa.example",
  Origin: "https://rwa.example",
  "x-real-ip": "192.0.2.10",
};

function proxiedUnlockRequest({
  clientIp,
  host = "rwa.example",
  origin = "https://rwa.example",
}: {
  clientIp: string;
  host?: string;
  origin?: string;
}) {
  return new Request("http://web:3000/api/operator/session", {
    method: "POST",
    headers: {
      Host: host,
      Origin: origin,
      "x-real-ip": clientIp,
      "x-forwarded-for": "203.0.113.250",
      "x-forwarded-proto": "https",
      "content-type": "application/json",
    },
    body: JSON.stringify({ access_code: environment.accessCode }),
  });
}

describe("operator session boundary", () => {
  it("reads the explicitly named local-session exception flag", () => {
    vi.stubEnv("ALLOW_INSECURE_LOCAL_SESSION", "true");
    vi.stubEnv("ALLOW_INSECURE_LOCAL_HTTP", "false");

    expect(operatorEnvironmentFromProcess().allowInsecureLocalSession).toBe(true);

    vi.unstubAllEnvs();
  });

  it("requires canonical request scheme to match Origin", () => {
    const request = (url: string, origin: string, forwardedProto?: string) => new Request(url, {
      headers: {
        Host: "rwa.example",
        Origin: origin,
        ...(forwardedProto ? { "x-forwarded-proto": forwardedProto } : {}),
      },
    });

    expect(isSameOrigin(request(
      "http://web:3000/api/operator/session",
      "https://rwa.example",
      "https",
    ))).toBe(true);
    expect(isSameOrigin(request(
      "http://web:3000/api/operator/session",
      "http://rwa.example",
      "https",
    ))).toBe(false);
    expect(isSameOrigin(request(
      "https://rwa.example/api/operator/session",
      "http://rwa.example",
    ))).toBe(false);
    expect(isSameOrigin(request(
      "http://rwa.example/api/operator/session",
      "https://rwa.example",
    ))).toBe(false);
    expect(isSameOrigin(request(
      "http://web:3000/api/operator/session",
      "https://rwa.example",
      "https,http",
    ))).toBe(false);
    expect(isSameOrigin(request(
      "http://web:3000/api/operator/session",
      "https://rwa.example",
      "ftp",
    ))).toBe(false);
  });

  it("accepts proxy-preserved Origin/Host and fingerprints only overwritten remote IP", async () => {
    const backend = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ verified: true }), { status: 200 }),
    );
    const production = { ...environment, nodeEnv: "production" };

    const accepted = await handleOperatorSession(
      proxiedUnlockRequest({ clientIp: "192.0.2.44" }),
      production,
      1_000,
      backend,
    );

    expect(accepted.status).toBe(204);
    const payload = await (backend.mock.calls[0][0] as Request).json() as {
      fingerprint: string;
    };
    const expected = createHmac("sha256", production.sessionSecret!)
      .update("192.0.2.44")
      .digest("hex");
    expect(payload.fingerprint).toBe(`fp_${expected}`);

    const rejected = await handleOperatorSession(
      proxiedUnlockRequest({
        clientIp: "192.0.2.44",
        origin: "https://evil.example",
      }),
      production,
      1_000,
      backend,
    );
    expect(rejected.status).toBe(403);
    expect(backend).toHaveBeenCalledTimes(1);
  });

  it("issues a signed strict HttpOnly session only for the access code", async () => {
    const verifier = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ verified: true }), { status: 200 }));
    const rejected = await handleOperatorSession(
      new Request("https://rwa.example/api/operator/session", {
        method: "POST",
        headers: { ...sameOriginHeaders, "content-type": "application/json" },
        body: JSON.stringify({ access_code: "wrong" }),
      }),
      environment,
      1_000,
      verifier,
    );
    expect(rejected.status).toBe(401);
    expect(rejected.headers.get("set-cookie")).toBeNull();
    const crossOrigin = await handleOperatorSession(
      new Request("https://rwa.example/api/operator/session", {
        method: "POST",
        headers: {
          ...sameOriginHeaders,
          Origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ access_code: environment.accessCode }),
      }),
      environment,
      1_000,
      verifier,
    );
    expect(crossOrigin.status).toBe(403);

    const accepted = await handleOperatorSession(
      new Request("https://rwa.example/api/operator/session", {
        method: "POST",
        headers: { ...sameOriginHeaders, "content-type": "application/json" },
        body: JSON.stringify({ access_code: environment.accessCode }),
      }),
      environment,
      1_000,
      verifier,
    );
    const cookie = accepted.headers.get("set-cookie")!;
    expect(accepted.status).toBe(204);
    expect(cookie).toContain("rwa_operator_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).not.toContain(environment.accessCode);
    expect(cookie).not.toContain(environment.backendOperatorToken);
    const forwarded = verifier.mock.calls[1][0] as Request;
    const payload = await forwarded.json() as Record<string, string>;
    expect(forwarded.headers.get("authorization")).toBe("Bearer backend-secret");
    expect(payload.fingerprint).toMatch(/^fp_[0-9a-f]{64}$/);
    expect(JSON.stringify(payload)).not.toContain("rwa.example");
    expect(JSON.stringify(payload)).not.toContain("Mozilla");
  });

  it("rejects expired or tampered signed sessions", () => {
    const token = createSessionToken(environment.sessionSecret!, 1_000, 60);
    expect(verifySessionToken(token, environment.sessionSecret!, 1_059)).toBe(true);
    expect(verifySessionToken(token, environment.sessionSecret!, 1_061)).toBe(false);
    expect(verifySessionToken(`${token}x`, environment.sessionSecret!, 1_001)).toBe(false);
  });

  it("uses Secure in production and clears the cookie on same-origin logout", async () => {
    const login = await handleOperatorSession(
      new Request("https://rwa.example/api/operator/session", {
        method: "POST",
        headers: { ...sameOriginHeaders, "content-type": "application/json" },
        body: JSON.stringify({ access_code: environment.accessCode }),
      }),
      { ...environment, nodeEnv: "production" },
      1_000,
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ verified: true }), { status: 200 }),
      ),
    );
    expect(login.headers.get("set-cookie")).toContain("Secure");

    const logout = await handleOperatorSession(
      new Request("https://rwa.example/api/operator/session", {
        method: "DELETE",
        headers: sameOriginHeaders,
      }),
      { ...environment, nodeEnv: "production" },
    );
    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(logout.headers.get("set-cookie")).toContain("Secure");
  });

  it("allows insecure cookies only for explicit exact loopback HTTP origin", async () => {
    const local = {
      ...environment,
      nodeEnv: "production",
      publicWebOrigin: "http://localhost:3000",
      allowInsecureLocalSession: true,
    };
    expect(sessionCookiePolicy(local)).toEqual({ valid: true, secure: false });
    expect(sessionCookiePolicy({
      ...local,
      publicWebOrigin: "http://127.0.0.1:3000",
    })).toEqual({ valid: true, secure: false });
    expect(sessionCookiePolicy({
      ...local,
      publicWebOrigin: "http://[::1]:3000",
    })).toEqual({ valid: true, secure: false });

    const login = await handleOperatorSession(
      new Request("http://localhost:3000/api/operator/session", {
        method: "POST",
        headers: {
          Host: "localhost:3000",
          Origin: "http://localhost:3000",
          "x-forwarded-proto": "http",
          "x-real-ip": "127.0.0.1",
          "content-type": "application/json",
        },
        body: JSON.stringify({ access_code: environment.accessCode }),
      }),
      local,
      1_000,
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ verified: true }), { status: 200 }),
      ),
    );
    expect(login.status).toBe(204);
    expect(login.headers.get("set-cookie")).not.toContain("Secure");

    const ready = await handleReadiness(
      new Request("http://localhost:3000/api/readiness", {
        headers: {
          Host: "localhost:3000",
          "x-forwarded-proto": "http",
        },
      }),
      local,
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );
    expect(await ready.json()).toMatchObject({ ready: true, server_configured: true });
  });

  it.each([
    "http://rwa.example:3000",
    "https://localhost:3000",
    "http://localhost:3000/path",
    "http://user@localhost:3000",
    "http://localhost:99999",
  ])("rejects insecure local HTTP exception for %s", async (publicWebOrigin) => {
    const invalid = {
      ...environment,
      nodeEnv: "production",
      publicWebOrigin,
      allowInsecureLocalSession: true,
    };
    expect(sessionCookiePolicy(invalid).valid).toBe(false);
    const backend = vi.fn();
    const ready = await handleReadiness(
      new Request("http://localhost:3000/api/readiness", {
        headers: { Host: "localhost:3000", "x-forwarded-proto": "http" },
      }),
      invalid,
      backend,
    );
    expect(await ready.json()).toMatchObject({ ready: false, server_configured: false });
    expect(backend).not.toHaveBeenCalled();
  });

  it("rejects readiness when forwarded host differs from configured loopback origin", async () => {
    const backend = vi.fn();
    const ready = await handleReadiness(
      new Request("http://web:3000/api/readiness", {
        headers: {
          Host: "attacker.example",
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-proto": "http",
        },
      }),
      {
        ...environment,
        nodeEnv: "production",
        publicWebOrigin: "http://localhost:3000",
        allowInsecureLocalSession: true,
      },
      backend,
    );
    expect(await ready.json()).toMatchObject({ ready: false, server_configured: false });
    expect(backend).not.toHaveBeenCalled();
  });

  it("requires session and same-origin before injecting the backend token", async () => {
    const token = createSessionToken(environment.sessionSecret!, 1_000, 60);
    const backend = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const request = (origin = "https://rwa.example") =>
      new Request("https://rwa.example/api/backend/v1/assets", {
        method: "POST",
        headers: {
          ...sameOriginHeaders,
          Origin: origin,
          Cookie: `rwa_operator_session=${token}`,
          "content-type": "application/json",
        },
        body: "{}",
      });
    const allowed = await handleMutationProxy(
      request(),
      ["v1", "assets"],
      environment,
      backend,
      1_001,
    );
    expect(allowed.status).toBe(200);
    const forwarded = backend.mock.calls[0][0] as Request;
    expect(forwarded.headers.get("authorization")).toBe("Bearer backend-secret");

    const crossOrigin = await handleMutationProxy(
      request("https://evil.example"),
      ["v1", "assets"],
      environment,
      backend,
      1_001,
    );
    expect(crossOrigin.status).toBe(403);

    const expired = await handleMutationProxy(
      request(),
      ["v1", "assets"],
      environment,
      backend,
      2_000,
    );
    expect(expired.status).toBe(401);
  });

  it("allows only the explicit mutation method and path matrix", () => {
    expect(isAllowedMutation("POST", ["v1", "assets"])).toBe(true);
    expect(isAllowedMutation("PATCH", ["v1", "alerts", "alert_1"])).toBe(true);
    expect(isAllowedMutation("GET", ["v1", "assets"])).toBe(false);
    expect(isAllowedMutation("POST", ["health", "operator"])).toBe(false);
    expect(isAllowedMutation("POST", ["v1", "assets", "..", "alerts"])).toBe(false);
  });

  it("reports composite readiness false for missing or rejected operator config", async () => {
    const request = new Request("https://rwa.example/api/readiness", {
      headers: { Host: "rwa.example" },
    });
    const noFetch = vi.fn();
    const missing = await handleReadiness(
      request,
      { ...environment, sessionSecret: undefined },
      noFetch,
    );
    expect(await missing.json()).toMatchObject({ ready: false, server_configured: false });
    expect(noFetch).not.toHaveBeenCalled();

    const weak = await handleReadiness(
      request,
      { ...environment, accessCode: "weak" },
      noFetch,
    );
    expect(await weak.json()).toMatchObject({ ready: false, server_configured: false });
    expect(noFetch).not.toHaveBeenCalled();

    const rejected = await handleReadiness(
      request,
      environment,
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    expect(await rejected.json()).toMatchObject({
      ready: false,
      server_configured: true,
      backend_operator: false,
    });

    const readinessFetch = vi.fn().mockImplementation((backendRequest: Request) => (
      Promise.resolve(new Response(
        JSON.stringify({ ready: !backendRequest.url.endsWith("/health/ready") }),
        { status: backendRequest.url.endsWith("/health/ready") ? 503 : 200 },
      ))
    ));
    const workerUnavailable = await handleReadiness(
      request,
      environment,
      readinessFetch,
    );
    expect(await workerUnavailable.json()).toMatchObject({
      ready: false,
      backend_operator: true,
      worker_ready: false,
    });
    expect(readinessFetch).toHaveBeenCalledTimes(2);

    const ready = await handleReadiness(
      request,
      environment,
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ready: true }), { status: 200 })),
    );
    expect(await ready.json()).toMatchObject({
      ready: true,
      server_configured: true,
      backend_operator: true,
      worker_ready: true,
    });
  });

  it("rejects oversized unlock bodies before backend verification", async () => {
    const backend = vi.fn();
    const response = await handleOperatorSession(
      new Request("https://rwa.example/api/operator/session", {
        method: "POST",
        headers: { ...sameOriginHeaders, "content-type": "application/json" },
        body: JSON.stringify({ access_code: "x".repeat(2_000) }),
      }),
      environment,
      1_000,
      backend,
    );
    expect(response.status).toBe(413);
    expect(backend).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("x".repeat(20));
  });

  it("uses only canonical trusted IP so UA changes keep one fingerprint", async () => {
    const forwarded: Array<Record<string, string>> = [];
    const backend = vi.fn(async (request: Request) => {
      forwarded.push(await request.json() as Record<string, string>);
      return new Response(JSON.stringify({ verified: true }), { status: 200 });
    });
    const unlock = (ip: string, userAgent: string) => handleOperatorSession(
      new Request("https://rwa.example/api/operator/session", {
        method: "POST",
        headers: {
          ...sameOriginHeaders,
          "x-real-ip": ip,
          "user-agent": userAgent,
          "content-type": "application/json",
        },
        body: JSON.stringify({ access_code: environment.accessCode }),
      }),
      environment,
      1_000,
      backend,
    );

    expect((await unlock("2001:0db8::1", "browser-a")).status).toBe(204);
    expect((await unlock("2001:db8:0:0::1", "browser-b")).status).toBe(204);
    expect((await unlock("2001:db8::2", "browser-a")).status).toBe(204);
    expect(forwarded[0].fingerprint).toBe(forwarded[1].fingerprint);
    expect(forwarded[2].fingerprint).not.toBe(forwarded[0].fingerprint);
    expect(JSON.stringify(forwarded)).not.toContain("browser-");
  });

  it.each([
    ["missing", undefined],
    ["multiple", "192.0.2.10, 192.0.2.11"],
    ["invalid", "not-an-ip"],
  ])("rejects %s trusted client IP", async (_case, value) => {
    const headers = new Headers({
      Host: "rwa.example",
      Origin: "https://rwa.example",
      "content-type": "application/json",
    });
    if (value) headers.set("x-real-ip", value);
    const backend = vi.fn();
    const response = await handleOperatorSession(
      new Request("https://rwa.example/api/operator/session", {
        method: "POST",
        headers,
        body: JSON.stringify({ access_code: environment.accessCode }),
      }),
      environment,
      1_000,
      backend,
    );
    expect(response.status).toBe(400);
    expect(backend).not.toHaveBeenCalled();
  });

  it("requires trusted IP configuration in production readiness", async () => {
    const backend = vi.fn();
    const response = await handleReadiness(
      new Request("https://rwa.example/api/readiness"),
      { ...environment, nodeEnv: "production", trustedClientIpHeader: undefined },
      backend,
    );
    expect(await response.json()).toMatchObject({
      ready: false,
      server_configured: false,
    });
    expect(backend).not.toHaveBeenCalled();
  });

  it("refuses production login when trusted IP header is not configured", async () => {
    const backend = vi.fn();
    const response = await handleOperatorSession(
      new Request("https://rwa.example/api/operator/session", {
        method: "POST",
        headers: {
          Host: "rwa.example",
          Origin: "https://rwa.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ access_code: environment.accessCode }),
      }),
      { ...environment, nodeEnv: "production", trustedClientIpHeader: undefined },
      1_000,
      backend,
    );
    expect(response.status).toBe(503);
    expect(backend).not.toHaveBeenCalled();
  });

  it("allows loopback fallback only for explicit insecure demo mode", async () => {
    const backend = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ verified: true }), { status: 200 }),
    );
    const response = await handleOperatorSession(
      new Request("https://rwa.example/api/operator/session", {
        method: "POST",
        headers: {
          Host: "rwa.example",
          Origin: "https://rwa.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ access_code: environment.accessCode }),
      }),
      {
        ...environment,
        nodeEnv: "test",
        trustedClientIpHeader: undefined,
        allowInsecureDemoOperator: true,
      },
      1_000,
      backend,
    );
    expect(response.status).toBe(204);
    const forwarded = backend.mock.calls[0][0] as Request;
    const payload = await forwarded.json() as Record<string, string>;
    expect(payload.fingerprint).toMatch(/^fp_[0-9a-f]{64}$/);
  });

  it("maps backend verification failures to service unavailable", async () => {
    const response = await handleOperatorSession(
      new Request("https://rwa.example/api/operator/session", {
        method: "POST",
        headers: { ...sameOriginHeaders, "content-type": "application/json" },
        body: JSON.stringify({ access_code: environment.accessCode }),
      }),
      environment,
      1_000,
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "OPERATOR_VERIFY_UNAVAILABLE" },
    });
  });
});
