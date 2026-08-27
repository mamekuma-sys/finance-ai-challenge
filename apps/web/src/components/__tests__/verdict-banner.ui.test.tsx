import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerdictBanner } from "../verdict-banner";
import { DEMO_REPORT } from "@/test/evidence-report-fixture";

const CLEAN = { ...DEMO_REPORT, mismatches: [], code_findings: [] };

describe("VerdictBanner", () => {
  it("leads with what is wrong, in one sentence", () => {
    render(<VerdictBanner report={DEMO_REPORT} assetId="asset_synthetic_hanriver_01" />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "mint 실행경로에 발행 한도 검사가 없습니다.",
    );
  });

  it("states the severity in words, not colour alone", () => {
    render(<VerdictBanner report={DEMO_REPORT} assetId="asset_synthetic_hanriver_01" />);
    expect(screen.getByText("확정 CRITICAL")).toBeInTheDocument();
  });

  it("says which document clause the code broke", () => {
    render(<VerdictBanner report={DEMO_REPORT} assetId="asset_synthetic_hanriver_01" />);

    expect(screen.getByText(/max_supply 100,000 TOKEN/)).toBeInTheDocument();
  });

  it("offers the next action rather than leaving the reviewer stranded", () => {
    render(<VerdictBanner report={DEMO_REPORT} assetId="asset_synthetic_hanriver_01" />);

    expect(screen.getByRole("link", { name: "근거 보기" })).toHaveAttribute(
      "href",
      "/assets/asset_synthetic_hanriver_01/scan",
    );
    expect(screen.getByRole("link", { name: "리포트 열기" })).toHaveAttribute(
      "href",
      "/reports/report_demo_01",
    );
  });

  it("reports a clean scan honestly instead of inventing a problem", () => {
    render(<VerdictBanner report={CLEAN} assetId="asset_synthetic_hanriver_01" />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("자동검사 통과");
    expect(screen.getByText(/담당자 검토 필요/)).toBeInTheDocument();
  });
})
