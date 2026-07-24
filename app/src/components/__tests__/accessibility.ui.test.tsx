import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as axe from "axe-core";
import { describe, expect, it } from "vitest";

import { Rule0Desk } from "../rule0-desk";

describe("사기대응 데스크 자동 접근성 점검", () => {
  it("긴급 행동 렌더 뒤 axe WCAG A·AA 위반이 없다", async () => {
    document.documentElement.lang = "ko";
    document.title = "골든타임 | AI 사기대응 상황실";
    const user = userEvent.setup();
    render(<Rule0Desk verifiedCombinations={1_152} />);
    await user.click(screen.getByRole("button", { name: /돈을 보냈어요/ }));
    await screen.findAllByTestId("action-card");

    const result = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: [
          "wcag2a",
          "wcag2aa",
          "wcag21a",
          "wcag21aa",
          "wcag22aa",
        ],
      },
      rules: {
        "color-contrast": { enabled: false },
      },
    });

    expect(
      result.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.length,
      })),
    ).toEqual([]);
  });
});
