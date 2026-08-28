import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PollingRefresher } from "@/components/polling-refresher";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

afterEach(() => {
    cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
    vi.unstubAllGlobals();
});

describe("PollingRefresher", () => {
  it("clears its interval when unmounted", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    const view = render(<PollingRefresher active interval={1_000} />);

    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(refresh).toHaveBeenCalledTimes(2);
    view.unmount();
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("stops after the configured maximum and shows an actionable delay state", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    render(<PollingRefresher active interval={1_000} maxAttempts={2} timeoutMs={60_000} />);

    await act(async () => vi.advanceTimersByTimeAsync(3_000));

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert")).toHaveTextContent("처리 지연");
    expect(screen.getByRole("button", { name: "재시도" })).toBeInTheDocument();
  });

  it("stops when worker readiness fails", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    render(<PollingRefresher active interval={1_000} />);

    await act(async () => vi.advanceTimersByTimeAsync(1_000));

    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("worker 확인");
  });
});
