import { act, cleanup, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetRecoveryActions } from "@/components/asset-recovery-actions";
import { ComparePanel } from "@/components/compare-panel";
import { DocumentReview } from "@/components/document-review";
import { WorkbenchGrid } from "@/components/workbench-grid";
import { Providers } from "@/app/providers";
import AssetPage from "@/app/assets/[id]/page";
import ReportPage from "@/app/reports/[id]/page";
import ScanPage from "@/app/assets/[id]/scan/page";
import type { EvidenceReport } from "@/types/ui";
import { AppError } from "@/lib/adapters/errors";
import { reportDisclosureOf } from "@/lib/report-disclosure";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  fetchScanView: vi.fn(),
  getReport: vi.fn(),
  getScan: vi.fn(),
  getAsset: vi.fn(),
  getDocument: vi.fn(),
  getContent: vi.fn(),
  updatePolicies: vi.fn(),
  createScan: vi.fn(),
  createContract: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: mocks.refresh }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock("@/lib/adapters/reports", () => ({
  fetchScanViewForAsset: mocks.fetchScanView,
  getReport: mocks.getReport,
}));
vi.mock("@/lib/adapters/scans", () => ({
  getScan: mocks.getScan,
  createScan: mocks.createScan,
}));
vi.mock("@/lib/adapters/documents", () => ({
  getDocument: mocks.getDocument,
  getDocumentContent: mocks.getContent,
  updatePolicies: mocks.updatePolicies,
  uploadDocument: vi.fn(),
}));
vi.mock("@/lib/adapters/assets", () => ({
  createContract: mocks.createContract,
  getAsset: mocks.getAsset,
}));
vi.mock("@/lib/report-disclosure", async () => {
  const actual = await vi.importActual<typeof import("@/lib/report-disclosure")>(
    "@/lib/report-disclosure",
  );
  return { ...actual, reportDisclosureOf: vi.fn(actual.reportDisclosureOf) };
});

