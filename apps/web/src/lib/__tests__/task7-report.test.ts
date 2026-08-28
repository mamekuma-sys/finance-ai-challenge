import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import { reportDisclosureOf } from "@/lib/report-disclosure";
import type { EvidenceReport } from "@/types/ui";

const report = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../contracts/examples/evidence-report.sample.json"), "utf8"),
) as EvidenceReport;

describe("Task7 report disclosure view model", () => {
  test("carries immutable lineage, merged limitations, and reviewer wording into HTML rendering", () => {
    const model = reportDisclosureOf(report, [
      ...report.lineage.limitations,
      "응답 envelope 제한",
    ]);

    expect(model.inputHashes).toEqual(report.lineage.input_hashes);
    expect(model.ruleVersions).toEqual(report.lineage.rule_versions);
    expect(model.limitations).toEqual([
      ...report.lineage.limitations,
      "응답 envelope 제한",
    ]);
    expect(model.reviewerNotice).toContain("담당자 검토가 필요합니다");
    expect(model.reviewerNotice).toContain("자동 발행 승인");
  });
});
