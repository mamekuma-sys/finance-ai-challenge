import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EvidenceSpine } from "../evidence-spine";
import { toSpineNodes } from "@/lib/evidence-report";
import { DEMO_REPORT } from "@/test/evidence-report-fixture";

const NODES = toSpineNodes(DEMO_REPORT, "mismatch_max_supply_01");

describe("EvidenceSpine", () => {
  it("reads document to code to chain to alert, top to bottom", () => {
    render(<EvidenceSpine nodes={NODES} />);

    const labels = screen.getAllByText(/^(SPEC|CODE|CHAIN|ALERT)$/).map((el) => el.textContent);
    expect(labels).toEqual(["SPEC", "CODE", "CHAIN", "ALERT"]);
  });

  it("shows a locator for every stage so the evidence can be checked", () => {
    render(<EvidenceSpine nodes={NODES} />);

    for (const node of NODES) {
      expect(screen.getByText(node.locator)).toBeInTheDocument();
    }
  });

  it("renders nothing but an empty list when there is no evidence chain", () => {
    render(<EvidenceSpine nodes={[]} />);
    expect(screen.getByRole("list")).toBeEmptyDOMElement();
  });
});
