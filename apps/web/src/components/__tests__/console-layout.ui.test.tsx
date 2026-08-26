import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConsoleLayout } from "../console-layout";

const REGIONS = {
  ledger: <p>자산 원장</p>,
  field: <p>위험 필드</p>,
  spine: <p>증거 척추</p>,
  events: <p>이벤트 원장</p>,
};

describe("ConsoleLayout", () => {
  it("places all four regions of the assurance console", () => {
    render(<ConsoleLayout {...REGIONS} blockNumber={18402119} mode="REPLAY" />);

    for (const label of ["자산 원장", "위험 필드", "증거 척추", "이벤트 원장"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("names each region so screen readers can navigate between them", () => {
    render(<ConsoleLayout {...REGIONS} blockNumber={18402119} mode="REPLAY" />);

    for (const name of ["자산 원장", "위험 필드", "증거 척추", "이벤트 원장"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });

  it("shows the block number with thousands separators in the topbar", () => {
    render(<ConsoleLayout {...REGIONS} blockNumber={18402119} mode="REPLAY" />);
    expect(screen.getByTestId("topbar")).toHaveTextContent("18,402,119");
  });

  it("labels replay mode as 재현 and never as 실시간", () => {
    render(<ConsoleLayout {...REGIONS} blockNumber={18402119} mode="REPLAY" />);

    const topbar = screen.getByTestId("topbar");
    expect(topbar).toHaveTextContent("재현");
    expect(topbar).not.toHaveTextContent("실시간");
  });

  it("labels live mode as 실시간", () => {
    render(<ConsoleLayout {...REGIONS} blockNumber={18402119} mode="LIVE" />);
    expect(screen.getByTestId("topbar")).toHaveTextContent("실시간");
  });
});
