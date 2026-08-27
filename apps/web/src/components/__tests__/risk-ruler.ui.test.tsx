import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RiskRuler } from "../risk-ruler";
import type { CodeFinding } from "@/types/contracts";

const FINDINGS = [
  {
    finding_id: "finding_mint_cap_missing",
    rule_id: "MINT_CAP_MISSING",
    severity: "CRITICAL",
    status: "CONFIRMED",
    title: "mint 실행경로에 발행 한도 검사가 없습니다.",
  },
  {
    finding_id: "finding_oracle_stale",
    rule_id: "ORACLE_STALE",
    severity: "HIGH",
    status: "NEEDS_REVIEW",
    title: "오라클 신선도 검증이 약합니다.",
  },
] as CodeFinding[];

describe("RiskRuler", () => {
  it("shows the score and its grade as a whole number", () => {
    render(<RiskRuler findings={FINDINGS} />);

    expect(screen.getByTestId("risk-score")).toHaveTextContent(/^\d+$/);
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("names the findings that drove the score", () => {
    render(<RiskRuler findings={FINDINGS} />);

    expect(screen.getByText(/MINT_CAP_MISSING/)).toBeInTheDocument();
  });

  it("says the score is provisional until the server confirms it", () => {
    render(<RiskRuler findings={FINDINGS} />);
    expect(screen.getByText(/서버 확정 전/)).toBeInTheDocument();
  });

  it("exposes the score to assistive technology as a meter", () => {
    render(<RiskRuler findings={FINDINGS} />);

    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "100");
    expect(meter).toHaveAttribute("aria-valuenow", "80");
  });

  it("stays honest when there is nothing to score", () => {
    render(<RiskRuler findings={[]} />);

    expect(screen.getByTestId("risk-score")).toHaveTextContent("0");
    expect(screen.getByText(/기여한 발견사항이 없습니다/)).toBeInTheDocument();
  });
});
