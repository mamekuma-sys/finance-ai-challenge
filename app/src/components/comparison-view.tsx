"use client";

import type { IncidentState } from "@/lib/contracts";
import { decideActions, type DecisionResult } from "@/lib/decision";
import {
  compareCard,
  prohibitedUnion,
  type CardChange,
} from "@/lib/comparison/action-diff";
import {
  displayCardTitle,
  HUMAN_STATE_LABELS,
} from "@/lib/ui/labels";

interface ComparisonViewProps {
  sentAfter: boolean;
  addMaliciousApp: boolean;
  onSentAfterChange: (value: boolean) => void;
  onMaliciousAppChange: (value: boolean) => void;
  timingLabel: string;
}

const BASE_STATE: IncidentState = {
  transfer_state: "not_sent",
  device_compromise_state: "none",
  credential_exposure_state: "none",
  personal_data_exposure_state: "none",
  user_role: "self",
  safe_device_available: "yes",
};

function changeBadge(change: CardChange, side: "before" | "after") {
  if (change.kind === "added" && side === "after") {
    return <span className="change-badge change-added">+ 추가</span>;
  }
  if (change.kind === "removed" && side === "before") {
    return <span className="change-badge change-removed">− 제거</span>;
  }
  if (change.kind === "rank_changed") {
    return (
      <span className="change-badge change-rank">
        ↕ {change.previous_priority}위→{change.next_priority}위
      </span>
    );
  }
  return null;
}

function CompareColumn({
  title,
  state,
  result,
  other,
  side,
}: {
  title: string;
  state: IncidentState;
  result: DecisionResult;
  other: DecisionResult;
  side: "before" | "after";
}) {
  const prohibitions = prohibitedUnion(result);
  const otherProhibitions = prohibitedUnion(other);

  return (
    <section className="compare-column" aria-label={title}>
      <div className="compare-column-heading">
        <p>{side === "before" ? "이전 상태" : "변경 상태"}</p>
        <h3>{title}</h3>
        <div className="human-state-chips">
          <span>{HUMAN_STATE_LABELS[state.transfer_state]}</span>
          <span>
            {HUMAN_STATE_LABELS[state.device_compromise_state]}
          </span>
        </div>
      </div>
      <ol className="compare-card-list">
        {[...result.actions, ...result.next_steps].map((card) => {
          const change = compareCard(card.merge_key, other, result);
          const normalized =
            side === "before"
              ? compareCard(card.merge_key, result, other)
              : change;
          return (
            <li key={card.id}>
              <span className="compare-priority">{card.priority}</span>
              <div>
                <strong>{displayCardTitle(card)}</strong>
                {card.priority > result.actions.length ? (
                  <span className="folded-label">다음 행동</span>
                ) : null}
                {changeBadge(normalized, side)}
                {side === "after" &&
                normalized.added_prerequisites.length > 0 ? (
                  <p className="prerequisite-change">
                    + 전제 추가:{" "}
                    {normalized.added_prerequisites.join(", ")}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="compare-prohibitions">
        <h4>하지 마세요</h4>
        <ul>
          {prohibitions.map((item) => {
            const isAdded =
              side === "after" && !otherProhibitions.includes(item);
            const isRemoved =
              side === "before" && !otherProhibitions.includes(item);
            return (
              <li key={item}>
                {isAdded ? (
                  <span className="change-badge change-added">+ 추가</span>
                ) : null}
                {isRemoved ? (
                  <span className="change-badge change-removed">− 제거</span>
                ) : null}
                {item}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function ComparisonView({
  sentAfter,
  addMaliciousApp,
  onSentAfterChange,
  onMaliciousAppChange,
  timingLabel,
}: ComparisonViewProps) {
  const beforeState = BASE_STATE;
  const afterState: IncidentState = {
    ...BASE_STATE,
    transfer_state: sentAfter ? "already_sent" : "not_sent",
    device_compromise_state: addMaliciousApp ? "suspected_app" : "none",
    safe_device_available: addMaliciousApp ? "no" : "yes",
  };
  const before = decideActions(beforeState);
  const after = decideActions(afterState);

  return (
    <section className="comparison-view" aria-labelledby="comparison-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">상태 전환 비교</p>
          <h2 id="comparison-title">바뀐 행동만 바로 찾으세요</h2>
        </div>
        <p>
          같은 상황에서 송금과 앱 설치 여부가 달라질 때 행동 순서·금지
          행동·전제가 어떻게 바뀌는지 비교합니다.
        </p>
      </div>
      <div className="comparison-switches" aria-label="비교 조건">
        <label className="switch-control">
          <input
            type="checkbox"
            checked={sentAfter}
            onChange={(event) =>
              onSentAfterChange(event.currentTarget.checked)
            }
          />
          <span aria-hidden="true" className="switch-track" />
          <span>송금 전 ↔ 송금 직후</span>
        </label>
        <label className="switch-control">
          <input
            type="checkbox"
            checked={addMaliciousApp}
            onChange={(event) =>
              onMaliciousAppChange(event.currentTarget.checked)
            }
          />
          <span aria-hidden="true" className="switch-track" />
          <span>악성 앱 설치 추가</span>
        </label>
      </div>
      <p className="timing-readout" aria-live="polite">
        {timingLabel}
      </p>
      <div className="compare-grid">
        <CompareColumn
          title="송금 전"
          state={beforeState}
          result={before}
          other={after}
          side="before"
        />
        <CompareColumn
          title={sentAfter ? "송금 직후" : "송금 전(변경 없음)"}
          state={afterState}
          result={after}
          other={before}
          side="after"
        />
      </div>
    </section>
  );
}
