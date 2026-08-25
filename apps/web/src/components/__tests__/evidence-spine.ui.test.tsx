import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { demoFinding } from "@/lib/demo-finding";
import { EvidenceSpine } from "../evidence-spine";

describe("EvidenceSpine", () => {
  it("renders every evidence stage and locator", () => {
    render(<EvidenceSpine nodes={demoFinding.spine} />);

    for (const node of demoFinding.spine) {
      expect(screen.getByText(node.kind)).toBeInTheDocument();
      expect(screen.getByText(node.locator)).toBeInTheDocument();
    }
  });
});
