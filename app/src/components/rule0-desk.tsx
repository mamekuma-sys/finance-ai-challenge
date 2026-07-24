"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  ActionFactEvent,
  ActionFactSource,
  ActionFactState,
  IncidentState,
} from "@/lib/contracts";
import {
  decideActions,
  type DecisionActionCard,
  type DecisionResult,
} from "@/lib/decision";
import {
  appendActionFact,
  reduceCurrentState,
} from "@/lib/events/action-fact";
import {
  appendTimingSample,
  elapsedMilliseconds,
  summarizeTimings,
} from "@/lib/perf/rule0-timing";
import {
  clearDeskSession,
  loadDeskSession,
  saveDeskSession,
  type EmergencyChoice,
} from "@/lib/session/desk-session";
import {
  INITIAL_INCIDENT_STATE,
} from "@/lib/ui/labels";

import {
  catalogCardMeaning,
  catalogCorrectionMeaning,
  clearActionMeaningCatalog,
  loadActionMeaningCatalog,
  saveActionMeaningCatalog,
  type ActionMeaningCatalog,
} from "./action-meaning-catalog";
import { ActionCardView } from "./action-card";
import { ComparisonView } from "./comparison-view";
import { EmergencyQuestion } from "./emergency-question";
import { ScenarioPicker } from "./scenario-picker";
import type { SyntheticScenario } from "@/lib/scenarios/synthetic";
import { EventHistory } from "./event-history";
import { EvidencePanel } from "./evidence-panel";
import { NextSteps } from "./next-steps";
import { ProhibitionBlock } from "./prohibition-block";
import { StateEditor } from "./state-editor";
import { TrustNotice } from "./trust-notice";

interface Rule0DeskProps {
  verifiedCombinations: number;
  templateReferenceDate?: string;
}

interface ActionEventLedger {
  events: ActionFactEvent[];
  meanings: ActionMeaningCatalog;
}

function stateForEmergencyChoice(choice: EmergencyChoice): IncidentState {
  const state = { ...INITIAL_INCIDENT_STATE };
  if (choice === "sent") {
    state.transfer_state = "already_sent";
  }
  if (choice === "installed") {
    state.device_compromise_state = "suspected_app";
  }
  if (choice === "credentials") {
    state.credential_exposure_state = "shared";
  }
  return state;
}

function eventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function allCards(result: DecisionResult | null): DecisionActionCard[] {
  return result ? [...result.actions, ...result.next_steps] : [];
}

function templateVersions(result: DecisionResult): string[] {
  return [
    ...new Set(
      [...result.actions, ...result.next_steps].flatMap(
        (card) => card.template_versions,
      ),
    ),
  ];
}

function afterNextPaint(callback: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}

