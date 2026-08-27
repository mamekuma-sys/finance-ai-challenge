import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MismatchList } from "../mismatch-list";
import { DEMO_REPORT } from "@/test/evidence-report-fixture";

describe("MismatchList", () => {
  it("states the control, the code and how far apart they are", () => {
    render(<MismatchList report={DEMO_REPORT} assetId="asset_synthetic_hanriver_01" />);

    expect(screen.getByText(/max_supply/)).toBeInTheDocument();
    expect(screen.getByText(/mint 실행경로에 발행 한도 검사가 없습니다/)).toBeInTheDocument();
    expect(screen.getByText("미구현")).toBeInTheDocument();
  });

  it("formats the control value the same way the rest of the console does", () => {
    render(<MismatchList report={DEMO_REPORT} assetId="asset_synthetic_hanriver_01" />);

    expect(screen.getByText(/max_supply 100,000 TOKEN/)).toBeInTheDocument();
  });

  it("links to the document passage behind the control", () => {
    render(<MismatchList report={DEMO_REPORT} assetId="asset_synthetic_hanriver_01" />);

    expect(screen.getByRole("link", { name: /문서 조항/ })).toHaveAttribute(
      "href",
      "/assets/asset_synthetic_hanriver_01/document?constraint=control_max_supply",
    );
  });

  it("anchors straight at the offending code line", () => {
    render(<MismatchList report={DEMO_REPORT} assetId="asset_synthetic_hanriver_01" />);

    expect(screen.getByRole("link", { name: /코드 라인/ })).toHaveAttribute(
      "href",
      "#fixtures/VulnerableRwaToken.sol-L23",
    );
  });

  it("says so plainly when nothing is mismatched", () => {
    render(
      <MismatchList
        report={{ ...DEMO_REPORT, mismatches: [] }}
        assetId="asset_synthetic_hanriver_01"
      />,
    );

    expect(screen.getByText(/자동검사 통과/)).toBeInTheDocument();
    expect(screen.getByText(/담당자 검토 필요/)).toBeInTheDocument();
  });
});
