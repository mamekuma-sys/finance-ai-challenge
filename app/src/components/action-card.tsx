"use client";

import type {
  ActionFactSource,
  ActionFactState,
} from "@/lib/contracts";
import type { DecisionActionCard } from "@/lib/decision";
import { OFFICIAL_SOURCES } from "@/lib/decision/sources";
import { TEMPLATE_REGISTRY } from "@/lib/templates/registry";
import {
  ACTION_SOURCE_LABELS,
  ACTION_STATE_LABELS,
  explainCardOrder,
  templateBodiesForCard,
} from "@/lib/ui/labels";

import { CopyScript } from "./copy-script";
import { OfficialLink } from "./official-link";

interface ActionCardViewProps {
  card: DecisionActionCard;
  easyMode: boolean;
  nonCallConfirmed: boolean;
  currentState: ActionFactState | null;
  onRecord: (
    card: DecisionActionCard,
    state: ActionFactState,
    source: ActionFactSource,
  ) => void;
  onToggleNonCall: (cardId: string, checked: boolean) => void;
}

const PHONE_KEYS = new Set([
  "call:112",
  "call:1332",
  "call:bank_fraud",
  "procedure:written_followup",
]);

function PrimaryAction({
  card,
  checked,
  onDialer,
  onToggle,
}: {
  card: DecisionActionCard;
  checked: boolean;
  onDialer: () => void;
  onToggle: (checked: boolean) => void;
}) {
  if (card.merge_key === "call:112") {
    return (
      <a className="primary-action" href="tel:112" onClick={onDialer}>
        <span aria-hidden="true">☎</span> 112로 전화 걸기
      </a>
    );
  }
  if (card.merge_key === "call:1332") {
    return (
      <a className="primary-action" href="tel:1332" onClick={onDialer}>
        <span aria-hidden="true">☎</span> 1332로 전화 걸기
      </a>
    );
  }
  if (card.merge_key === "procedure:written_followup") {
    return (
      <div className="action-stack">
        <a className="primary-action" href="tel:1394" onClick={onDialer}>
          <span aria-hidden="true">☎</span> 1394로 전화 걸기
        </a>
        <OfficialLink
          href="https://www.counterscam112.go.kr"
          className="secondary-action-link"
        >
          보이스피싱 통합신고대응센터 확인
        </OfficialLink>
      </div>
    );
  }
  if (card.merge_key === "call:bank_fraud") {
    return (
      <div className="action-stack">
        <OfficialLink
          href="https://fine.fss.or.kr"
          className="primary-action"
        >
          <span aria-hidden="true">↗</span> 내 금융회사 대표번호 찾기
        </OfficialLink>
        <p className="official-number-note">
          상대가 알려준 번호가 아니라, 카드 뒷면·공식 앱·공식 홈페이지의
          대표번호를 쓰세요.
        </p>
        <a
          className="secondary-action-link"
          href="tel:"
          onClick={onDialer}
          aria-label="공식 대표번호 확인 후 전화 앱 열기"
        >
          공식 대표번호 확인 후 전화 앱 열기
        </a>
      </div>
    );
  }

  const label =
    card.merge_key === "device:isolate"
      ? "이 기기 사용을 멈췄어요"
      : card.merge_key === "action:stop_contact"
        ? "상대와의 연락을 멈췄어요"
        : card.merge_key === "action:stop_risky"
          ? "송금·설치를 멈췄어요"
          : card.merge_key === "action:credential_recovery"
            ? "안내 확인을 시작했어요"
            : card.merge_key === "verify:official_channel"
              ? "공식 채널을 확인했어요"
              : card.merge_key === "question:state_confirm"
                ? "상태 질문을 확인했어요"
                : "이 안내를 확인했어요";

  return (
    <label className="primary-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onToggle(event.currentTarget.checked)}
      />
      <span aria-hidden="true">{checked ? "✓" : "○"}</span>
      {label}
    </label>
  );
}

