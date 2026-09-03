import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { RiskRuler } from "@/components/risk-ruler";
import type { EvidenceReport, ExploitRisk } from "@/types/ui";

const sample = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "../../contracts/examples/evidence-report.sample.json"),
    "utf8",
  ),
) as EvidenceReport;

/** 실제 계약 shape을 그대로 쓰고 기여 원인 수만 바꾼다. */
function riskWith(count: number): ExploitRisk {
  const base = sample.exploit_risk!;
  return { ...base, contributors: base.contributors!.slice(0, count) };
}

afterEach(cleanup);

describe("Exploit Risk 상위 원인", () => {
  it("목록이 잘렸으면 전체 개수를 함께 밝힌다", () => {
    render(<RiskRuler risk={riskWith(3)} />);

    // 화면에는 상위 2개만 나오지만 서버는 3개를 계산했다.
    expect(screen.getByText("상위 원인 2 / 전체 3")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Exploit Risk 상위 기여 원인" })
      .querySelectorAll("li")).toHaveLength(2);
  });

  it("잘리지 않았으면 전체 목록임을 밝힌다", () => {
    render(<RiskRuler risk={riskWith(2)} />);

    expect(screen.getByText("상위 원인 2")).toBeInTheDocument();
    expect(screen.queryByText(/전체/)).not.toBeInTheDocument();
  });

  it("기여 원인이 없으면 머리글도 두지 않는다", () => {
    render(<RiskRuler risk={riskWith(0)} />);

    expect(screen.queryByText(/상위 원인/)).not.toBeInTheDocument();
  });

  it("compact 모드에서도 같은 표기를 유지한다", () => {
    render(<RiskRuler risk={riskWith(3)} compact />);

    expect(screen.getByText("상위 원인 2 / 전체 3")).toBeInTheDocument();
  });
});
