import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReportPage from "../reports/[id]/page";
import { stubEvidenceReportFetch } from "@/test/evidence-report-fixture";

afterEach(() => {
  vi.unstubAllGlobals();
});

const params = Promise.resolve({ id: "report_demo_01" });
const noSearch = Promise.resolve({});

describe("S6 리포트는 데모 endpoint의 실데이터를 렌더한다", () => {
  it("renders the evidence spine built from the fetched report", async () => {
    stubEvidenceReportFetch();

    render(await ReportPage({ params, searchParams: noSearch }));

    expect(screen.getByText(/max_supply/)).toBeInTheDocument();
    expect(screen.getByText("fixtures/VulnerableRwaToken.sol:23–25")).toBeInTheDocument();
  });

  it("renders a block receipt for the on-chain evidence", async () => {
    stubEvidenceReportFetch();

    render(await ReportPage({ params, searchParams: noSearch }));

    expect(screen.getByTestId("tx-hash")).toBeInTheDocument();
    expect(screen.getByText("Minted")).toBeInTheDocument();
  });

  it("records the lineage the report must carry", async () => {
    stubEvidenceReportFetch();

    render(await ReportPage({ params, searchParams: noSearch }));

    expect(screen.getByText(/sha256:doc/)).toBeInTheDocument();
    expect(screen.getByText(/mint-controls/)).toBeInTheDocument();
  });

  it("throws so the segment error boundary can take over when the API fails", async () => {
    stubEvidenceReportFetch({ error: { code: "INTERNAL_ERROR" } }, 503);

    await expect(ReportPage({ params, searchParams: noSearch })).rejects.toThrow(
      "EVIDENCE_REPORT_UNAVAILABLE",
    );
  });
});
