import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "../app-shell";

function renderShell(current: "home" | "scan" = "home") {
  return render(
    <AppShell
      title="관제 홈"
      assetId="asset_synthetic_hanriver_01"
      current={current}
      blockNumber={18402119}
      mode="REPLAY"
      state="normal"
    >
      <p>본문</p>
    </AppShell>,
  );
}

describe("AppShell", () => {
  it("names the asset instead of exposing its identifier", () => {
    renderShell();

    expect(screen.getByText("Han River Office 01")).toBeInTheDocument();
    expect(screen.queryByText(/asset_synthetic_hanriver_01/)).not.toBeInTheDocument();
  });

  it("never shows internal screen ids or route paths to the user", () => {
    const { container } = renderShell();

    expect(container.textContent).not.toMatch(/\bS[1-7]\b/);
    expect(container.textContent).not.toMatch(/SCAFFOLD/i);
    expect(container.textContent).not.toMatch(/\/v1\//);
  });

  it("gives the reviewer a link to every screen in the evidence path", () => {
    renderShell();

    const nav = screen.getByRole("navigation");
    expect(nav.querySelectorAll("a")).toHaveLength(5);
  });

  it("marks the current tab for assistive technology", () => {
    renderShell("scan");

    expect(screen.getByRole("link", { name: "검증 결과" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows a single brand header, not one per nested panel", () => {
    const { container } = renderShell();

    expect(container.querySelectorAll(".app-brand")).toHaveLength(1);
  });

  it("declares replay mode in words, not colour alone", () => {
    renderShell();
    expect(screen.getByTestId("topbar")).toHaveTextContent("재현");
  });
});
