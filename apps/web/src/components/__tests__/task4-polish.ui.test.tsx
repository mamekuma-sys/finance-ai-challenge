import { cleanup, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AssetPage from "@/app/assets/[id]/page";
import ReportPage from "@/app/reports/[id]/page";
import { HomeActions } from "@/components/home-actions";
import { RegistrationDialog } from "@/components/registration-dialog";
import type { EvidenceReport } from "@/types/ui";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  getAsset: vi.fn(),
  getScan: vi.fn(),
  getReport: vi.fn(),
  bootstrapDemo: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/lib/adapters/assets", () => ({
  getAsset: mocks.getAsset,
  createAsset: vi.fn(),
  createContract: vi.fn(),
}));
vi.mock("@/lib/adapters/documents", () => ({ uploadDocument: vi.fn() }));
vi.mock("@/lib/adapters/scans", () => ({ getScan: mocks.getScan }));
vi.mock("@/lib/adapters/reports", () => ({ getReport: mocks.getReport }));
vi.mock("@/lib/adapters/demo", () => ({ bootstrapDemo: mocks.bootstrapDemo }));

const sample = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../contracts/examples/evidence-report.sample.json"), "utf8"),
) as EvidenceReport;

const asset = {
  asset_id: sample.scan_run.asset_id,
  name: "합성 한강 오피스",
  underlying_description: "합성 상업용 부동산 수익증권",
  status: "VERIFIED",
  network: "KAIA_KAIROS",
  total_planned_supply: 100_000,
  token_unit: "TOKEN",
  currency: "KRW",
  documents: [{ document_id: "doc", version: "1", controls: sample.controls }],
  contracts: [{ contract_id: "contract" }],
  scans: [sample.scan_run],
  is_synthetic: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAsset.mockResolvedValue(asset);
  mocks.getScan.mockResolvedValue({
    scan_run: sample.scan_run,
    mismatches: sample.mismatches,
    onchain_evidence: sample.onchain_evidence,
    report_id: sample.report_id,
  });
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
});

afterEach(cleanup);

describe("Task 4 asset hierarchy", () => {
  it("orders status, control ledger, scan history, then next action", async () => {
    const view = render(await AssetPage({
      params: Promise.resolve({ id: asset.asset_id }),
      searchParams: Promise.resolve({}),
    }));
    const main = view.getByRole("main");
    const regions = within(main).getAllByRole("region").map((node) => node.getAttribute("aria-label"));

    expect(regions).toEqual([
      "자산 상태",
      "통제 구현 상태",
      "검사 이력",
      "다음 행동",
    ]);
    expect(view.container.querySelector(".ledger-app")).toHaveAttribute("data-variant", "workbench");
    expect(view.getByText("자산 메타데이터")).toBeInTheDocument();
  });

  it("shows partial recovery only when registration data is missing", async () => {
    const complete = render(await AssetPage({
      params: Promise.resolve({ id: asset.asset_id }),
      searchParams: Promise.resolve({}),
    }));
    expect(complete.queryByText("등록 복구")).not.toBeInTheDocument();
    cleanup();

    mocks.getAsset.mockResolvedValue({ ...asset, documents: [], contracts: [] });
    mocks.getScan.mockResolvedValue(null);
    const partial = render(await AssetPage({
      params: Promise.resolve({ id: asset.asset_id }),
      searchParams: Promise.resolve({ registration: "document_failed" }),
    }));
    expect(partial.getByText("등록 복구")).toBeInTheDocument();
    expect(partial.getByText("등록 복구").closest("details")).not.toHaveAttribute("open");
  });
});

describe("Task 4 report contract", () => {
  it("orders verdict, findings, selected evidence, replay, then lineage and keeps scan deep links", async () => {
    const finding = sample.code_findings[0];
    const view = render(await ReportPage({
      params: Promise.resolve({ id: sample.report_id }),
      searchParams: Promise.resolve({ finding: finding.finding_id }),
    }));
    const article = view.getByRole("article", { name: "감사 증거 리포트" });
    const sections = within(article).getAllByRole("region").map((node) => node.getAttribute("aria-label"));

    expect(sections).toEqual([
      "판정 요약",
      "발견사항",
      "선택 문서 및 코드 근거",
      "REPLAY 증거",
      "계보와 무결성",
      "책임과 사용 제한",
    ]);
    expect(within(article).getByText(/totalSupply \+= amount/)).toBeInTheDocument();
    expect(within(article).getByText(sample.controls[0].evidence_span.quote)).toBeInTheDocument();
    expect(within(article).getAllByRole("link", { name: /검사에서 같은 발견사항 열기/ })[0])
      .toHaveAttribute("href", expect.stringContaining(`finding=${finding.finding_id}`));
    expect(within(article).getByText(sample.report_hash)).toBeInTheDocument();
    expect(view.container.querySelector(".ledger-app")).toHaveAttribute("data-variant", "report");
  });

  it("does not label receipt-less evidence as LIVE", async () => {
    mocks.getReport.mockResolvedValue({
      report_id: sample.report_id,
      scan_id: sample.scan_run.scan_id,
      status: "READY",
      report: {
        ...sample,
        onchain_evidence: sample.onchain_evidence.map((item) => ({
          ...item,
          mode: "LIVE",
          receipt_status: null,
        })),
      },
      limitations: [],
      downloads: [],
      is_synthetic: true,
      human_review_required: true,
    });

    const view = render(await ReportPage({ params: Promise.resolve({ id: sample.report_id }) }));
    expect(view.queryByText("LIVE · receipt 확인 데이터")).not.toBeInTheDocument();
    expect(view.getByText(/receipt 없는 LIVE 후보/)).toBeInTheDocument();
  });
});

describe("Task 4 registration wizard", () => {
  it("exposes one step at a time, validates Next, and restores focus on Back", async () => {
    const user = userEvent.setup();
    const view = render(<RegistrationDialog />);
    await user.click(view.getByRole("button", { name: "신규 자산 등록" }));

    expect(view.getByRole("group", { name: "1. 자산 정보" })).toBeVisible();
    expect(view.queryByRole("group", { name: "2. 발행 문서" })).not.toBeInTheDocument();
    await user.click(view.getByRole("button", { name: "다음: 문서" }));
    expect(view.getByRole("alert")).toHaveTextContent("자산명을 입력");

    await user.type(view.getByLabelText("자산명"), "합성 자산");
    await user.type(view.getByLabelText("기초자산 설명"), "합성 오피스");
    await user.type(view.getByLabelText("예정 공급량"), "100000");
    await user.click(view.getByRole("button", { name: "다음: 문서" }));
    expect(view.getByRole("group", { name: "2. 발행 문서" })).toBeVisible();

    await user.click(view.getByRole("button", { name: "뒤로: 자산" }));
    expect(view.getByRole("group", { name: "1. 자산 정보" })).toBeVisible();
    await waitFor(() => expect(view.getByLabelText("자산명")).toHaveFocus());
    expect(view.getByLabelText("자산명")).toHaveValue("합성 자산");
  });

  it("keeps the sample CTA primary and manual registration secondary", () => {
    const view = render(<HomeActions />);
    expect(view.getByRole("button", { name: "샘플 검증 시작" })).toHaveClass("btn-primary");
    expect(view.getByRole("button", { name: "신규 자산 등록" })).not.toHaveClass("btn-primary");
  });
});
