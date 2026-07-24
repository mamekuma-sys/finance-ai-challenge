import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EvidencePanel } from "../evidence-panel";
import { EventHistory } from "../event-history";

describe("r5 승인 근거 UI", () => {
  it("E5·E1·E3·E10 승인 문자열과 필수 조건만 표시한다", () => {
    render(
      <EvidencePanel
        verifiedCombinations={1_152}
        rule0Samples={[]}
        comparisonSamples={[]}
      />,
    );

    const panel = screen.getByRole("region", { name: "왜 이 서비스인가" });
    expect(panel).toHaveTextContent(
      "2025년 10월~2026년 4월 보이스피싱 발생 건수는 전년 동기 14,461건에서 9,353건으로, 피해액은 7,632억 원에서 4,936억 원으로 각각 35.3% 감소했습니다.",
    );
    expect(panel).toHaveTextContent(
      "1회에 100만 원 이상이 송금·이체되어 입금된 경우, 입금된 때부터 해당 금액 상당액 범위에서 30분간 CD/ATM을 통한 인출·이체가 지연됩니다.",
    );
    expect(panel).toHaveTextContent("창구 거래는 즉시 가능");
    expect(panel).toHaveTextContent(
      "개별 사건의 잔여 시간·회수 가능성을 뜻하지 않",
    );
    expect(panel).toHaveTextContent(
      "긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우, 신청한 날부터 3일 이내에 피해구제신청서를 해당 금융회사에 제출해야 합니다.",
    );
    expect(panel).toHaveTextContent(
      "1394 — 전기통신금융사기 통합대응단의 피해상담, 의심 전화번호·사이트 제보, 관계기관 연계",
    );
    expect(panel).toHaveTextContent(
      "1332 — 금융감독원의 금융상담과 보이스피싱 피해상담·접수·구제 안내",
    );
    expect(withinEvidenceList(panel)).toHaveLength(4);
  });

  it("경과 타이머 옆에 E1 승인 문자열과 두 한계를 함께 표시한다", () => {
    render(
      <EventHistory
        events={[]}
        actionMeanings={{}}
        elapsedSeconds={null}
        onCorrect={vi.fn()}
      />,
    );

    const history = screen.getByRole("region", {
      name: "행동 이벤트 이력(내 기기 보관)",
    });
    expect(history).toHaveTextContent(
      "1회에 100만 원 이상이 송금·이체되어 입금된 경우, 입금된 때부터 해당 금액 상당액 범위에서 30분간 CD/ATM을 통한 인출·이체가 지연됩니다.",
    );
    expect(history).toHaveTextContent("창구 거래는 즉시 가능");
    expect(history).toHaveTextContent(
      "개별 사건의 잔여 시간·회수 가능성을 뜻하지 않",
    );
  });

  it("의미 카탈로그가 없는 과거 이벤트를 현재 카드로 재라벨링하지 않는다", () => {
    render(
      <EventHistory
        events={[
          {
            event_id: "event-without-preserved-title",
            action_id: "action:call:112",
            event_type: "observation",
            occurred_at: "2026-07-25T00:00:00.000Z",
            state: "user_reported_requested",
            source: "user_statement",
            previous_state: "user_reported_connected",
          },
        ]}
        actionMeanings={{}}
        elapsedSeconds={0}
        onCorrect={vi.fn()}
      />,
    );

    expect(
      screen.getByText("기록 당시 행동(제목 미보존)"),
    ).toBeInTheDocument();
    expect(screen.queryByText("현재 화면의 행동")).not.toBeInTheDocument();
  });
});

function withinEvidenceList(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll(".evidence-list > li"));
}
