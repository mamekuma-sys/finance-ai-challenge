import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { IncidentState } from "@/lib/contracts";
import type {
  DecisionActionCard,
  DecisionResult,
} from "@/lib/decision";
import { DECISION_SNAPSHOT_FIXTURES } from "@/lib/decision/__tests__/snapshot-fixtures";
import {
  saveDeskSession,
  type DeskSessionSnapshot,
} from "@/lib/session/desk-session";

import { ACTION_MEANING_CATALOG_KEY } from "../action-meaning-catalog";
import { Rule0Desk } from "../rule0-desk";

const BASE_STATE: IncidentState = {
  transfer_state: "not_sent",
  device_compromise_state: "none",
  credential_exposure_state: "none",
  personal_data_exposure_state: "none",
  user_role: "self",
  safe_device_available: "yes",
};

const FIELD_OPTIONS = {
  transfer_state: {
    legend: "돈을 보냈나요?",
    values: {
      not_sent: "아직 보내지 않았어요",
      already_sent: "이미 보냈어요",
      unknown: "모르겠어요",
    },
  },
  device_compromise_state: {
    legend: "앱 설치나 원격제어가 있었나요?",
    values: {
      none: "없어요",
      suspected_app: "의심되는 앱을 설치했어요",
      remote_control: "원격제어를 허용했어요",
      unknown: "모르겠어요",
    },
  },
  credential_exposure_state: {
    legend: "비밀번호·인증번호 같은 인증정보가 노출됐나요?",
    values: {
      none: "없어요",
      suspected: "노출됐을 수도 있어요",
      shared: "알려줬어요",
      unknown: "모르겠어요",
    },
  },
  personal_data_exposure_state: {
    legend: "개인정보가 노출됐나요?",
    values: {
      none: "없어요",
      suspected: "노출됐을 수도 있어요",
      shared: "알려줬어요",
      unknown: "모르겠어요",
    },
  },
  user_role: {
    legend: "누구의 상황을 확인하고 있나요?",
    values: {
      self: "제 상황이에요",
      family_proxy: "가족을 도와 확인 중이에요",
    },
  },
  safe_device_available: {
    legend: "의심 기기와 떨어진 안전한 기기를 쓸 수 있나요?",
    values: {
      yes: "쓸 수 있어요",
      no: "지금은 없어요",
      unknown: "모르겠어요",
    },
  },
} as const;

function exactStart(value: string): RegExp {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
}

async function selectState(
  user: ReturnType<typeof userEvent.setup>,
  state: IncidentState,
) {
  const stateEditor = screen
    .getByRole("heading", { name: "아는 만큼만 알려주세요" })
    .closest("section") as HTMLElement;
  for (const key of Object.keys(FIELD_OPTIONS) as Array<
    keyof typeof FIELD_OPTIONS
  >) {
    const config = FIELD_OPTIONS[key];
    const group = within(stateEditor).getByRole("group", {
      name: config.legend,
    });
    const label = (config.values as Record<string, string>)[state[key]];
    await user.click(
      within(group).getByRole("radio", { name: exactStart(label) }),
    );
  }
}

function visibleCardTitles(): string[] {
  return screen.getAllByTestId("action-card").map((card) => {
    return within(card).getByRole("heading", { level: 3 }).textContent ?? "";
  });
}

function installNetworkSpies() {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const xhrSpy = vi.spyOn(XMLHttpRequest.prototype, "send");
  const beaconSpy = vi.fn();
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: beaconSpy,
  });
  return { fetchSpy, xhrSpy, beaconSpy };
}

describe("Rule 0 긴급 진입과 무전송", () => {
  it.each([
    {
      button: "돈을 보냈어요",
      legend: "돈을 보냈나요?",
      label: "이미 보냈어요",
    },
    {
      button: "앱을 설치했어요",
      legend: "앱 설치나 원격제어가 있었나요?",
      label: "의심되는 앱을 설치했어요",
    },
    {
      button: "인증정보를 알려줬어요",
      legend: "비밀번호·인증번호 같은 인증정보가 노출됐나요?",
      label: "알려줬어요",
    },
  ])(
    "$button 한 번으로 초기 상태를 채우고 모델·네트워크 없이 카드를 표시한다",
    async ({ button, legend, label }) => {
      const spies = installNetworkSpies();
      const user = userEvent.setup();
      render(<Rule0Desk verifiedCombinations={1_152} />);

      await user.click(screen.getByRole("button", { name: new RegExp(button) }));

      expect(
        within(screen.getByRole("group", { name: legend })).getByRole(
          "radio",
          { name: exactStart(label) },
        ),
      ).toBeChecked();
      expect(await screen.findAllByTestId("action-card")).not.toHaveLength(0);
      expect(spies.fetchSpy).not.toHaveBeenCalled();
      expect(spies.xhrSpy).not.toHaveBeenCalled();
      expect(spies.beaconSpy).not.toHaveBeenCalled();
    },
  );
});

