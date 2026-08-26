import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ScanPage from "../assets/[id]/scan/page";
import HomePage from "../page";

const params = Promise.resolve({ id: "asset_synthetic_hanriver_01" });
const noSearch = Promise.resolve({});

describe("S1 관제 홈은 3분할 셸을 쓴다", () => {
  it("renders the four console regions", async () => {
    render(await HomePage({ searchParams: noSearch }));

    for (const name of ["자산 원장", "위험 필드", "증거 척추", "이벤트 원장"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });

  it("declares the evidence mode in the topbar instead of leaving it implicit", async () => {
    render(await HomePage({ searchParams: noSearch }));
    expect(screen.getByTestId("topbar")).toHaveTextContent("재현");
  });
});

describe("S4 컨트랙트 검증은 근거 코드를 줄 번호와 함께 보여준다", () => {
  it("renders the finding source with an anchor at the finding line", async () => {
    const { container } = render(await ScanPage({ params, searchParams: noSearch }));

    expect(container.ownerDocument.getElementById("VulnerableRwaToken.sol-L23")).toBeInTheDocument();
  });

  it("marks the offending lines rather than only naming them", async () => {
    const { container } = render(await ScanPage({ params, searchParams: noSearch }));
    expect(container.querySelectorAll('[data-highlighted="true"]').length).toBeGreaterThan(0);
  });
});
