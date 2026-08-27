import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CodeView } from "../code-view";

const SOURCE = `contract VulnerableRwaToken {
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}`;

describe("CodeView", () => {
  it("renders every source line", async () => {
    // Shiki가 줄을 토큰 span으로 쪼개므로 줄 단위 textContent로 확인한다.
    const { container } = render(
      await CodeView({ source: SOURCE, startLine: 21, file: "VulnerableRwaToken.sol" }),
    );

    const lines = [...container.querySelectorAll(".code-view-line")].map(
      (line) => line.textContent ?? "",
    );

    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain("contract VulnerableRwaToken");
    expect(lines[2]).toContain("_mint(to, amount);");
  });

  it("numbers lines from the given start so file line numbers match the finding", async () => {
    render(await CodeView({ source: SOURCE, startLine: 21, file: "VulnerableRwaToken.sol" }));

    expect(screen.getByText("21")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("anchors each line so a CodeFinding can link straight to it", async () => {
    const { container } = render(
      await CodeView({ source: SOURCE, startLine: 21, file: "VulnerableRwaToken.sol" }),
    );

    // id에 점이 있어 CSS selector 이스케이프가 필요하므로 getElementById로 조회한다.
    expect(container.ownerDocument.getElementById("VulnerableRwaToken.sol-L23")).toHaveTextContent(
      "_mint(to, amount);",
    );
  });

  it("marks the highlighted range so the finding line stands out", async () => {
    const { container } = render(
      await CodeView({
        source: SOURCE,
        startLine: 21,
        file: "VulnerableRwaToken.sol",
        highlight: { start: 22, end: 24 },
      }),
    );

    const marked = container.querySelectorAll('[data-highlighted="true"]');
    expect(marked).toHaveLength(3);
  });

  it("stays read-only — no editable surface is rendered", async () => {
    render(await CodeView({ source: SOURCE, startLine: 21, file: "VulnerableRwaToken.sol" }));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
