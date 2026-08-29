import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import { Providers } from "@/app/providers";
import { AppShell } from "@/components/app-shell";
import { InvalidLinkNotice } from "@/components/invalid-link-notice";
import { ReportActions } from "@/components/report-actions";
import { WorkbenchGrid } from "@/components/workbench-grid";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Web foundation", () => {
  it("renders descendants through the Query provider", () => {
    const view = render(
      <Providers>
        <span>query child</span>
      </Providers>,
    );

    expect(view.getByText("query child")).toBeInTheDocument();
  });

  it("exposes Assurance Ledger landmarks, optional slots, and honest mode labels", () => {
    const view = render(
      <AppShell
        assetId="asset_01"
        assetName="Han River Office 01"
        current="asset"
        mode="REPLAY"
        freshness="STALE"
        assetLedger={<button type="button">자산 선택</button>}
        riskField={<section>위험 필드</section>}
        evidenceAside={<section>증거 연결</section>}
        eventLedger={<section>이벤트 행</section>}
      />,
    );

    expect(view.getByRole("banner")).toHaveTextContent("합성 데모");
    expect(view.getByRole("banner")).toHaveTextContent("REPLAY");
    expect(view.getByRole("banner")).toHaveTextContent("오래됨");
    expect(view.getByRole("navigation", { name: "주요 화면" })).toBeInTheDocument();
    expect(view.getByRole("link", { name: "본문으로 건너뛰기" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(view.getAllByRole("link")).toHaveLength(7);
    expect(view.getByRole("complementary", { name: "자산 원장" })).toHaveTextContent(
      "자산 선택",
    );
    expect(view.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(view.getByRole("main")).toHaveTextContent("위험 필드");
    expect(view.getByRole("complementary", { name: "증거 근거" })).toHaveTextContent(
      "증거 연결",
    );
    expect(view.getByRole("region", { name: "이벤트 원장" })).toHaveTextContent("이벤트 행");
  });

  it("keeps existing children compatible when no new slots are supplied", () => {
    const view = render(
      <AppShell assetId="asset_01" current="home" mode="LIVE">
        기존 화면
      </AppShell>,
    );

    expect(view.container.querySelector("main")).toHaveTextContent("기존 화면");
    expect(view.container.querySelector("header")).toHaveTextContent("LIVE");
  });

  it.each(["theater", "workbench", "report"] as const)(
    "exposes the %s variant on shell layout boundaries",
    (variant) => {
      const view = render(
        <AppShell assetId="asset_01" current="home" mode="REPLAY" variant={variant}>
          판정 화면
        </AppShell>,
      );

      expect(view.container.querySelector(".ledger-app")).toHaveAttribute("data-variant", variant);
      expect(view.container.querySelector(".ledger-frame")).toHaveAttribute("data-variant", variant);
      expect(view.container.querySelector(".ledger-workbench")).toHaveAttribute(
        "data-variant",
        variant,
      );
    },
  );

  it("defaults to the legacy-compatible workbench variant", () => {
    const view = render(
      <AppShell assetId="asset_01" current="home" mode="LIVE">
        기존 화면
      </AppShell>,
    );

    expect(view.container.querySelector(".ledger-app")).toHaveAttribute(
      "data-variant",
      "workbench",
    );
  });

  it("shows block zero instead of treating it as missing", () => {
    const view = render(
      <AppShell assetId="asset_01" current="home" mode="REPLAY" blockNumber={0}>
        content
      </AppShell>,
    );

    expect(view.container.querySelector(".rail-value")).toHaveTextContent("0");
  });

  it("opens the evidence drawer, closes on Escape, and restores trigger focus", async () => {
    const user = userEvent.setup();
    const view = render(
      <AppShell
        assetId="asset_01"
        current="scan"
        mode="REPLAY"
        evidenceAside={<p>문서에서 코드까지 연결된 근거</p>}
      >
        검증 결과
      </AppShell>,
    );
    const trigger = view.getByRole("button", { name: "증거 근거 열기" });

    await user.click(trigger);
    expect(view.getByRole("dialog", { name: "증거 근거" })).toHaveTextContent(
      "문서에서 코드까지 연결된 근거",
    );

    await user.keyboard("{Escape}");
    expect(view.queryByRole("dialog", { name: "증거 근거" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("provides reusable responsive layout and invalid-link components", () => {
    const view = render(
      <>
        <WorkbenchGrid aside={<div>aside</div>}>main</WorkbenchGrid>
        <InvalidLinkNotice invalid={[{ key: "finding", reason: "invalid", values: ["../x"] }]} />
        <ReportActions reportId="report_01" />
      </>,
    );

    expect(view.getByTestId("workbench-grid")).toHaveClass("workbench-grid");
    expect(view.getByRole("alert")).toHaveTextContent("잘못된 링크");
    expect(view.getByRole("link", { name: "JSON 다운로드" })).toHaveAttribute(
      "href",
      expect.stringContaining("/v1/reports/report_01/download?format=json"),
    );
    expect(view.getByRole("button", { name: "인쇄" })).toBeEnabled();
  });

  it("has no critical accessibility violations in the shell", async () => {
    const view = render(
      <AppShell
        assetId="asset_01"
        current="scan"
        mode="REPLAY"
        evidenceAside={<p>증거</p>}
      >
        결과
      </AppShell>,
    );

    const result = await axe.run(view.container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
  });

  it("renders only invalid-link state and skips data loading for disallowed route state", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const page = await HomePage({
      searchParams: Promise.resolve({ scan: "scan_01" }),
    });
    const view = render(page);

    expect(view.getByRole("alert")).toHaveTextContent("잘못된 링크");
    expect(view.queryByText("최근 온체인 이벤트")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
