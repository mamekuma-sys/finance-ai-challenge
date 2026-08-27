import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const reportParams = Promise.resolve({ id: "report_demo_01" });
const noSearch = Promise.resolve({});

const SCREENS = [
  { name: "관제 홈", render: () => HomePage({ searchParams: noSearch }) },
  { name: "발행조건", render: () => DocumentPage({ params, searchParams: noSearch }) },
  { name: "검증 결과", render: () => ScanPage({ params, searchParams: noSearch }) },
  { name: "자산 상세", render: () => AssetDetailPage({ params, searchParams: noSearch }) },
  { name: "리포트", render: () => ReportPage({ params: reportParams, searchParams: noSearch }) },
];

describe("어느 화면에서도 다른 화면으로 갈 수 있다", () => {
  for (const screenUnderTest of SCREENS) {
    it(`${screenUnderTest.name} carries the full navigation`, async () => {
      render(await screenUnderTest.render());

      const nav = screen.getByRole("navigation");
      expect(nav.querySelectorAll("a")).toHaveLength(5);
    });

    it(`${screenUnderTest.name} shows exactly one page heading`, async () => {
      render(await screenUnderTest.render());

      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    });
  }
});
