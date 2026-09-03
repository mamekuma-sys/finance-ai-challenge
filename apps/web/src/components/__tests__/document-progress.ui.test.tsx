import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/app/providers";
import { DocumentReview } from "@/components/document-review";
import type { EvidenceReport } from "@/types/ui";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  getDocument: vi.fn(),
  getContent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/adapters/documents", () => ({
  getDocument: mocks.getDocument,
  getDocumentContent: mocks.getContent,
  updatePolicies: vi.fn(),
  uploadDocument: vi.fn(),
}));
vi.mock("@/lib/adapters/scans", () => ({ createScan: vi.fn(), getScan: vi.fn() }));

const sample = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "../../contracts/examples/evidence-report.sample.json"),
    "utf8",
  ),
) as EvidenceReport;

function documentWith(confirmedFields: readonly string[]) {
  return {
    document_id: "doc",
    asset_id: "asset",
    status: "READY",
    file_hash: `sha256:${"a".repeat(64)}`,
    version: "1",
    media_type: "text/plain",
    size_bytes: 20,
    page_count: 1,
    failed_pages: [],
    controls: sample.controls.map((control) => ({
      ...control,
      confirmed: confirmedFields.includes(control.field),
    })),
    uploaded_at: sample.generated_at,
    is_synthetic: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getContent.mockResolvedValue({
    document_id: "doc",
    media_type: "text/plain",
    text: sample.controls[0].evidence_span.quote,
    is_synthetic: true,
  });
});

afterEach(cleanup);

describe("문서 검토 진행률", () => {
  it("게이트가 남은 개수와 항목 이름을 함께 보여준다", async () => {
    mocks.getDocument.mockResolvedValue(documentWith(["max_supply", "issuer_role"]));

    render(
      <Providers>
        <DocumentReview assetId="asset" documentId="doc" contractId="contract" />
      </Providers>,
    );

    const gate = await screen.findByText(/P0 통제조건 2\/6 확정/);
    expect(gate).toBeInTheDocument();
    expect(screen.getByText(/남은 항목 ·/)).toHaveTextContent("담보·기초자산 확인");
    expect(screen.getByText(/남은 항목 ·/)).toHaveTextContent("비상 통제");
    expect(screen.getByRole("button", { name: "컨트랙트 검사 시작" })).toBeDisabled();
  });

  it("좌측 목록 머리글에도 같은 진행률이 있다", async () => {
    mocks.getDocument.mockResolvedValue(documentWith(["max_supply"]));

    render(
      <Providers>
        <DocumentReview assetId="asset" documentId="doc" contractId="contract" />
      </Providers>,
    );

    expect(await screen.findByText(/확정 1\/6/)).toBeInTheDocument();
  });

  it("6개가 모두 확정되면 경고가 사라지고 검사 버튼이 열린다", async () => {
    mocks.getDocument.mockResolvedValue(
      documentWith(sample.controls.map((control) => control.field)),
    );

    render(
      <Providers>
        <DocumentReview assetId="asset" documentId="doc" contractId="contract" />
      </Providers>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "컨트랙트 검사 시작" })).toBeEnabled(),
    );
    expect(screen.queryByText(/P0 통제조건 .*확정/)).not.toBeInTheDocument();
    expect(screen.getByText(/확정 6\/6/)).toBeInTheDocument();
  });

  it("체크박스를 끄면 진행률이 즉시 줄어든다", async () => {
    const user = userEvent.setup();
    mocks.getDocument.mockResolvedValue(
      documentWith(sample.controls.map((control) => control.field)),
    );

    render(
      <Providers>
        <DocumentReview assetId="asset" documentId="doc" contractId="contract" />
      </Providers>,
    );

    await waitFor(() => expect(screen.getByText(/확정 6\/6/)).toBeInTheDocument());
    await user.click(screen.getByLabelText("원문 근거를 확인했습니다"));

    expect(await screen.findByText(/P0 통제조건 5\/6 확정/)).toBeInTheDocument();
  });

  it("목록에서 6개 값을 클릭 없이 읽을 수 있다", async () => {
    mocks.getDocument.mockResolvedValue(documentWith([]));

    render(
      <Providers>
        <DocumentReview assetId="asset" documentId="doc" contractId="contract" />
      </Providers>,
    );

    const rail = await screen.findByRole("navigation", { name: "통제조건 선택" });
    // 단위가 있으면 값 옆에 함께 읽힌다.
    expect(rail).toHaveTextContent("100,000 TOKEN");
    expect(rail).toHaveTextContent("60 MINUTE");
    // 불리언을 1/0으로 바꾸지 않는다.
    expect(rail).toHaveTextContent("true");
  });

  it("선택한 통제의 근거 문장을 값 옆에 항상 보여준다", async () => {
    mocks.getDocument.mockResolvedValue(documentWith([]));

    render(
      <Providers>
        <DocumentReview assetId="asset" documentId="doc" contractId="contract" />
      </Providers>,
    );

    const first = sample.controls[0];
    await waitFor(() =>
      expect(screen.getByText(`원문 근거 · ${first.evidence_span.page}페이지`)).toBeInTheDocument(),
    );
    expect(screen.getAllByText(first.evidence_span.quote).length).toBeGreaterThan(0);
  });
});
