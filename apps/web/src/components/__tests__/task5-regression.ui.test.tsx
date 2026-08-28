import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ReportPage from "@/app/reports/[id]/page";
import ScanPage from "@/app/assets/[id]/scan/page";
import RootError from "@/app/error";
import RootLoading from "@/app/loading";
import { Providers } from "@/app/providers";
import ReportError from "@/app/reports/[id]/error";
import ReportLoading from "@/app/reports/[id]/loading";
import { DocumentReview } from "@/components/document-review";
import { HomeTheater } from "@/components/home-theater";
import { RegistrationDialog } from "@/components/registration-dialog";
import { SkeletonScreen } from "@/components/states";
import type { EvidenceReport } from "@/types/ui";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  fetchScanView: vi.fn(),
  getReport: vi.fn(),
  getScan: vi.fn(),
  getDocument: vi.fn(),
  getContent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/adapters/reports", () => ({
  fetchScanViewForAsset: mocks.fetchScanView,
  getReport: mocks.getReport,
}));
vi.mock("@/lib/adapters/scans", () => ({
  getScan: mocks.getScan,
  createScan: vi.fn(),
}));
vi.mock("@/lib/adapters/documents", () => ({
  getDocument: mocks.getDocument,
  getDocumentContent: mocks.getContent,
  updatePolicies: vi.fn(),
  uploadDocument: vi.fn(),
}));
vi.mock("@/lib/adapters/assets", () => ({
  createAsset: vi.fn(),
  createContract: vi.fn(),
}));
vi.mock("@/lib/adapters/health", () => ({
  getOperatorReadiness: vi.fn().mockResolvedValue({
    ready: false,
    server_configured: false,
    backend_operator: false,
    session_active: false,
  }),
  unlockOperator: vi.fn(),
  logoutOperator: vi.fn(),
}));

const sample = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../contracts/examples/evidence-report.sample.json"), "utf8"),
) as EvidenceReport;

