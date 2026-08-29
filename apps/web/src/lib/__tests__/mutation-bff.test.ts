import { afterEach, describe, expect, it, vi } from "vitest";

import { createAsset } from "@/lib/adapters/assets";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("same-origin mutation boundary", () => {
  it("sends browser mutations to the BFF without an operator token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      asset_id: "asset_1",
      status: "UNVERIFIED",
      created_at: "2026-08-28T00:00:00Z",
      is_synthetic: true,
    }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await createAsset({
      name: "합성 자산",
      asset_type: "SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
      underlying_description: "fixture",
      total_planned_supply: 1,
      network: "KAIA_KAIROS",
      currency: "KRW",
      token_unit: "TOKEN",
      is_synthetic: true,
    });

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toBe("http://localhost/api/backend/v1/assets");
    expect(request.headers.get("authorization")).toBeNull();
  });
});
