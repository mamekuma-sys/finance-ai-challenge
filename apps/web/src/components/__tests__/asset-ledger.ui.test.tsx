import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssetLedger } from "../asset-ledger";

const ROWS = [
  {
    assetId: "asset_synthetic_hanriver_01",
    highestSeverity: "CRITICAL" as const,
    criticalCount: 1,
    highCount: 0,
  },
];

describe("AssetLedger", () => {
  it("shows the asset name, not the identifier", () => {
    render(<AssetLedger rows={ROWS} />);

    expect(screen.getByText("Han River Office 01")).toBeInTheDocument();
  });

  it("lets the reviewer open the asset — the ten second path from FR-11", () => {
    render(<AssetLedger rows={ROWS} />);

    expect(screen.getByRole("link", { name: /Han River Office 01/ })).toHaveAttribute(
      "href",
      "/assets/asset_synthetic_hanriver_01",
    );
  });

  it("states the severity in words next to the marker", () => {
    render(<AssetLedger rows={ROWS} />);

    expect(screen.getByText(/CRITICAL/)).toBeInTheDocument();
    expect(screen.getByText(/확정 1건/)).toBeInTheDocument();
  });

  it("says so plainly when no asset is registered", () => {
    render(<AssetLedger rows={[]} />);

    expect(screen.getByText(/등록된 자산이 없습니다/)).toBeInTheDocument();
  });

  it("does not advertise unbuilt roadmap scope to the user", () => {
    const { container } = render(<AssetLedger rows={ROWS} />);

    expect(container.textContent).not.toMatch(/P[0-2]\b/);
    expect(container.textContent).not.toMatch(/다음 자산/);
  });
});