async function expectNoAxeViolations(container: HTMLElement) {
  const result = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(result.violations).toEqual([]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("Task5 layout and accessibility regressions", () => {
  it("labels a review-only theater finding without claiming a confirmed code failure", () => {
    const reviewReport: EvidenceReport = {
      ...sample,
      code_findings: sample.code_findings.map((finding, index) => (
        index === 0 ? { ...finding, status: "NEEDS_REVIEW" } : finding
      )),
    };

    const view = render(
      <HomeTheater assetId={sample.scan_run.asset_id} assetName="검토 자산" report={reviewReport} />,
    );

    expect(view.getByTestId("theater-verdict-sentence")).toHaveTextContent("담당자 확인 필요");
    expect(view.getByTestId("theater-verdict-sentence")).not.toHaveTextContent(
      "코드는 이를 강제하지 않습니다",
    );
    expect(view.getByText(/NEEDS_REVIEW/)).toBeInTheDocument();
  });

  it("keeps an h1 verdict when the theater has no mismatch or evidence", () => {
    const emptyReport: EvidenceReport = {
      ...sample,
      code_findings: [],
      mismatches: [],
      onchain_evidence: [],
    };

    const view = render(
      <HomeTheater assetId={sample.scan_run.asset_id} assetName="근거 없는 자산" report={emptyReport} />,
    );

    expect(view.getByRole("heading", { level: 1 })).toHaveTextContent("결함을 찾지 못했습니다");
    expect(view.getByText("온체인 증거 없음")).toBeInTheDocument();
    expect(view.getByText("연결된 증거가 없습니다.")).toBeInTheDocument();
  });

  it("does not expose arbitrary backend error details in document or report failures", async () => {
    mocks.getDocument.mockResolvedValue({
      document_id: "doc",
      asset_id: "asset",
      status: "FAILED",
      error_code: "SQL password=secret at C:\\internal\\worker.ts:42",
      file_hash: `sha256:${"a".repeat(64)}`,
      version: "1",
      media_type: "text/plain",
      size_bytes: 10,
      page_count: 1,
      failed_pages: [],
      controls: [],
      uploaded_at: sample.generated_at,
      is_synthetic: true,
    });
    mocks.getContent.mockRejectedValue(new Error("internal source path"));
    const documentView = render(
      <Providers><DocumentReview assetId="asset" documentId="doc" /></Providers>,
    );
    expect(await documentView.findByText(/문서 분석 실패/)).not.toHaveTextContent("password=secret");
    cleanup();

    mocks.getReport.mockResolvedValue({
      report_id: "report",
      scan_id: "scan",
      status: "FAILED",
      report: null,
      error_code: "SQL password=secret at C:\\internal\\report.ts:9",
      limitations: [],
      downloads: [],
      is_synthetic: true,
      human_review_required: true,
    });
    mocks.getScan.mockResolvedValue({ scan_run: sample.scan_run });
    const reportView = render(await ReportPage({ params: Promise.resolve({ id: "report" }) }));
    expect(reportView.getByText("리포트 생성 실패").closest(".state"))
      .not.toHaveTextContent("password=secret");
  });

  it("uses a responsive skeleton layout instead of an unshrinkable inline column", () => {
    const view = render(<SkeletonScreen label="검증 결과를" />);
    const layout = view.getByTestId("skeleton-layout");

    expect(layout).toHaveClass("skeleton-layout");
    expect(layout).not.toHaveStyle({ gridTemplateColumns: "minmax(0,1fr) 328px" });
  });

  it("stacks loading and state actions at 720px without losing desktop theater columns", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).toMatch(
      /@media\s*\(min-width:\s*1366px\)[\s\S]*\.theater-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.6fr\)\s+minmax\(300px,\s*0\.9fr\)\s+minmax\(240px,\s*0\.68fr\)/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*720px\)[\s\S]*\.skeleton-layout[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*720px\)[\s\S]*\.state[\s\S]*flex-direction:\s*column[\s\S]*\.state-tail[\s\S]*margin-left:\s*0/,
    );
  });

  it("preserves route variants and safe semantic hierarchy in loading and error boundaries", () => {
    const rootLoading = render(<RootLoading />);
    expect(rootLoading.container.querySelector(".ledger-app")).toHaveAttribute(
      "data-variant",
      "theater",
    );
    expect(rootLoading.getByRole("heading", { level: 1 })).toHaveTextContent("불러오는 중");
    cleanup();

    const reportLoading = render(<ReportLoading />);
    expect(reportLoading.container.querySelector(".ledger-app")).toHaveAttribute(
      "data-variant",
      "report",
    );
    cleanup();

    const secret = "SQL password=secret at C:\\internal\\route.ts:42";
    const rootError = render(<RootError error={new Error(secret)} reset={vi.fn()} />);
    expect(rootError.container.querySelector(".ledger-app")).toHaveAttribute(
      "data-variant",
      "theater",
    );
    expect(rootError.getByRole("heading", { level: 1 })).toHaveTextContent(
      "관제 현황을 불러오지 못했습니다",
    );
    expect(rootError.getByRole("alert")).not.toHaveTextContent(secret);
    cleanup();

    const reportError = render(<ReportError error={new Error(secret)} reset={vi.fn()} />);
    expect(reportError.container.querySelector(".ledger-app")).toHaveAttribute(
      "data-variant",
      "report",
    );
    expect(reportError.getByRole("heading", { level: 1 })).toHaveTextContent(
      "리포트를 불러오지 못했습니다",
    );
    expect(reportError.getByRole("alert")).not.toHaveTextContent(secret);
  });

  it("opens the registration wizard by keyboard and restores trigger focus on Escape", async () => {
    const user = userEvent.setup();
    const view = render(<RegistrationDialog />);
    const trigger = view.getByRole("button", { name: "신규 자산 등록" });
    trigger.focus();

    await user.keyboard("{Enter}");
    expect(view.getByRole("dialog", { name: "신규 합성 자산 등록" })).toBeInTheDocument();
    await waitFor(() => expect(view.getByLabelText("자산명")).toHaveFocus());

    await user.keyboard("{Escape}");
    expect(view.queryByRole("dialog", { name: "신규 합성 자산 등록" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("runs axe against the HomeTheater DOM", async () => {
    const view = render(
      <HomeTheater assetId={sample.scan_run.asset_id} assetName="합성 자산" report={sample} />,
    );
    await expectNoAxeViolations(view.container);
  });

  it("runs axe against the scan route DOM", async () => {
    mocks.fetchScanView.mockResolvedValue({
      asset: { name: "합성 자산" },
      scan: { scan_run: sample.scan_run, diff: [] },
      report: sample,
    });
    const view = render(await ScanPage({
      params: Promise.resolve({ id: sample.scan_run.asset_id }),
      searchParams: Promise.resolve({}),
    }));
    await expectNoAxeViolations(view.container);
  });

  it("runs axe against the document workbench DOM", async () => {
    mocks.getDocument.mockResolvedValue({
      document_id: "doc",
      asset_id: "asset",
      status: "READY",
      file_hash: `sha256:${"a".repeat(64)}`,
      version: "1",
      media_type: "text/plain",
      size_bytes: 20,
      page_count: 1,
      failed_pages: [],
      controls: sample.controls,
      uploaded_at: sample.generated_at,
      is_synthetic: true,
    });
    mocks.getContent.mockResolvedValue({
      document_id: "doc",
      media_type: "text/plain",
      text: sample.controls[0].evidence_span.quote,
      is_synthetic: true,
    });
    const view = render(
      <Providers><DocumentReview assetId="asset" documentId="doc" /></Providers>,
    );
    await waitFor(() => expect(view.queryByRole("status")).not.toBeInTheDocument());
    await expectNoAxeViolations(view.container);
  });

  it("runs axe against the report route DOM", async () => {
    mocks.getReport.mockResolvedValue({
      report_id: sample.report_id,
      scan_id: sample.scan_run.scan_id,
      status: "READY",
      report: sample,
      limitations: [],
      downloads: [],
      is_synthetic: true,
      human_review_required: true,
    });
    mocks.getScan.mockResolvedValue({ scan_run: sample.scan_run });
    const view = render(await ReportPage({ params: Promise.resolve({ id: sample.report_id }) }));
    await expectNoAxeViolations(view.container);
  });
});