function EventControls({
  card,
  currentState,
  onRecord,
}: {
  card: DecisionActionCard;
  currentState: ActionFactState | null;
  onRecord: ActionCardViewProps["onRecord"];
}) {
  const controls: Array<{
    state: ActionFactState;
    source: ActionFactSource;
    label: string;
  }> = [
    {
      state: "user_reported_connected",
      source: "user_statement",
      label: "통화가 연결됐어요",
    },
    {
      state: "user_reported_requested",
      source: "user_statement",
      label: "요청을 전달했어요",
    },
    {
      state: "user_reported_receipt_confirmed",
      source: "user_statement",
      label: "기관 접수를 확인했어요",
    },
    {
      state: "not_applicable",
      source: "user_statement",
      label: "해당하지 않아요",
    },
    {
      state: "unknown",
      source: "user_statement",
      label: "아직 모르겠어요",
    },
  ];

  return (
    <details className="event-controls">
      <summary>이 행동의 진행 상태 기록</summary>
      <p className="event-current">
        현재 기록:{" "}
        {currentState ? ACTION_STATE_LABELS[currentState] : "기록 없음"}
      </p>
      {!PHONE_KEYS.has(card.merge_key) ? (
        <p className="event-honesty-note">
          위 체크는 화면 확인 상태입니다. 통화 연결·요청·접수 기록은 실제 기관
          연락이 있었을 때만 선택하세요.
        </p>
      ) : null}
      <div className="event-button-grid">
        {controls.map((control) => (
          <button
            className="mini-button"
            type="button"
            key={control.state}
            onClick={() => onRecord(card, control.state, control.source)}
          >
            {control.label}
          </button>
        ))}
      </div>
      <p className="source-legend">
        <span className="source-badge source-ui">
          {ACTION_SOURCE_LABELS.ui_event}
        </span>
        화면에서 카드 보기·전화 앱 열기 선택만 관측합니다.{" "}
        <span className="source-badge source-user">
          {ACTION_SOURCE_LABELS.user_statement}
        </span>
        연결·요청·접수는 사용자가 확인한 내용입니다.
      </p>
    </details>
  );
}

export function ActionCardView({
  card,
  nonCallConfirmed,
  currentState,
  onRecord,
  onToggleNonCall,
}: ActionCardViewProps) {
  const titleId = `title-${card.id.replaceAll(":", "-")}`;
  const isRequired =
    card.merge_key === "procedure:written_followup" ||
    card.merge_key === "notice:proxy_scope";
  const templateBodies = templateBodiesForCard(card, TEMPLATE_REGISTRY);
  const scriptText = [
    ...templateBodies,
    "",
    "이 전화나 확인에서 할 일:",
    ...(card.purpose_slots.length > 0
      ? card.purpose_slots.map((slot) => `- ${slot}`)
      : ["- 확인 필요"]),
  ].join("\n");

  return (
    <article
      className={`action-card ${card.priority === 1 ? "action-card-first" : ""}`}
      aria-labelledby={titleId}
      data-priority={card.priority}
      data-testid="action-card"
    >
      <div className="priority-rail" aria-label={`행동 ${card.priority}`}>
        <span className="priority-number">{card.priority}</span>
        {card.priority === 1 ? (
          <span className="first-label">지금 먼저</span>
        ) : null}
      </div>

      <div className="action-card-body">
        {isRequired ? (
          <p className="required-card-label">
            <span aria-hidden="true">◆</span> 접을 수 없는 필수 카드
          </p>
        ) : null}
        {card.prerequisite.length > 0 ? (
          <div className="prerequisite-block">
            <strong>
              <span aria-hidden="true">!</span> 먼저 확인할 조건
            </strong>
            <ul>
              {card.prerequisite.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <h3 id={titleId}>{card.title}</h3>
        <div className="purpose-block">
          <h4>이 전화나 확인에서 할 일</h4>
          <ul>
            {card.purpose_slots.map((slot) => (
              <li key={slot}>{slot}</li>
            ))}
          </ul>
        </div>

        <PrimaryAction
          card={card}
          checked={nonCallConfirmed}
          onDialer={() => onRecord(card, "dialer_opened", "ui_event")}
          onToggle={(checked) => onToggleNonCall(card.id, checked)}
        />

        {card.required_followup.length > 0 ? (
          <div className="followup-block">
            <strong>이어서 확인하세요</strong>
            <ul>
              {card.required_followup.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {templateBodies.length > 0 ? (
          <CopyScript text={scriptText} title="말할 내용" />
        ) : null}

        <div className="source-list">
          <strong>공식 출처</strong>
          <ul>
            {card.official_sources.map((sourceId) => {
              const source =
                OFFICIAL_SOURCES[
                  sourceId as keyof typeof OFFICIAL_SOURCES
                ];
              return source ? (
                <li key={sourceId}>
                  <OfficialLink href={source.url}>
                    {source.institution} · {source.document_title}
                  </OfficialLink>
                </li>
              ) : null;
            })}
          </ul>
        </div>

        <details className="order-details">
          <summary>왜 이 순서인가</summary>
          <p>{explainCardOrder(card)}</p>
          <p>행동 분류: {card.merge_key}</p>
          <p>승인 문구 버전: {card.template_versions.join(" · ")}</p>
        </details>

        <EventControls
          card={card}
          currentState={currentState}
          onRecord={onRecord}
        />
      </div>
    </article>
  );
}
