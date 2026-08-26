import "@testing-library/jest-dom/vitest";
import axe from "axe-core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AssetDetailPage from "../assets/[id]/page";
import DocumentPage from "../assets/[id]/document/page";
import ScanPage from "../assets/[id]/scan/page";
import HomePage from "../page";
import ReportPage from "../reports/[id]/page";

const params = Promise.resolve({ id: "asset_synthetic_hanriver_01" });
const noSearch = Promise.resolve({});

const SCREENS = [
  { name: "S1 관제 홈", render: () => HomePage({ searchParams: noSearch }) },
  { name: "S3 발행조건 검토", render: () => DocumentPage({ params, searchParams: noSearch }) },
  { name: "S4 컨트랙트 검증", render: () => ScanPage({ params, searchParams: noSearch }) },
  { name: "S5 자산 상세", render: () => AssetDetailPage({ params, searchParams: noSearch }) },
  { name: "S6 리포트", render: () => ReportPage({ params, searchParams: noSearch }) },
];

describe("axe 하네스 자체 검증", () => {
  // 위 화면들이 위반 0건으로 통과하므로, 하네스가 조용히 빈 결과를 내는 것이
  // 아니라 실제로 위반을 잡는다는 것을 알려진 위반으로 확인한다.
  it("reports a violation for a known-bad fragment", async () => {
    // alt 없는 img는 의도된 위반이다. axe가 이걸 잡아야 위 화면들의
    // "위반 0건"이 하네스 침묵이 아니라 실제 결과임을 알 수 있다.
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    const { container } = render(<img src="x.png" />);

    const results = await axe.run(container);

    expect(results.violations.map((violation) => violation.id)).toContain("image-alt");
  });
});

describe("P0 화면 접근성", () => {
  for (const screenUnderTest of SCREENS) {
    it(`${screenUnderTest.name} has no axe violations`, async () => {
      const { container } = render(await screenUnderTest.render());

      const results = await axe.run(container, {
        rules: { "color-contrast": { enabled: false } },
      });

      expect(results.violations.map((violation) => violation.id)).toEqual([]);
    });
  }
});
