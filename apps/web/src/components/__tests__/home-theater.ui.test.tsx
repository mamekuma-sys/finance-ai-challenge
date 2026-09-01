import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeTheater } from "@/components/home-theater";
import { spineOf } from "@/lib/evidence-report";
import type { AlertSummary, EvidenceReport } from "@/types/ui";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const sample = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../contracts/examples/evidence-report.sample.json"), "utf8"),
) as EvidenceReport;

afterEach(cleanup);

describe("home Evidence Theater", () => {
  it("renders one sentence verdict, risk, coverage, top comparison, spine, and both actions", () => {
    const lead = sample.mismatches[0];
    const leadFinding = sample.code_findings.find(
      (finding) => finding.finding_id === lead.finding_id,
    );
    const view = render(
      <HomeTheater
        assetId={sample.scan_run.asset_id}
        assetName="합성 한강 오피스 수익증권"
        report={sample}
      />,
    );

    const sentence = view.getByTestId("theater-verdict-sentence");
    expect(sentence).toHaveTextContent("발행 문서는");
    expect(sentence).toHaveTextContent("코드는");
    expect(sentence.textContent?.match(/[.!?。]$/)).not.toBeNull();
    expect(view.getByRole("region", { name: "Exploit Risk" })).toBeInTheDocument();
    expect(view.getByRole("region", { name: "통제조건 구현 커버리지" })).toBeInTheDocument();
    expect(view.getByRole("list", { name: "판정 증거 연결" })).toBeInTheDocument();
    expect(view.getByRole("region", { name: "최상위 불일치 대조" })).toHaveTextContent(
      sample.controls[0].evidence_span.quote,
    );
    expect(view.getByRole("region", { name: "최상위 불일치 대조" })).toHaveTextContent(
      leadFinding?.title ?? "",
    );
    expect(view.getByRole("button", { name: "샘플 검증 시작" })).toBeInTheDocument();
    expect(view.getByRole("button", { name: "신규 자산 등록" })).toBeInTheDocument();
  });

  it("keeps verdict then evidence then actions in the 720px DOM contract", () => {
    const view = render(
      <HomeTheater assetId={sample.scan_run.asset_id} assetName="Asset" report={sample} />,
    );
    const grid = view.container.querySelector(".theater-grid");

    expect(Array.from(grid?.children ?? []).map((node) => node.className)).toEqual([
      "theater-verdict",
      "theater-evidence",
      "theater-actions",
    ]);
  });

  it("builds ALERT only from a real evidence link and exposes scan/report deep links", () => {
    const mismatch = sample.mismatches[0];
    const alert = {
      alert_id: "alert_persisted_01",
      asset_id: sample.scan_run.asset_id,
      asset_name: "Asset",
      alert_type: "CRITICAL_CONTROL_MISMATCH",
      severity: "CRITICAL",
      status: "NEW",
      memo: null,
      cause: { mismatch_id: mismatch.mismatch_id },
      evidence_links: mismatch.evidence_links,
      evidence_mode: "REPLAY",
      fixture_version: "0.1.0",
      created_at: "2026-08-28T00:00:00Z",
      updated_at: "2026-08-28T00:00:00Z",
      is_synthetic: true,
    } satisfies AlertSummary;
    const nodes = spineOf(sample, mismatch, sample.scan_run.asset_id, alert);

    expect(nodes.map((node) => node.kind)).toEqual(["SPEC", "CODE", "CHAIN", "ALERT"]);
    expect(nodes.find((node) => node.kind === "CODE")).toMatchObject({
      selected: true,
      href: expect.stringContaining(
        `/scan?scan=${sample.scan_run.scan_id}&finding=${mismatch.finding_id}`,
      ),
    });
    expect(nodes.find((node) => node.kind === "ALERT")).toMatchObject({
      title: "CRITICAL_CONTROL_MISMATCH",
      locator: "alert_persisted_01 · NEW",
      href: `/reports/${sample.report_id}?finding=${mismatch.finding_id}#finding-${mismatch.finding_id}`,
    });

    const withoutAlert = spineOf(sample, mismatch, sample.scan_run.asset_id);
    expect(withoutAlert.some((node) => node.kind === "ALERT")).toBe(false);
  });
});
