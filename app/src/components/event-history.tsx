"use client";

import type { ActionFactEvent } from "@/lib/contracts";
import {
  ACTION_SOURCE_LABELS,
  ACTION_STATE_LABELS,
} from "@/lib/ui/labels";

interface EventHistoryProps {
  events: readonly ActionFactEvent[];
  actionTitles: Readonly<Record<string, string>>;
  elapsedSeconds: number | null;
  onCorrect: (event: ActionFactEvent) => void;
}

function formatElapsed(seconds: number | null): string {
  if (seconds === null) {
    return "사용자 확인 전";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${hours > 0 ? `${hours}시간 ` : ""}${minutes}분 ${remainder}초`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "시각 확인 불가"
    : new Intl.DateTimeFormat("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date);
}

export function EventHistory({
  events,
  actionTitles,
  elapsedSeconds,
  onCorrect,
}: EventHistoryProps) {
  const correctedIds = new Set(
    events.flatMap((event) =>
      event.event_type === "correction" && event.corrects_event_id
        ? [event.corrects_event_id]
        : [],
    ),
  );

  return (
    <section className="event-history" aria-labelledby="event-history-title">
      <div className="timer-block">
        <p>사용자 확인 뒤 경과 시간</p>
        <strong role="timer">{formatElapsed(elapsedSeconds)}</strong>
        <p>
          1회에 100만 원 이상이 송금·이체되어 입금된 경우, 입금된 때부터
          해당 금액 상당액 범위에서 30분간 CD/ATM을 통한 인출·이체가
          지연됩니다. 창구 거래는 즉시 가능하며, 개별 사건의 잔여
          시간·회수 가능성을 뜻하지 않습니다.
        </p>
      </div>

      <h2 id="event-history-title">행동 이벤트 이력(내 기기 보관)</h2>
      <p className="event-history-intro">
        화면에서 관측한 일과 사용자가 확인한 일을 구분합니다. 되돌리기는
        삭제가 아니라 새 정정 기록으로 남습니다.
      </p>
      {events.length === 0 ? (
        <p className="empty-state">아직 기록이 없습니다.</p>
      ) : (
        <ol>
          {events.map((event, index) => {
            const targetIndex = event.corrects_event_id
              ? events.findIndex(
                  (candidate) =>
                    candidate.event_id === event.corrects_event_id,
                )
              : -1;
            return (
              <li
                key={event.event_id}
                className={
                  event.event_type === "correction"
                    ? "event-correction"
                    : ""
                }
              >
                <div className="event-row-heading">
                  <span className="event-number">기록 {index + 1}</span>
                  <time dateTime={event.occurred_at}>
                    {formatTime(event.occurred_at)}
                  </time>
                </div>
                <strong>
                  {actionTitles[event.action_id] ?? "현재 화면의 행동"}
                </strong>
                <p>
                  {event.event_type === "correction"
                    ? `정정 — 기록 ${targetIndex + 1}을 되돌림`
                    : ACTION_STATE_LABELS[event.state]}
                </p>
                <p className="event-previous">
                  이전 상태:{" "}
                  {event.previous_state
                    ? ACTION_STATE_LABELS[event.previous_state]
                    : "없음"}
                </p>
                <span
                  className={`source-badge ${
                    event.source === "ui_event"
                      ? "source-ui"
                      : "source-user"
                  }`}
                >
                  {ACTION_SOURCE_LABELS[event.source]}
                </span>
                {event.event_type === "observation" &&
                !correctedIds.has(event.event_id) ? (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => onCorrect(event)}
                  >
                    되돌리기
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