describe("결정 엔진 결과의 UI 보존", () => {
  const SNAPSHOT_EXPECTATIONS = {
    a: {
      actionTitles: [
        "의심 기기 사용 중지·신뢰할 수 있는 별도 기기 확보",
        "별도 기기에서 해당 금융회사 공식 대표번호 확인·연락",
        "별도 기기에서 112 연락",
        "긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우, 신청한 날부터 3일 이내에 피해구제신청서를 해당 금융회사에 제출해야 합니다.",
      ],
      nextStepTitles: [],
    },
    b: {
      actionTitles: [
        "안전한 별도 기기에서 해당 금융회사 공식 대표번호 확인·연락",
        "안전한 별도 기기에서 112 연락",
        "인증수단 폐기·재발급과 악성 앱 검사 안내 확인",
        "긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우, 신청한 날부터 3일 이내에 피해구제신청서를 해당 금융회사에 제출해야 합니다.",
      ],
      nextStepTitles: [],
    },
    c: {
      actionTitles: [
        "먼저 확인할 것",
        "안전한 기기에서 금융회사 공식 대표번호에 인증정보 노출 통지·보호조치 요청",
        "112에 인증정보 노출 상황 상담",
        "인증수단 폐기·재발급과 본인계좌 보호 수단 확인",
      ],
      nextStepTitles: [
        "공식 대표채널 교차 확인",
        "근거 부족이면 판단 유보와 1332 안내",
      ],
    },
  } as const;
  const acceptanceFixtures = DECISION_SNAPSHOT_FIXTURES.filter(
    (fixture) =>
      fixture.id === "a" || fixture.id === "b" || fixture.id === "c",
  );

  it.each(acceptanceFixtures)(
    "독립 인수 상태 $id의 제목·금지·접힘 수를 리터럴 계약과 대조한다",
    async (fixture) => {
      const user = userEvent.setup();
      render(<Rule0Desk verifiedCombinations={1_152} />);
      await user.click(
        screen.getByRole("button", { name: /해당 없음·모름/ }),
      );
      await selectState(user, fixture.state);

      const expected = SNAPSHOT_EXPECTATIONS[fixture.id];
      expect(visibleCardTitles()).toEqual(expected.actionTitles);

      const prohibition = screen.getByRole("complementary", {
        name: "하지 마세요",
      });
      expect(
        within(prohibition)
          .getAllByRole("listitem")
          .map((item) =>
            (item.textContent ?? "").replace(/^×금지\s*/, ""),
          ),
      ).toEqual(fixture.prohibited_actions);

      const nextStepCards = document.querySelectorAll(
        "[data-next-step-card]",
      );
      expect(nextStepCards).toHaveLength(
        fixture.next_step_merge_keys.length,
      );
      for (const [index, title] of expected.nextStepTitles.entries()) {
        expect(nextStepCards[index]).toHaveTextContent(title);
      }
    },
  );

  it("송금 완료에서 3일 이내 서면 제출·금지 합집합을 보이고 접힌 행동을 소실하지 않는다", async () => {
    const user = userEvent.setup();
    render(<Rule0Desk verifiedCombinations={1_152} />);
    await user.click(screen.getByRole("button", { name: /돈을 보냈어요/ }));

    expect(
      screen.getAllByText(/신청한 날부터 3일 이내/).length,
    ).toBeGreaterThan(0);
    const fixture = DECISION_SNAPSHOT_FIXTURES.find(
      (candidate) => candidate.id === "c",
    );
    expect(fixture).toBeDefined();
    await selectState(user, fixture!.state);
    expect(
      screen.getByText("접힌 다음 행동 (전부 보존됨)"),
    ).toBeInTheDocument();
    for (const [index, title] of SNAPSHOT_EXPECTATIONS.c.nextStepTitles.entries()) {
      expect(
        screen.getByText(`${index + 5}. ${title}`),
      ).toBeInTheDocument();
    }
    expect(
      document.querySelectorAll('a[href="tel:1332"]').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("빈 전화 링크 없이 금융회사 공식 번호 찾기와 실제 기관 전화 링크만 제공한다", async () => {
    const user = userEvent.setup();
    render(<Rule0Desk verifiedCombinations={1_152} />);
    await user.click(screen.getByRole("button", { name: /돈을 보냈어요/ }));

    const fineLink = screen.getByRole("link", {
      name: /내 금융회사 대표번호 찾기/,
    });
    expect(fineLink).toHaveAttribute("href", "https://fine.fss.or.kr");
    expect(fineLink).toHaveAttribute("target", "_blank");
    expect(fineLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.getByText(
        "상대가 알려준 번호가 아니라 카드 뒷면·공식 앱·공식 홈페이지의 대표번호를 사용하세요.",
      ),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('a[href="tel:"]')).toHaveLength(0);
    expect(document.querySelector('a[href="tel:112"]')).not.toBeNull();
    expect(document.querySelector('a[href="tel:1394"]')).not.toBeNull();
  });

  it("접힌 1332 행동에도 바로 전화를 걸 수 있는 링크를 제공한다", async () => {
    const user = userEvent.setup();
    const fixture = DECISION_SNAPSHOT_FIXTURES.find(
      (candidate) => candidate.id === "c",
    );
    expect(fixture?.next_step_merge_keys).toContain("call:1332");

    render(<Rule0Desk verifiedCombinations={1_152} />);
    await user.click(
      screen.getByRole("button", { name: /해당 없음·모름/ }),
    );
    await selectState(user, fixture!.state);

    expect(
      document.querySelectorAll('a[href="tel:1332"]').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("질문 카드 안의 답을 선택하면 같은 상태 소스로 행동 카드와 아래 선택값을 함께 갱신한다", async () => {
    const user = userEvent.setup();
    render(<Rule0Desk verifiedCombinations={1_152} />);
    await user.click(screen.getByRole("button", { name: /돈을 보냈어요/ }));

    const firstCard = screen
      .getAllByTestId("action-card")
      .find((card) => card.dataset.priority === "1") as HTMLElement;
    expect(
      within(firstCard).getByRole("heading", {
        level: 3,
        name: "먼저 확인할 것",
      }),
    ).toBeInTheDocument();
    const questionGroup = within(firstCard).getByRole("group", {
      name: "앱 설치나 원격제어가 있었나요?",
    });
    expect(within(firstCard).queryByText("말할 내용")).not.toBeInTheDocument();
    expect(
      within(firstCard).queryByRole("button", { name: "문구 복사" }),
    ).not.toBeInTheDocument();
    expect(
      within(firstCard).queryByText("이 전화나 확인에서 할 일"),
    ).not.toBeInTheDocument();

    await user.click(
      within(questionGroup).getByRole("radio", {
        name: exactStart("없어요"),
      }),
    );

    await waitFor(() => {
      const updatedFirstCard = screen
        .getAllByTestId("action-card")
        .find((card) => card.dataset.priority === "1") as HTMLElement;
      expect(
        within(updatedFirstCard).queryByRole("heading", {
          level: 3,
          name: "먼저 확인할 것",
        }),
      ).not.toBeInTheDocument();
    });
    const stateEditor = screen
      .getByRole("heading", { name: "아는 만큼만 알려주세요" })
      .closest("section") as HTMLElement;
    expect(
      within(
        within(stateEditor).getByRole("group", {
          name: "앱 설치나 원격제어가 있었나요?",
        }),
      ).getByRole("radio", { name: exactStart("없어요") }),
    ).toBeChecked();
  });

  it("질문 카드를 내부 상태 용어 대신 사용자 질문과 확인 개수로 표시한다", async () => {
    const user = userEvent.setup();
    render(<Rule0Desk verifiedCombinations={1_152} />);
    await user.click(screen.getByRole("button", { name: /돈을 보냈어요/ }));

    expect(
      screen.getByRole("heading", { level: 3, name: "먼저 확인할 것" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".question-card-intro")).toHaveTextContent(
      "먼저 3가지만 확인할게요.",
    );
    expect(
      screen.queryByRole("heading", { name: /미확인|상태 확인 질문/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("미확인 상태 최대 3개 확인"),
    ).not.toBeInTheDocument();
  });
});

describe("행동 이벤트 이력과 고령자 모드", () => {
  it("허용 전이를 기록하고 건너뛴 전이는 거부하며 정정을 append한다", async () => {
    const user = userEvent.setup();
    render(<Rule0Desk verifiedCombinations={1_152} />);
    await user.click(screen.getByRole("button", { name: /돈을 보냈어요/ }));

    await screen.findAllByTestId("action-card");
    const bankLink = screen.getByRole("link", {
      name: /내 금융회사 대표번호 찾기/,
    });
    const bankCard = bankLink.closest("article") as HTMLElement;
    const historyTitle = screen.getByRole("heading", {
      name: "행동 이벤트 이력(내 기기 보관)",
    });
    const history = historyTitle.closest("section");
    expect(history).not.toBeNull();
    await waitFor(() => {
      expect(
        within(history as HTMLElement).getAllByText("카드를 봄").length,
      ).toBeGreaterThan(0);
    });

    await user.click(
      within(bankCard).getByRole("button", {
        name: "통화가 연결됐어요",
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "행동 사실 상태는 허용된 순방향으로만 기록",
    );

    const fineClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    fineClick.preventDefault();
    fireEvent(bankLink, fineClick);
    expect(
      within(history as HTMLElement).queryByText("전화 앱 열기를 선택함"),
    ).not.toBeInTheDocument();

    const dialerLink = screen.getByRole("link", {
      name: /112로 전화 걸기/,
    });
    const phoneCard = dialerLink.closest("article") as HTMLElement;
    const canceledClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    canceledClick.preventDefault();
    fireEvent(
      dialerLink,
      canceledClick,
    );
    await waitFor(() =>
      expect(
        within(history as HTMLElement).getByText(
          "전화 앱 열기를 선택함",
        ),
      ).toBeInTheDocument(),
    );

    for (const [button, stateText] of [
      ["통화가 연결됐어요", "통화가 연결됐다고 확인함"],
      ["요청을 전달했어요", "요청을 전달했다고 확인함"],
      ["기관 접수를 확인했어요", "기관 접수를 확인했다고 진술함"],
    ] as const) {
      await user.click(
        within(phoneCard).getByRole("button", { name: button }),
      );
      await waitFor(() =>
        expect(
          within(history as HTMLElement).getByText(stateText),
        ).toBeInTheDocument(),
      );
    }

    const undoButtons = within(history as HTMLElement).getAllByRole("button", {
      name: "되돌리기",
    });
    await user.click(undoButtons.at(-1) as HTMLButtonElement);
    expect(
      within(history as HTMLElement).getByText(/정정 — 기록/),
    ).toBeInTheDocument();
    expect(
      within(history as HTMLElement).getAllByText("자동 관측").length,
    ).toBeGreaterThan(0);
    expect(
      within(history as HTMLElement).getAllByText("사용자 진술").length,
    ).toBeGreaterThan(0);
  });

  it("상태 변경 뒤에도 사용자 진술 당시 112 행동 제목을 세션 카탈로그에서 유지한다", async () => {
    const user = userEvent.setup();
    const priorState: IncidentState = {
      ...BASE_STATE,
      credential_exposure_state: "shared",
    };
    render(<Rule0Desk verifiedCombinations={1_152} />);
    await user.click(
      screen.getByRole("button", { name: /해당 없음·모름/ }),
    );
    await selectState(user, priorState);

    const priorHeading = screen.getByRole("heading", {
      level: 3,
      name: "112에 인증정보 노출 상황 상담",
    });
    const phoneCard = priorHeading.closest("article") as HTMLElement;
    const dialerLink = within(phoneCard).getByRole("link", {
      name: /112로 전화 걸기/,
    });
    const canceledClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    canceledClick.preventDefault();
    fireEvent(dialerLink, canceledClick);
    await user.click(
      within(phoneCard).getByRole("button", {
        name: "통화가 연결됐어요",
      }),
    );
    await user.click(
      within(phoneCard).getByRole("button", {
        name: "요청을 전달했어요",
      }),
    );

    const stateEditor = screen
      .getByRole("heading", { name: "아는 만큼만 알려주세요" })
      .closest("section") as HTMLElement;
    const transferGroup = within(stateEditor).getByRole("group", {
      name: "돈을 보냈나요?",
    });
    await user.click(
      within(transferGroup).getByRole("radio", {
        name: exactStart("이미 보냈어요"),
      }),
    );

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "112 신고·지급정지 연계 요청",
      }),
    ).toBeInTheDocument();
    const history = screen
      .getByRole("heading", {
        name: "행동 이벤트 이력(내 기기 보관)",
      })
      .closest("section") as HTMLElement;
    const requestedEvent = within(history)
      .getByText("요청을 전달했다고 확인함")
      .closest("li") as HTMLElement;
    expect(requestedEvent).toHaveTextContent(
      "112에 인증정보 노출 상황 상담",
    );
    expect(requestedEvent).not.toHaveTextContent(
      "112 신고·지급정지 연계 요청",
    );
    await waitFor(() => {
      const stored = window.sessionStorage.getItem(
        ACTION_MEANING_CATALOG_KEY,
      );
      expect(stored).toContain("112에 인증정보 노출 상황 상담");
      expect(stored).toContain("112 인증정보 노출 상담");
      expect(stored).toContain("TPL-CREDENTIAL-RECOVERY-001@1.0");
    });
  });

  it("큰 글씨·쉬운 화면에서 한 카드만 보이고 본문 20px·행동 56px를 적용한다", async () => {
    const user = userEvent.setup();
    render(<Rule0Desk verifiedCombinations={1_152} />);
    await user.click(screen.getByRole("button", { name: /돈을 보냈어요/ }));
    await user.click(screen.getByLabelText("큰 글씨·쉬운 화면"));

    const main = document.querySelector("main");
    const primary = document.querySelector(
      ".primary-action, .primary-check, .question-card-fields .radio-option label",
    );
    expect(main).toHaveClass("easy-mode");
    expect(screen.getAllByTestId("action-card")).toHaveLength(1);
    expect(primary).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "다음 행동 보기" }),
    ).toHaveClass("secondary-button");
  });

  it("sessionStorage의 상태·카드·모드를 새 렌더에서 복구한다", async () => {
    const state: IncidentState = {
      ...BASE_STATE,
      transfer_state: "already_sent",
    };
    const snapshot: DeskSessionSnapshot = {
      version: 1,
      emergency_choice: "sent",
      incident_state: state,
      decision_result: { actions: [], next_steps: [] },
      action_events: [],
      template_versions: ["TPL-BANK-STOP-001@1.0"],
      easy_mode: true,
      non_call_confirmations: [],
      rule0_samples_ms: [14.2],
      comparison_samples_ms: [9.8],
    };
    saveDeskSession(window.sessionStorage, snapshot);

    render(<Rule0Desk verifiedCombinations={1_152} />);
    expect(
      await screen.findByText("이 브라우저 세션 실측값: 최근 9.80ms", {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("큰 글씨·쉬운 화면")).toBeChecked();
    expect(screen.getAllByTestId("action-card")).toHaveLength(1);
  });

  it("저장된 과거 결정 결과 대신 현재 엔진으로 카드를 다시 계산한다", async () => {
    const staleDeadline = ["3", "영업일"].join("");
    const staleTemplateVersion = [
      "TPL-WRITTEN-FOLLOWUP-001@1",
      ".0",
    ].join("");
    const state: IncidentState = {
      ...BASE_STATE,
      transfer_state: "already_sent",
    };
    const staleCard: DecisionActionCard = {
      id: "action:procedure:written_followup",
      priority: 1,
      title: `전화 신청 시 ${staleDeadline} 이내 서면 신청`,
      severity: 3,
      order: 3,
      forced: true,
      rule_ids: ["R3"],
      merge_key: "procedure:written_followup",
      trigger: ["stored-stale-value"],
      prerequisite: [],
      purpose_slots: [`${staleDeadline} 이내 서면 신청`],
      do_not_show_when: [],
      prohibited_actions: [],
      required_followup: [`${staleDeadline} 이내 서면 신청`],
      official_sources: [],
      template_versions: [staleTemplateVersion],
    };
    const staleResult: DecisionResult = {
      actions: [staleCard],
      next_steps: [],
    };
    const snapshot: DeskSessionSnapshot = {
      version: 1,
      emergency_choice: "sent",
      incident_state: state,
      decision_result: staleResult,
      action_events: [],
      template_versions: [staleTemplateVersion],
      easy_mode: false,
      non_call_confirmations: [],
      rule0_samples_ms: [],
      comparison_samples_ms: [],
    };
    saveDeskSession(window.sessionStorage, snapshot);

    render(<Rule0Desk verifiedCombinations={1_152} />);

    const currentTitle =
      "긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우, 신청한 날부터 3일 이내에 피해구제신청서를 해당 금융회사에 제출해야 합니다.";
    await waitFor(() => {
      expect(visibleCardTitles()).toContain(currentTitle);
    });
    expect(
      visibleCardTitles().some((title) => title.includes(staleDeadline)),
    ).toBe(false);
  });
});
