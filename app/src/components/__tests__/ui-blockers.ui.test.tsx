import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  DEVICE_COMPROMISE_STATES,
  EXPOSURE_STATES,
  SAFE_DEVICE_AVAILABILITIES,
  TRANSFER_STATES,
  USER_ROLES,
  type IncidentState,
} from "@/lib/contracts";
import {
  decideActions,
  type DecisionActionCard,
} from "@/lib/decision";
import { OFFICIAL_SOURCES } from "@/lib/decision/sources";

import { ActionCardView } from "../action-card";
import { NextSteps } from "../next-steps";
import { Rule0Desk } from "../rule0-desk";

const TEMPLATE_REFERENCE_DATE = "2026-07-25";
const SAFE_DEVICE_CALL_TEXT =
  "전화 상담은 의심 기기와 분리된 안전한 기기에서 하세요.";
const PHONE_MERGE_KEYS = new Set([
  "call:112",
  "call:1332",
  "procedure:written_followup",
]);

const BASE_STATE: IncidentState = {
  transfer_state: "not_sent",
  device_compromise_state: "none",
  credential_exposure_state: "none",
  personal_data_exposure_state: "none",
  user_role: "self",
  safe_device_available: "yes",
};

function cardFor(
  state: IncidentState,
  mergeKey: string,
): DecisionActionCard {
  const result = decideActions(state);
  const card = [...result.actions, ...result.next_steps].find(
    (candidate) => candidate.merge_key === mergeKey,
  );
  if (!card) {
    throw new Error(`테스트 카드가 없습니다: ${mergeKey}`);
  }
  return card;
}

function renderActionCard(
  card: DecisionActionCard,
  state: IncidentState,
  onRecord = vi.fn(),
) {
  render(
    <ActionCardView
      card={card}
      easyMode={false}
      nonCallConfirmed={false}
      currentState={null}
      onRecord={onRecord}
      onToggleNonCall={vi.fn()}
      incidentState={state}
      onIncidentStateChange={vi.fn()}
      templateReferenceDate={TEMPLATE_REFERENCE_DATE}
    />,
  );
  return onRecord;
}

describe("B1 서면 제출 카드 행동 의미", () => {
  it("제출 안내를 1차로 열고 1394를 안전 기기 전제가 있는 비상태환원 2차 행동으로 둔다", async () => {
    const user = userEvent.setup();
    const state: IncidentState = {
      ...BASE_STATE,
      transfer_state: "already_sent",
      device_compromise_state: "remote_control",
    };
    const card = cardFor(state, "procedure:written_followup");
    const onRecord = renderActionCard(card, state);

    const primary = screen.getByRole("link", {
      name: /피해구제신청서 제출 방법 확인/,
    });
    expect(primary).toHaveClass("primary-action");
    expect(primary).toHaveAttribute(
      "href",
      OFFICIAL_SOURCES["SRC-EASYLAW-STOPPAY"].url,
    );
    expect(primary).toHaveAttribute("target", "_blank");

    const consultation = screen.getByRole("link", {
      name: /1394에 절차 상담하기/,
    });
    expect(consultation).toHaveClass("secondary-action-link");
    expect(consultation).toHaveAttribute("href", "tel:1394");
    expect(screen.queryByText("1394로 전화 걸기")).not.toBeInTheDocument();
    expect(screen.getByText(SAFE_DEVICE_CALL_TEXT)).toBeInTheDocument();
    expect(
      screen.getByText(/위 체크는 화면 확인 상태입니다/),
    ).toBeInTheDocument();

    const canceledClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    canceledClick.preventDefault();
    fireEvent(consultation, canceledClick);
    expect(onRecord).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", {
        name: "피해구제신청서를 금융회사에 제출했다고 확인했어요",
      }),
    );
    expect(onRecord).toHaveBeenCalledWith(
      card,
      "user_reported_requested",
      "user_statement",
    );
  });
});

describe("B2 전화 행동 안전 기기 전제", () => {
  it(
    "1,152개 상태 조합에서 위험·미확인 기기의 모든 tel 링크와 안전 기기 안내를 같은 카드에 렌더한다",
    () => {
      let combinationCount = 0;
      let telephoneLinkCount = 0;

      for (const transfer_state of TRANSFER_STATES) {
        for (const device_compromise_state of DEVICE_COMPROMISE_STATES) {
          for (const credential_exposure_state of EXPOSURE_STATES) {
            for (const personal_data_exposure_state of EXPOSURE_STATES) {
              for (const user_role of USER_ROLES) {
                for (const safe_device_available of SAFE_DEVICE_AVAILABILITIES) {
                  const state: IncidentState = {
                    transfer_state,
                    device_compromise_state,
                    credential_exposure_state,
                    personal_data_exposure_state,
                    user_role,
                    safe_device_available,
                  };
                  combinationCount += 1;
                  const result = decideActions(state);
                  const actionPhoneCards = result.actions.filter((card) =>
                    PHONE_MERGE_KEYS.has(card.merge_key),
                  );
                  const nextPhoneCards = result.next_steps.filter((card) =>
                    PHONE_MERGE_KEYS.has(card.merge_key),
                  );
                  const markup = renderToStaticMarkup(
                    <div>
                      {actionPhoneCards.map((card) => (
                        <ActionCardView
                          card={card}
                          easyMode={false}
                          nonCallConfirmed={false}
                          currentState={null}
                          onRecord={() => undefined}
                          onToggleNonCall={() => undefined}
                          incidentState={state}
                          onIncidentStateChange={() => undefined}
                          templateReferenceDate={TEMPLATE_REFERENCE_DATE}
                          key={card.id}
                        />
                      ))}
                      <NextSteps
                        cards={nextPhoneCards}
                        incidentState={state}
                      />
                    </div>,
                  );

                  if (
                    device_compromise_state === "none"
                  ) {
                    continue;
                  }
                  const container = document.createElement("div");
                  container.innerHTML = markup;
                  const telephoneLinks =
                    container.querySelectorAll<HTMLAnchorElement>(
                      'a[href^="tel:"]',
                    );
                  telephoneLinkCount += telephoneLinks.length;
                  for (const link of telephoneLinks) {
                    const cardContainer = link.closest(
                      '[data-testid="action-card"], [data-next-step-card]',
                    );
                    expect(cardContainer).not.toBeNull();
                    expect(
                      cardContainer?.querySelector(
                        '[data-safe-device-call="true"]',
                      ),
                    ).toHaveTextContent(SAFE_DEVICE_CALL_TEXT);
                  }
                }
              }
            }
          }
        }
      }

      expect(combinationCount).toBe(1_152);
      expect(telephoneLinkCount).toBeGreaterThan(0);
    },
    30_000,
  );
});