export function Rule0Desk({
  verifiedCombinations,
  templateReferenceDate = "2026-07-25",
}: Rule0DeskProps) {
  const [hydrated, setHydrated] = useState(false);
  const [emergencyChoice, setEmergencyChoice] =
    useState<EmergencyChoice | null>(null);
  const [incidentState, setIncidentState] = useState<IncidentState>(
    INITIAL_INCIDENT_STATE,
  );
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [eventLedger, setEventLedger] = useState<ActionEventLedger>({
    events: [],
    meanings: {},
  });
  const { events, meanings: actionMeanings } = eventLedger;
  const [easyMode, setEasyMode] = useState(false);
  const [easyStep, setEasyStep] = useState(0);
  const [nonCallConfirmations, setNonCallConfirmations] = useState<string[]>(
    [],
  );
  const [rule0Samples, setRule0Samples] = useState<number[]>([]);
  const [comparisonSamples, setComparisonSamples] = useState<number[]>([]);
  const [sentAfter, setSentAfter] = useState(true);
  const [addMaliciousApp, setAddMaliciousApp] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [eventError, setEventError] = useState("");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) {
        return;
      }
      const restored = loadDeskSession(window.sessionStorage);
      if (restored) {
        const currentResult = decideActions(restored.incident_state);
        setEmergencyChoice(restored.emergency_choice);
        setIncidentState(restored.incident_state);
        setResult(currentResult);
        setEventLedger({
          events: restored.action_events,
          meanings: loadActionMeaningCatalog(window.sessionStorage),
        });
        setEasyMode(restored.easy_mode);
        setNonCallConfirmations(restored.non_call_confirmations);
        setRule0Samples(restored.rule0_samples_ms);
        setComparisonSamples(restored.comparison_samples_ms);
        setAnnouncement("이 브라우저 세션에 보관된 상태를 복구했습니다.");
      }
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !emergencyChoice || !result) {
      return;
    }
    saveDeskSession(window.sessionStorage, {
      version: 1,
      emergency_choice: emergencyChoice,
      incident_state: incidentState,
      decision_result: result,
      action_events: events,
      template_versions: templateVersions(result),
      easy_mode: easyMode,
      non_call_confirmations: nonCallConfirmations,
      rule0_samples_ms: rule0Samples,
      comparison_samples_ms: comparisonSamples,
    });
    saveActionMeaningCatalog(window.sessionStorage, actionMeanings);
  }, [
    actionMeanings,
    comparisonSamples,
    easyMode,
    emergencyChoice,
    events,
    hydrated,
    incidentState,
    nonCallConfirmations,
    result,
    rule0Samples,
  ]);

  useEffect(() => {
    if (!result) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      setEventLedger((currentLedger) => {
        let nextEvents = currentLedger.events;
        let nextMeanings = currentLedger.meanings;
        for (const card of result.actions) {
          if (reduceCurrentState(nextEvents, card.id) !== null) {
            continue;
          }
          const viewedEventId = eventId();
          nextEvents = appendActionFact(nextEvents, {
            event_id: viewedEventId,
            action_id: card.id,
            event_type: "observation",
            occurred_at: new Date().toISOString(),
            state: "viewed",
            source: "ui_event",
          }).events;
          nextMeanings = catalogCardMeaning(
            nextMeanings,
            viewedEventId,
            card,
          );
        }
        return nextEvents === currentLedger.events
          ? currentLedger
          : { events: nextEvents, meanings: nextMeanings };
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [result]);

  const firstUserStatementAt = useMemo(() => {
    const first = events.find((event) => event.source === "user_statement");
    return first ? new Date(first.occurred_at).getTime() : null;
  }, [events]);

  useEffect(() => {
    if (firstUserStatementAt === null) {
      return;
    }
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [firstUserStatementAt]);

  const elapsedSeconds =
    firstUserStatementAt === null
      ? null
      : Math.max(0, Math.floor((clockNow - firstUserStatementAt) / 1000));

  function recordMeasurement(
    kind: "rule0" | "comparison",
    startedAt: number,
  ) {
    afterNextPaint(() => {
      const elapsed = elapsedMilliseconds(startedAt, performance.now());
      if (kind === "rule0") {
        setRule0Samples((samples) => appendTimingSample(samples, elapsed));
      } else {
        setComparisonSamples((samples) =>
          appendTimingSample(samples, elapsed),
        );
      }
    });
  }

  function chooseEmergency(choice: EmergencyChoice) {
    const startedAt = performance.now();
    const nextState = stateForEmergencyChoice(choice);
    const nextResult = decideActions(nextState);
    setEmergencyChoice(choice);
    setScenarioId(null);
    setIncidentState(nextState);
    setResult(nextResult);
    setEasyStep(0);
    setAnnouncement(
      `지금 할 일 ${nextResult.actions.length}개를 다시 구성했습니다.`,
    );
    recordMeasurement("rule0", startedAt);
  }

  function updateIncidentState(
    key: keyof IncidentState,
    value: IncidentState[keyof IncidentState],
  ) {
    const nextState = { ...incidentState, [key]: value } as IncidentState;
    const nextResult = decideActions(nextState);
    setIncidentState(nextState);
    setResult(nextResult);
    setEasyStep(0);
    setAnnouncement(
      `상태 선택을 반영해 행동 ${nextResult.actions.length}개를 다시 구성했습니다.`,
    );
  }

  /** F-01: 합성 사례를 고르면 6개 상태 필드를 채우고 행동을 다시 구성한다. */
  function chooseScenario(scenario: SyntheticScenario) {
    const startedAt = performance.now();
    const nextState = scenario.suggested_state;
    const nextResult = decideActions(nextState);
    setScenarioId(scenario.scenario_id);
    setEmergencyChoice(null);
    setIncidentState(nextState);
    setResult(nextResult);
    setEasyStep(0);
    setAnnouncement(
      `합성 사례 "${scenario.title}"를 반영해 지금 할 일 ${nextResult.actions.length}개를 구성했습니다.`,
    );
    recordMeasurement("rule0", startedAt);
  }

  function clearScenario() {
    setScenarioId(null);
    setAnnouncement("합성 사례 선택을 해제했습니다. 상태 선택은 그대로 둡니다.");
  }

  function recordAction(
    card: DecisionActionCard,
    state: ActionFactState,
    source: ActionFactSource,
  ) {
    let workingEvents = events;
    let workingMeanings = actionMeanings;
    if (
      state === "dialer_opened" &&
      reduceCurrentState(workingEvents, card.id) === null
    ) {
      const viewedEventId = eventId();
      workingEvents = appendActionFact(workingEvents, {
        event_id: viewedEventId,
        action_id: card.id,
        event_type: "observation",
        occurred_at: new Date().toISOString(),
        state: "viewed",
        source: "ui_event",
      }).events;
      workingMeanings = catalogCardMeaning(
        workingMeanings,
        viewedEventId,
        card,
      );
    }
    const nextEventId = eventId();
    const appendResult = appendActionFact(workingEvents, {
      event_id: nextEventId,
      action_id: card.id,
      event_type: "observation",
      occurred_at: new Date().toISOString(),
      state,
      source,
    });
    if (appendResult.rejected) {
      setEventError(`기록 거부: ${appendResult.rejected.message}`);
      return;
    }
    setEventLedger({
      events: appendResult.events,
      meanings: catalogCardMeaning(
        workingMeanings,
        nextEventId,
        card,
      ),
    });
    setEventError("");
    setAnnouncement("행동 상태를 이 브라우저 세션에 기록했습니다.");
  }

  function correctEvent(target: ActionFactEvent) {
    const correctionEventId = eventId();
    const appendResult = appendActionFact(events, {
      event_id: correctionEventId,
      action_id: target.action_id,
      event_type: "correction",
      corrects_event_id: target.event_id,
      occurred_at: new Date().toISOString(),
      state: target.previous_state ?? "unknown",
      source: "user_statement",
    });
    if (appendResult.rejected) {
      setEventError(`기록 거부: ${appendResult.rejected.message}`);
      return;
    }
    setEventLedger({
      events: appendResult.events,
      meanings: catalogCorrectionMeaning(
        actionMeanings,
        correctionEventId,
        target.event_id,
      ),
    });
    setEventError("");
    setAnnouncement("이전 기록을 삭제하지 않고 정정 기록을 추가했습니다.");
  }

  function toggleNonCall(cardId: string, checked: boolean) {
    setNonCallConfirmations((current) =>
      checked
        ? [...new Set([...current, cardId])]
        : current.filter((id) => id !== cardId),
    );
    setAnnouncement(
      checked
        ? "화면의 행동 확인 표시를 저장했습니다."
        : "화면의 행동 확인 표시를 해제했습니다.",
    );
  }

  function resetSession() {
    clearDeskSession(window.sessionStorage);
    clearActionMeaningCatalog(window.sessionStorage);
    setEmergencyChoice(null);
    setScenarioId(null);
    setIncidentState(INITIAL_INCIDENT_STATE);
    setResult(null);
    setEventLedger({ events: [], meanings: {} });
    setEasyMode(false);
    setEasyStep(0);
    setNonCallConfirmations([]);
    setRule0Samples([]);
    setComparisonSamples([]);
    setAnnouncement("이 브라우저 세션의 상태와 행동 기록을 초기화했습니다.");
    setEventError("");
  }

  function updateComparison(
    setter: (value: boolean) => void,
    value: boolean,
  ) {
    const startedAt = performance.now();
    setter(value);
    setAnnouncement("비교 상태를 다시 구성했습니다.");
    recordMeasurement("comparison", startedAt);
  }

  const visibleActions = result
    ? easyMode
      ? [result.actions[Math.min(easyStep, result.actions.length - 1)]]
      : result.actions
    : [];
  const prohibitions = result
    ? [
        ...new Set(
          allCards(result).flatMap((card) => card.prohibited_actions),
        ),
      ]
    : [];
  const comparisonSummary = summarizeTimings(comparisonSamples);
  const comparisonTimingLabel =
    comparisonSummary.sample_count === 0
      ? "비교 토글을 바꾸면 재구성 시간을 실제로 측정합니다."
      : `이 브라우저 세션 실측값: 최근 ${comparisonSummary.latest_ms?.toFixed(2)}ms · 표본 ${comparisonSummary.sample_count}개 · p95 ${comparisonSummary.p95_ms?.toFixed(2)}ms`;

  return (
    <>
      <a className="skip-link" href="#main-content">
        지금 할 일로 건너뛰기
      </a>
      <div className="trust-strip" role="note">
        <div>
          <span>합성 샘플 3건</span>
          <span>무로그인</span>
          <span>서버 무저장</span>
        </div>
        <div className="header-controls">
          <label className="easy-toggle">
            <input
              type="checkbox"
              checked={easyMode}
              onChange={(event) => {
                setEasyMode(event.currentTarget.checked);
                setEasyStep(0);
              }}
            />
            <span>큰 글씨·쉬운 화면</span>
          </label>
          <button type="button" className="reset-button" onClick={resetSession}>
            초기화
          </button>
        </div>
      </div>

      <header className="brand-header">
        <div className="brand-mark" aria-hidden="true">
          G
        </div>
        <div>
          <strong>골든타임</strong>
          <span>AI 사기대응 상황실</span>
        </div>
      </header>

      <main
        id="main-content"
        className={easyMode ? "desk easy-mode" : "desk"}
      >
        <EmergencyQuestion
          selected={emergencyChoice}
          onSelect={chooseEmergency}
        />

        <ScenarioPicker
          selectedId={scenarioId}
          easyMode={easyMode}
          onSelect={chooseScenario}
          onClear={clearScenario}
        />

        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
        {eventError ? (
          <p className="event-error" role="alert">
            {eventError}
          </p>
        ) : null}

        {result ? (
          <>
            <section
              className="actions-section"
              aria-labelledby="actions-title"
            >
              <div className="section-heading actions-heading">
                <div>
                  <p className="section-kicker">지금 하실 일</p>
                  <h2 id="actions-title" ref={resultHeadingRef}>
                    먼저 이것부터 하세요
                  </h2>
                </div>
                <p>
                  숫자가 행동 순서입니다. 첫 번째 행동을 마친 뒤 다음으로
                  이동하세요.
                </p>
              </div>

              <div className="desk-grid">
                <div className="action-column">
                  <ol className="action-list">
                    {visibleActions.map((card) => (
                      <li key={card.id}>
                        <ActionCardView
                          card={card}
                          easyMode={easyMode}
                          nonCallConfirmed={nonCallConfirmations.includes(
                            card.id,
                          )}
                          currentState={reduceCurrentState(events, card.id)}
                          onRecord={recordAction}
                          onToggleNonCall={toggleNonCall}
                          incidentState={incidentState}
                          onIncidentStateChange={updateIncidentState}
                          templateReferenceDate={templateReferenceDate}
                        />
                      </li>
                    ))}
                  </ol>

                  {easyMode && result.actions.length > 1 ? (
                    <div className="easy-step-navigation">
                      <p>
                        {easyStep + 1} / {result.actions.length} 행동
                      </p>
                      <div>
                        {easyStep > 0 ? (
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() =>
                              setEasyStep((step) => Math.max(0, step - 1))
                            }
                          >
                            이전 행동
                          </button>
                        ) : null}
                        {easyStep < result.actions.length - 1 ? (
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() =>
                              setEasyStep((step) =>
                                Math.min(
                                  result.actions.length - 1,
                                  step + 1,
                                ),
                              )
                            }
                          >
                            다음 행동 보기
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <NextSteps
                    cards={result.next_steps}
                    incidentState={incidentState}
                  />
                </div>

                <div className="sidebar-column">
                  <div className="sticky-sidebar">
                    <ProhibitionBlock items={prohibitions} />
                    <EventHistory
                      events={events}
                      actionMeanings={actionMeanings}
                      elapsedSeconds={elapsedSeconds}
                      onCorrect={correctEvent}
                    />
                  </div>
                </div>
              </div>
            </section>

            <StateEditor
              state={incidentState}
              onChange={updateIncidentState}
            />
            <ComparisonView
              sentAfter={sentAfter}
              addMaliciousApp={addMaliciousApp}
              onSentAfterChange={(value) =>
                updateComparison(setSentAfter, value)
              }
              onMaliciousAppChange={(value) =>
                updateComparison(setAddMaliciousApp, value)
              }
              timingLabel={comparisonTimingLabel}
            />
          </>
        ) : (
          <section className="calm-empty" aria-label="시작 안내">
            <span aria-hidden="true">01</span>
            <p>
              위에서 가장 가까운 상황 하나를 고르면, 첫 행동을 즉시
              보여드립니다.
            </p>
          </section>
        )}

        <EvidencePanel
          verifiedCombinations={verifiedCombinations}
          rule0Samples={rule0Samples}
          comparisonSamples={comparisonSamples}
        />

        <TrustNotice />
      </main>
    </>
  );
}
