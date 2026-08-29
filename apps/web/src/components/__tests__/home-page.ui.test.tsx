import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { SUBMISSION_DEMO } from "@/lib/submission-demo";

const mocks = vi.hoisted(() => ({
  bootstrapDemo: vi.fn(),
  getDashboard: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/lib/adapters/dashboard", () => ({ getDashboard: mocks.getDashboard }));
vi.mock("@/lib/adapters/demo", () => ({ bootstrapDemo: mocks.bootstrapDemo }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDashboard.mockResolvedValue({
    assets: [],
    critical_assets: 0,
    high_assets: 0,
    is_synthetic: true,
    recent_alerts: [],
    total_assets: 0,
  });
  mocks.bootstrapDemo.mockResolvedValue({
    asset_id: SUBMISSION_DEMO.assetId,
    contract_id: "contract_demo_vulnerable_01",
    document_id: "doc_synthetic_issuance_01",
    evidence_mode: "REPLAY",
    fixture_version: "0.1.0",
    is_synthetic: true,
    report_id: SUBMISSION_DEMO.reportId,
    scan_id: SUBMISSION_DEMO.scanId,
  });
});

afterEach(cleanup);

describe("submission home empty state", () => {
  it("keeps sample start available on a clean database and enters the canonical scan", async () => {
    const user = userEvent.setup();
    const view = render(await HomePage({ searchParams: Promise.resolve({}) }));

    expect(view.getByText("등록된 자산이 없습니다.")).toBeInTheDocument();
    await user.click(view.getByRole("button", { name: "샘플 검증 시작" }));

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith(
        `/assets/${SUBMISSION_DEMO.assetId}/scan?scan=${SUBMISSION_DEMO.scanId}`,
      );
    });
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