describe("B4 템플릿 UI 게이트", () => {
  it("시행일 미확인 템플릿의 본문·승인 배지를 숨기고 상태 이유와 버전은 보존한다", () => {
    const state: IncidentState = {
      ...BASE_STATE,
      device_compromise_state: "suspected_app",
      safe_device_available: "no",
    };
    const card = cardFor(state, "device:isolate");
    renderActionCard(card, state);

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "의심 기기 사용 중지·신뢰할 수 있는 별도 기기 확보",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "의심 기기의 사용을 중지하고, 그 기기와 분리된 안전한 기기에서 공식 대표번호를 확인하세요.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("승인된 고정 문구")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "이 문구는 출처 시행일 확인 전이라 표시하지 않습니다.",
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-template-status="unconfirmed"]'),
    ).not.toBeNull();
    expect(document.querySelector(".order-details")).toHaveTextContent(
      "TPL-SAFE-DEVICE-001@1.0",
    );
  });

  it("재검토 기한이 지난 템플릿도 본문·승인 배지 없이 만료 이유를 표시한다", () => {
    const state: IncidentState = {
      ...BASE_STATE,
      transfer_state: "already_sent",
    };
    const card = cardFor(state, "call:bank_fraud");
    render(
      <ActionCardView
        card={card}
        easyMode={false}
        nonCallConfirmed={false}
        currentState={null}
        onRecord={vi.fn()}
        onToggleNonCall={vi.fn()}
        incidentState={state}
        onIncidentStateChange={vi.fn()}
        templateReferenceDate="2026-09-02"
      />,
    );

    expect(
      screen.queryByText(
        "해당 금융회사 공식 대표번호로 연락해 사기이용계좌 지급정지를 요청하세요.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("승인된 고정 문구")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "이 문구는 재검토 기한이 지나 표시하지 않습니다.",
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-template-status="expired"]'),
    ).not.toBeNull();
  });
});

describe("B5 정직한 현재 기능 표시", () => {
  it("첫 화면을 구조화 상태 선택 데모로만 표시한다", () => {
    render(
      <Rule0Desk
        verifiedCombinations={1_152}
        templateReferenceDate={TEMPLATE_REFERENCE_DATE}
      />,
    );
    expect(
      screen.getByText("구조화 상태 선택 데모"),
    ).toBeInTheDocument();
    expect(screen.queryByText("합성 샘플")).not.toBeInTheDocument();
  });
});

describe("B6 접힌 카드 표현 동형화", () => {
  it("후속·출처·버전·금지 필드를 구조적으로 보존하고 서면 제출 행동 순서를 유지한다", () => {
    const state: IncidentState = {
      ...BASE_STATE,
      transfer_state: "already_sent",
      device_compromise_state: "unknown",
    };
    const card = {
      ...cardFor(state, "procedure:written_followup"),
      priority: 5,
    };
    render(<NextSteps cards={[card]} incidentState={state} />);

    const foldedCard = document.querySelector(
      '[data-next-step-card="action:procedure:written_followup"]',
    ) as HTMLElement;
    expect(foldedCard).not.toBeNull();
    for (const field of [
      "purpose_slots",
      "prerequisite",
      "required_followup",
      "official_sources",
      "do_not_show_when",
      "prohibited_actions",
      "template_versions",
    ]) {
      expect(
        foldedCard.querySelector(`[data-card-field="${field}"]`),
      ).not.toBeNull();
    }
    expect(
      within(foldedCard).getByRole("link", {
        name: /피해구제신청서 제출 방법 확인/,
      }),
    ).toHaveAttribute(
      "href",
      OFFICIAL_SOURCES["SRC-EASYLAW-STOPPAY"].url,
    );
    expect(
      within(foldedCard).getByRole("link", {
        name: /1394에 절차 상담하기/,
      }),
    ).toHaveAttribute("href", "tel:1394");
    expect(foldedCard).toHaveTextContent(SAFE_DEVICE_CALL_TEXT);
    expect(foldedCard).toHaveTextContent("경찰청·대한민국 정책브리핑");
    expect(foldedCard).toHaveTextContent(
      "본인계좌 일괄지급정지를 상대 계좌 지급정지의 대체로 여기지 마세요.",
    );
    expect(
      within(foldedCard).getByText("왜 이 순서인가"),
    ).toBeInTheDocument();
  });
});
