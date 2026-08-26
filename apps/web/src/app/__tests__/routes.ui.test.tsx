import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SCREEN_STATES } from "@/lib/screen-state";
import AssetDetailPage from "../assets/[id]/page";
import DocumentPage from "../assets/[id]/document/page";
import ScanPage from "../assets/[id]/scan/page";
import HomePage from "../page";
import ReportPage from "../reports/[id]/page";
import { stubEvidenceReportFetch } from "@/test/evidence-report-fixture";

beforeEach(() => {
  stubEvidenceReportFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});


const params = Promise.resolve({ id: "asset_synthetic_hanriver_01" });
const noSearch = Promise.resolve({});

const SCREENS = [
  { name: "S1 관제 홈", heading: "관제 홈", render: () => HomePage({ searchParams: noSearch }) },
  {
    name: "S3 발행조건 검토",
    heading: "발행조건 검토",
    render: () => DocumentPage({ params, searchParams: noSearch }),
  },
  {
    name: "S4 컨트랙트 검증",
    heading: "컨트랙트 검증 결과",
    render: () => ScanPage({ params, searchParams: noSearch }),
  },
  {
    name: "S5 자산 상세",
    heading: "자산 상세",
    render: () => AssetDetailPage({ params, searchParams: noSearch }),
  },
  {
    name: "S6 리포트",
    heading: "증적 리포트",
    render: () => ReportPage({ params, searchParams: noSearch }),
  },
];

describe("P0 제출 화면 5개", () => {
  for (const screenUnderTest of SCREENS) {
    it(`${screenUnderTest.name} renders its heading`, async () => {
      render(await screenUnderTest.render());

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        screenUnderTest.heading,
      );
    });
  }
});

describe("화면 상태 전환", () => {
  it("shows no state banner in the default normal state", async () => {
    render(await HomePage({ searchParams: noSearch }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  for (const state of SCREEN_STATES.filter((candidate) => candidate !== "normal")) {
    it(`surfaces a banner for the ${state} state`, async () => {
      render(await HomePage({ searchParams: Promise.resolve({ state }) }));

      expect(screen.getByRole("status")).toHaveAttribute("data-state", state);
    });
  }

  it("falls back to normal rather than failing on an unknown state param", async () => {
    render(await HomePage({ searchParams: Promise.resolve({ state: "bogus" }) }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
