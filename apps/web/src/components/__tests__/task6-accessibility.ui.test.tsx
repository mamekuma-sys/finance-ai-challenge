import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AlertReviewForm } from "@/components/alert-review-form";
import { OperatorUnlockDialog } from "@/components/operator-unlock-dialog";
import { AppError } from "@/lib/adapters/errors";

const { updateAlert } = vi.hoisted(() => ({ updateAlert: vi.fn() }));
const operator = vi.hoisted(() => ({
  getOperatorReadiness: vi.fn(),
  unlockOperator: vi.fn(),
  logoutOperator: vi.fn(),
}));
vi.mock("@/lib/adapters/alerts", () => ({ updateAlert, listAlerts: vi.fn() }));
vi.mock("@/lib/adapters/health", () => operator);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Task6 accessible mutations", () => {
  it("unlocks the operator session by keyboard without exposing secrets", async () => {
    operator.getOperatorReadiness
      .mockResolvedValueOnce({
        ready: true,
        server_configured: true,
        backend_operator: true,
        session_active: false,
      })
      .mockResolvedValueOnce({
        ready: true,
        server_configured: true,
        backend_operator: true,
        session_active: true,
      });
    operator.unlockOperator.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const view = render(<OperatorUnlockDialog />);

    await user.click(await view.findByRole("button", { name: "검토자 잠금 해제" }));
    await user.type(view.getByLabelText("Operator access code"), "local-code");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(operator.unlockOperator).toHaveBeenCalledWith("local-code"));
    expect(await view.findByText("검토자 세션 활성")).toBeInTheDocument();
    expect(view.queryByDisplayValue("local-code")).not.toBeInTheDocument();
  });

  it("presents a safe action after an invalid access code", async () => {
    operator.getOperatorReadiness.mockResolvedValue({
      ready: true,
      server_configured: true,
      backend_operator: true,
      session_active: false,
    });
    operator.unlockOperator.mockRejectedValue(new AppError("unauthorized", 401));
    const user = userEvent.setup();
    const view = render(<OperatorUnlockDialog />);
    await user.click(await view.findByRole("button", { name: "검토자 잠금 해제" }));
    await user.type(view.getByLabelText("Operator access code"), "wrong");
    await user.keyboard("{Enter}");
    expect(await view.findByRole("alert")).toHaveTextContent("접근 코드를 확인하세요.");
  });

  it("updates an alert by keyboard and announces completion", async () => {
    const user = userEvent.setup();
    updateAlert.mockResolvedValue({
      alert_id: "alert",
      asset_id: "asset",
      status: "ACKNOWLEDGED",
      memo: "근거 확인 중",
      updated_at: "2026-08-28T01:00:00Z",
    });
    const view = render(
      <AlertReviewForm
        alertId="alert"
        assetId="asset"
        initialStatus="NEW"
        initialUpdatedAt="2026-08-28T00:00:00Z"
      />,
    );

    await user.selectOptions(view.getByLabelText("경보 상태"), "ACKNOWLEDGED");
    await user.type(view.getByLabelText("검토 메모"), "근거 확인 중");
    view.getByLabelText("검토 메모").focus();
    await user.tab();
    expect(view.getByRole("button", { name: "변경 저장" })).toHaveFocus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(updateAlert).toHaveBeenCalledWith(
      "alert",
      expect.objectContaining({
        status: "ACKNOWLEDGED",
        memo: "근거 확인 중",
        expected_updated_at: "2026-08-28T00:00:00Z",
      }),
      "asset",
    ));
    expect(view.getByText("경보 검토 내용이 저장됐습니다.")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("has no serious or critical axe violations", async () => {
    const view = render(
      <AlertReviewForm
        alertId="alert"
        assetId="asset"
        initialStatus="NEW"
        initialUpdatedAt="2026-08-28T00:00:00Z"
      />,
    );
    // Browser-mode axe keeps color-contrast enabled. The separate CSS token
    // calculation test covers deterministic ratios that JSDOM cannot measure.
    const result = await axe.run(view.container);
    expect(
      result.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      ),
    ).toEqual([]);
  });
});
