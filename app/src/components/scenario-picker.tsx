"use client";

import { SYNTHETIC_SCENARIOS, type SyntheticScenario } from "@/lib/scenarios/synthetic";

interface ScenarioPickerProps {
  selectedId: string | null;
  easyMode: boolean;
  onSelect: (scenario: SyntheticScenario) => void;
  onClear: () => void;
}

const CHANNEL_LABEL: Record<string, string> = {
  sms: "문자",
  messenger: "메신저",
  call_transcript: "통화",
  email: "이메일",
  web: "웹",
  other: "기타",
};

export function ScenarioPicker({
  selectedId,
  easyMode,
  onSelect,
  onClear,
}: ScenarioPickerProps) {
  const selected =
    SYNTHETIC_SCENARIOS.find((s) => s.scenario_id === selectedId) ?? null;

  return (
    <section className="scenario-picker" aria-labelledby="scenario-title">
      <p className="section-kicker">검수된 합성 사례</p>
      <h2 id="scenario-title">비슷한 사례로 시작해도 됩니다</h2>
      <p className="scenario-intro">
        아래 세 건은 공개 기관 자료의 수법을 다시 쓴{" "}
        <strong>합성 사례</strong>입니다. 실제 사건·실제 연락처가 아닙니다.
        하나를 고르면 아래 상태 질문이 그 상황에 맞게 채워지고, 값은 언제든
        바꿀 수 있습니다.{" "}
        <strong>AI 판정은 현재 배포본에서 제공하지 않습니다.</strong>
      </p>

      <ul className="scenario-list">
        {SYNTHETIC_SCENARIOS.map((scenario) => {
          const isSelected = scenario.scenario_id === selectedId;
          return (
            <li key={scenario.scenario_id}>
              <button
                type="button"
                className="scenario-option"
                aria-pressed={isSelected}
                onClick={() => onSelect(scenario)}
              >
                <span className="scenario-badges">
                  <span className="badge-synthetic">합성</span>
                  <span className="badge-channel">
                    {CHANNEL_LABEL[scenario.channel] ?? scenario.channel}
                  </span>
                  {isSelected ? (
                    <span className="selected-label">선택됨</span>
                  ) : null}
                </span>
                <strong>{scenario.title}</strong>
                <small>{scenario.summary}</small>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <div className="scenario-detail" aria-live="polite">
          <div className="scenario-detail-head">
            <h3>{selected.title}</h3>
            <button type="button" className="ghost-button" onClick={onClear}>
              사례 선택 해제
            </button>
          </div>

          <p className="scenario-synthetic-note">
            이 내용은 전부 합성입니다. 전화번호는 더미(010-0000-0000), 주소는
            존재하지 않는 <code>.invalid</code> 도메인이며 링크는 누를 수 없게
            표기했습니다.
          </p>

          <pre className="scenario-body">{selected.body}</pre>

          {!easyMode ? (
            <>
              <h4>이 사례에서 눈여겨볼 신호</h4>
              <ul className="scenario-signals">
                {selected.warning_signals.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
              <p className="scenario-source">
                재작성 근거: {selected.derived_from.join(" / ")} · 사례 ID{" "}
                <code>{selected.scenario_id}</code>
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