const sample = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../contracts/examples/evidence-report.sample.json"), "utf8"),
) as EvidenceReport;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams = new URLSearchParams();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Task5 rendered flows", () => {
  it("stops document polling and explains worker readiness failure", async () => {
    mocks.getDocument.mockResolvedValue({
      document_id: "doc",
      asset_id: "asset",
      status: "PROCESSING",
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
    mocks.getContent.mockResolvedValue({
      document_id: "doc",
      media_type: "text/plain",
      text: "synthetic",
      is_synthetic: true,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    vi.useFakeTimers();
    const view = render(
      <Providers><DocumentReview assetId="asset" documentId="doc" /></Providers>,
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(view.getByText(/처리 중/)).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(1_500));

    expect(view.getByRole("alert")).toHaveTextContent("worker 확인");
    expect(mocks.getDocument).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("stops queued scan polling when worker readiness fails", async () => {
    mocks.fetchScanView.mockResolvedValue({
      asset: { name: "자산" },
      scan: { scan_run: { ...sample.scan_run, status: "QUEUED" } },
      report: null,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    vi.useFakeTimers();
    const view = render(await ScanPage({
      params: Promise.resolve({ id: sample.scan_run.asset_id }),
      searchParams: Promise.resolve({}),
    }));

    await act(async () => vi.advanceTimersByTimeAsync(1_500));

    expect(view.getByRole("alert")).toHaveTextContent("worker 확인");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("renders queued, probable, and clean completed scan verdicts", async () => {
    mocks.fetchScanView.mockResolvedValueOnce({
      asset: { name: "자산" },
      scan: { scan_run: { ...sample.scan_run, status: "QUEUED" } },
      report: null,
    });
    const queued = render(await ScanPage({
      params: Promise.resolve({ id: sample.scan_run.asset_id }),
      searchParams: Promise.resolve({}),
    }));
    expect(queued.getByText(/검사 대기 중/)).toBeInTheDocument();
    cleanup();

    mocks.fetchScanView.mockResolvedValueOnce({
      asset: { name: "자산" },
      scan: { scan_run: sample.scan_run, diff: [] },
      report: {
        ...sample,
        code_findings: [{ ...sample.code_findings[0], status: "PROBABLE" }],
        mismatches: [],
      },
    });
    const probable = render(await ScanPage({
      params: Promise.resolve({ id: sample.scan_run.asset_id }),
      searchParams: Promise.resolve({}),
    }));
    expect(probable.getByText("유력 — 담당자 확인 필요")).toBeInTheDocument();
    cleanup();

    mocks.fetchScanView.mockResolvedValueOnce({
      asset: { name: "자산" },
      scan: { scan_run: sample.scan_run, diff: [] },
      report: { ...sample, code_findings: [], mismatches: [] },
    });
    const clean = render(await ScanPage({
      params: Promise.resolve({ id: sample.scan_run.asset_id }),
      searchParams: Promise.resolve({}),
    }));
    expect(clean.getByText("자동검사 통과 — 담당자 검토 필요")).toBeInTheDocument();
  });

  it("preserves untouched controls and submits page-based manual evidence", async () => {
    const user = userEvent.setup();
    mocks.getDocument.mockResolvedValue({
      document_id: "doc",
      asset_id: "asset",
      status: "READY",
      file_hash: `sha256:${"a".repeat(64)}`,
      version: "1",
      media_type: "application/pdf",
      size_bytes: 10,
      page_count: 1,
      failed_pages: [],
      controls: [sample.controls[0]],
      uploaded_at: sample.generated_at,
      is_synthetic: true,
    });
    mocks.getContent.mockResolvedValue({
      document_id: "doc",
      media_type: "application/pdf",
      content_base64: "JVBERi0=",
      is_synthetic: true,
    });
    mocks.updatePolicies.mockResolvedValue([]);
    const view = render(
      <Providers><DocumentReview assetId="asset" documentId="doc" /></Providers>,
    );
    const save = await view.findByRole("button", { name: "저장" });
    await user.click(save);
    expect(mocks.updatePolicies).toHaveBeenCalledWith(
      "asset",
      expect.objectContaining({
        policies: [expect.objectContaining({
          value: sample.controls[0].value,
          confirmed: sample.controls[0].confirmed,
        })],
      }),
    );

    const manual = (await view.findAllByText("누락 · 수동 입력"))[0].closest("article")!;
    await user.type(within(manual).getByLabelText("값"), "60");
    await user.clear(within(manual).getByLabelText("페이지"));
    await user.type(within(manual).getByLabelText("페이지"), "2");
    await user.type(within(manual).getByLabelText("해당 페이지의 정확한 원문 인용"), "정확한 문구");
    await user.click(within(manual).getByRole("button", { name: "수동 조건 저장" }));
    await waitFor(() => expect(mocks.updatePolicies).toHaveBeenLastCalledWith(
      "asset",
      expect.objectContaining({
        policies: [expect.objectContaining({
          page: 2,
          quote: "정확한 문구",
        })],
      }),
    ));
  });

  it("renders failed report guidance and ready report actions", async () => {
    mocks.getReport.mockResolvedValueOnce({
      report_id: "report",
      scan_id: "scan",
      status: "FAILED",
      report: null,
      limitations: ["분석 실패"],
      error_code: "CONTRACT_SCAN_FAILED",
      downloads: [],
      is_synthetic: true,
      human_review_required: true,
    });
    mocks.getScan.mockResolvedValue({ scan_run: sample.scan_run });
    const failed = render(await ReportPage({ params: Promise.resolve({ id: "report" }) }));
    expect(failed.getByText("리포트 생성 실패")).toBeInTheDocument();
    expect(failed.queryByText(/CONTRACT_SCAN_FAILED/)).not.toBeInTheDocument();
    expect(failed.getByText(/내부 오류 정보는 숨겼습니다/)).toBeInTheDocument();
    cleanup();

    mocks.getReport.mockResolvedValueOnce({
      report_id: sample.report_id,
      scan_id: sample.scan_run.scan_id,
      status: "READY",
      report: sample,
      limitations: [],
      downloads: [],
      is_synthetic: true,
      human_review_required: true,
    });
    const ready = render(await ReportPage({ params: Promise.resolve({ id: sample.report_id }) }));
    expect(ready.getByRole("button", { name: "인쇄" })).toBeInTheDocument();
    expect(ready.getByRole("link", { name: /JSON/ })).toBeInTheDocument();
    expect(ready.getByRole("heading", { name: "계보와 제한사항" })).toBeInTheDocument();
    expect(ready.getByText("입력 해시")).toBeInTheDocument();
    expect(ready.getByText("룰 버전")).toBeInTheDocument();
    expect(ready.getByText(/담당자 검토가 필요합니다/)).toHaveTextContent("자동 발행 승인");
    expect(vi.mocked(reportDisclosureOf)).toHaveBeenCalledWith(sample, []);
  });

  it("keeps a stored report visible when scan metadata fails", async () => {
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
    mocks.getScan.mockRejectedValue(
      new AppError("network", null, undefined, { operation: "getScan" }),
    );

    const view = render(await ReportPage({ params: Promise.resolve({ id: sample.report_id }) }));
    expect(view.getByRole("heading", { name: "증거 리포트" })).toBeInTheDocument();
    expect(view.getByText(/검사 메타데이터를 불러오지 못했습니다/)).toBeInTheDocument();
  });

  it("isolates report failure on the asset page", async () => {
    mocks.getAsset.mockResolvedValue({
      asset_id: sample.scan_run.asset_id,
      name: "합성 자산",
      underlying_description: "fixture",
      status: "VERIFIED",
      network: "KAIA_KAIROS",
      total_planned_supply: 100_000,
      token_unit: "TOKEN",
      currency: "KRW",
      documents: [{ document_id: "doc", version: "1", controls: sample.controls }],
      contracts: [],
      scans: [sample.scan_run],
      is_synthetic: true,
    });
    mocks.getScan.mockResolvedValue({
      scan_run: sample.scan_run,
      mismatches: sample.mismatches,
      onchain_evidence: sample.onchain_evidence,
      report_id: sample.report_id,
    });
    mocks.getReport.mockRejectedValue(new AppError("server", 500));

    const view = render(await AssetPage({
      params: Promise.resolve({ id: sample.scan_run.asset_id }),
      searchParams: Promise.resolve({}),
    }));
    expect(view.getByText("자산 메타데이터")).toBeInTheDocument();
    expect(view.getByText("통제조건 구현 상태")).toBeInTheDocument();
    expect(view.getByText(/리포트만 불러오지 못했습니다/)).toBeInTheDocument();
  });

  it("blocks confirmation without source and focuses selected evidence", async () => {
    mocks.searchParams = new URLSearchParams(`constraint=${sample.controls[0].constraint_id}`);
    mocks.getDocument.mockResolvedValue({
      document_id: "doc",
      asset_id: "asset",
      status: "READY",
      file_hash: `sha256:${"a".repeat(64)}`,
      version: "1",
      media_type: "text/plain",
      size_bytes: 10,
      page_count: 1,
      failed_pages: [],
      controls: [sample.controls[0]],
      uploaded_at: sample.generated_at,
      is_synthetic: true,
    });
    mocks.getContent.mockRejectedValue(new AppError("not_found", 404));
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;

    const view = render(
      <Providers><DocumentReview assetId="asset" documentId="doc" /></Providers>,
    );
    expect(await view.findByText(/원문 접근 불가 시.*confirmed로 저장할 수 없습니다/))
      .toBeInTheDocument();
    expect(view.getByRole("link", { name: "문서 다시 업로드" })).toBeInTheDocument();
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(document.activeElement).toBe(
      document.getElementById(sample.controls[0].constraint_id),
    );
  });

  it("renders the complete TXT source and marks the selected character span", async () => {
    const control = {
      ...sample.controls[0],
      constraint_id: "control_txt",
      evidence_span: {
        ...sample.controls[0].evidence_span,
        start: 7,
        end: 12,
        quote: "EXACT",
      },
    };
    mocks.searchParams = new URLSearchParams("constraint=control_txt");
    mocks.getDocument.mockResolvedValue({
      document_id: "doc",
      asset_id: "asset",
      status: "READY",
      file_hash: `sha256:${"a".repeat(64)}`,
      version: "1",
      media_type: "text/plain",
      size_bytes: 18,
      page_count: 1,
      failed_pages: [],
      controls: [control],
      uploaded_at: sample.generated_at,
      is_synthetic: true,
    });
    mocks.getContent.mockResolvedValue({
      document_id: "doc",
      media_type: "text/plain",
      text: "prefix EXACT suffix",
      is_synthetic: true,
    });
    Element.prototype.scrollIntoView = vi.fn();

    const view = render(
      <Providers><DocumentReview assetId="asset" documentId="doc" /></Providers>,
    );
    const source = await view.findByLabelText("1페이지 선택 근거");
    expect(source.tagName).toBe("MARK");
    expect(source).toHaveTextContent("EXACT");
    expect(source.closest("pre")).toHaveTextContent("prefix EXACT suffix");
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById("control_txt")));
  });

  it("moves the PDF viewer to the selected page and states highlight limits", async () => {
    const control = {
      ...sample.controls[0],
      constraint_id: "control_pdf",
      evidence_span: {
        ...sample.controls[0].evidence_span,
        page: 3,
        quote: "Exact PDF quote",
      },
    };
    mocks.searchParams = new URLSearchParams("constraint=control_pdf");
    mocks.getDocument.mockResolvedValue({
      document_id: "doc",
      asset_id: "asset",
      status: "READY",
      file_hash: `sha256:${"a".repeat(64)}`,
      version: "1",
      media_type: "application/pdf",
      size_bytes: 18,
      page_count: 3,
      failed_pages: [],
      controls: [control],
      uploaded_at: sample.generated_at,
      is_synthetic: true,
    });
    mocks.getContent.mockResolvedValue({
      document_id: "doc",
      media_type: "application/pdf",
      content_base64: "JVBERi0=",
      is_synthetic: true,
    });
    Element.prototype.scrollIntoView = vi.fn();

    const view = render(
      <Providers><DocumentReview assetId="asset" documentId="doc" /></Providers>,
    );
    expect(await view.findByTitle("발행 문서 PDF")).toHaveAttribute(
      "src",
      expect.stringMatching(/#page=3$/),
    );
    expect(view.getByText("Exact PDF quote")).toBeInTheDocument();
    expect(view.getByText(/exact quote 자동 강조를 지원하지 않습니다/)).toBeInTheDocument();
  });

  it("links source but does not scan while the review gate is closed", async () => {
    const user = userEvent.setup();
    mocks.createContract.mockResolvedValue({ contract_id: "contract" });
    const view = render(
      <AssetRecoveryActions
        assetId="asset"
        needsDocument={false}
        needsContract
        canScan={false}
      />,
    );
    await user.click(view.getByLabelText("컨트랙트 source 재연결"));
    await user.paste("contract X {}");
    await user.click(view.getByRole("button", { name: "Source 연결 후 검사" }));
    await waitFor(() => expect(mocks.createContract).toHaveBeenCalled());
    expect(mocks.createScan).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/assets/asset/document");
  });

  it("renders one selected comparison and carries deep-link and diff state through the rail", async () => {
    const finding = sample.code_findings[0];
    mocks.fetchScanView.mockResolvedValue({
      asset: { name: "자산" },
      scan: {
        scan_run: sample.scan_run,
        diff: [{
          base_scan_id: "scan_base",
          head_scan_id: sample.scan_run.scan_id,
          finding_id: finding.finding_id,
          rule_id: finding.rule_id,
          severity: finding.severity,
          change: "REMAINS",
          base_rule_version: "1.0.0",
          head_rule_version: "1.0.0",
          is_synthetic: true,
        }],
      },
      report: sample,
    });

    const view = render(await ScanPage({
      params: Promise.resolve({ id: sample.scan_run.asset_id }),
      searchParams: Promise.resolve({
        scan: sample.scan_run.scan_id,
        base: "scan_base",
        finding: finding.finding_id,
      }),
    }));

    expect(view.getAllByRole("heading", { name: "문서와 코드 대조" })).toHaveLength(1);
    const selected = within(view.getByRole("navigation", { name: "발견사항 선택" }))
      .getByRole("link", { name: new RegExp(finding.title) });
    expect(selected).toHaveAttribute("aria-current", "true");
    expect(selected).toHaveTextContent("REMAINS");
    expect(view.getByRole("region", { name: "선택 발견사항 비교" })).toHaveTextContent("REMAINS");
  });

  it("keeps only the selected document constraint editable and blocks confirmed saves without source", async () => {
    const user = userEvent.setup();
    const controls = sample.controls.slice(0, 2).map((control) => ({
      ...control,
      confirmed: false,
    }));
    mocks.getDocument.mockResolvedValue({
      document_id: "doc",
      asset_id: "asset",
      status: "READY",
      file_hash: `sha256:${"a".repeat(64)}`,
      version: "1",
      media_type: "text/plain",
      size_bytes: 10,
      page_count: 1,
      failed_pages: [],
      controls,
      uploaded_at: sample.generated_at,
      is_synthetic: true,
    });
    mocks.getContent.mockRejectedValue(new AppError("not_found", 404));
    const view = render(
      <Providers><DocumentReview assetId="asset" documentId="doc" /></Providers>,
    );

    const value = await view.findByLabelText("값");
    expect(view.getAllByLabelText("값")).toHaveLength(1);
    await user.clear(value);
    await user.type(value, "보존할 값");
    const secondConstraint = view.getByRole("button", {
      name: new RegExp(controls[1].field),
    });
    secondConstraint.focus();
    await user.keyboard("{Enter}");
    expect(secondConstraint).toHaveAttribute("aria-current", "true");
    expect(view.getAllByLabelText("값")).toHaveLength(1);
    await user.click(view.getByRole("button", {
      name: new RegExp(controls[0].field),
    }));
    expect(view.getByLabelText("값")).toHaveValue("보존할 값");

    await user.click(view.getByLabelText("원문 근거를 확인했습니다"));
    expect(view.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("exposes compact selected read-only comparison and responsive workbench slots", async () => {
    const mismatch = sample.mismatches[0];
    const linked = {
      mismatch,
      control: sample.controls.find((item) => item.constraint_id === mismatch.constraint_id),
      finding: sample.code_findings.find((item) => item.finding_id === mismatch.finding_id),
    };
    const compare = render(await ComparePanel({
      linked,
      assetId: sample.scan_run.asset_id,
      variant: "compact",
      selected: true,
      readOnly: true,
      diffStatus: "NEW",
    }));
    expect(compare.getByRole("heading", { name: "문서와 코드 대조" })).toBeInTheDocument();
    expect(compare.getByRole("region", { name: "선택 발견사항 비교" }))
      .toHaveAttribute("data-variant", "compact");
    expect(compare.getByText("NEW")).toBeInTheDocument();
    expect(compare.queryByRole("link", { name: "문서 조항 보기" })).not.toBeInTheDocument();
    cleanup();

    const grid = render(
      <WorkbenchGrid
        rail={<nav>발견사항 레일</nav>}
        content={<main>비교 내용</main>}
        evidence={<aside>증거 상세</aside>}
        evidenceSummary={<p>증거 요약</p>}
        actions={<footer>다음 행동</footer>}
      />,
    );
    expect(grid.getByTestId("workbench-grid")).toHaveAttribute("data-layout", "audit");
    expect(grid.getByText("발견사항 레일").closest("[data-slot]")).toHaveAttribute("data-slot", "rail");
    expect(grid.getByText("증거 요약").closest("[data-slot]")).toHaveAttribute("data-slot", "evidence-summary");
  });
});
