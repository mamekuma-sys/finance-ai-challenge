import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ControlEvidence } from "../control-evidence";
import { DEMO_REPORT } from "@/test/evidence-report-fixture";

const [control] = DEMO_REPORT.controls;

describe("ControlEvidence", () => {
  it("shows the extracted value with its unit", () => {
    // 인용문에도 같은 숫자가 있으므로 값 영역을 특정해서 본다.
    const { container } = render(<ControlEvidence control={control} />);

    expect(container.querySelector(".control-value")).toHaveTextContent("100,000");
    expect(container.querySelector(".control-value")).toHaveTextContent("TOKEN");
  });

  it("quotes the document passage the value came from", () => {
    render(<ControlEvidence control={control} />);

    expect(screen.getByRole("blockquote")).toHaveTextContent("총 발행량은 100,000");
  });

  it("locates the passage by page and span", () => {
    render(<ControlEvidence control={control} />);

    expect(screen.getByText(/p\.4/)).toBeInTheDocument();
    expect(screen.getByText(/128–181/)).toBeInTheDocument();
  });

  it("marks a confirmed control as 확정", () => {
    render(<ControlEvidence control={control} />);
    expect(screen.getByText("확정")).toBeInTheDocument();
  });

  it("says 확인 필요 rather than inventing a value when unconfirmed", () => {
    render(<ControlEvidence control={{ ...control, confirmed: false }} />);

    expect(screen.getByText("확인 필요")).toBeInTheDocument();
    expect(screen.queryByText("확정")).not.toBeInTheDocument();
  });
});
