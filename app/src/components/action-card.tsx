"use client";

import type {
  ActionFactSource,
  ActionFactState,
  IncidentState,
} from "@/lib/contracts";
import type {
  DecisionActionCard,
  QuestionAxis,
} from "@/lib/decision";
import { OFFICIAL_SOURCES } from "@/lib/decision/sources";
import {
  resolveTemplate,
  type TemplateVersion,
} from "@/lib/templates/registry";
import {
  ACTION_SOURCE_LABELS,
  ACTION_STATE_LABELS,
  displayCardTitle,
  explainCardOrder,
  INCIDENT_FIELD_CONFIG,
} from "@/lib/ui/labels";

import { CopyScript } from "./copy-script";
import { OfficialLink } from "./official-link";
import { IncidentStateFieldset } from "./state-editor";

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
  incidentState: IncidentState;
  onIncidentStateChange: (
    key: keyof IncidentState,
    value: IncidentState[keyof IncidentState],
  ) => void;
  templateReferenceDate: string;
}

const PHONE_KEYS = new Set([
  "call:112",
  "call:1332",
  "call:bank_fraud",
]);

function PrimaryAction({
  card,
  checked,
  onDialer,
  onToggle,
  requiresSafeDevice,
}: {
  card: DecisionActionCard;
  checked: boolean;
  onDialer: () => void;
  onToggle: (checked: boolean) => void;
  requiresSafeDevice: boolean;
}) {
  if (card.merge_key === "call:112") {
    return (
      <div className="action-stack">
        {requiresSafeDevice ? <SafeDeviceCallNotice /> : null}
        <a className="primary-action" href="tel:112" onClick={onDialer}>
          <span aria-hidden="true">☎</span> 112로 전화 걸기
        </a>
      </div>
    );
  }
  if (card.merge_key === "call:1332") {
    return (
      <div className="action-stack">
        {requiresSafeDevice ? <SafeDeviceCallNotice /> : null}
        <a className="primary-action" href="tel:1332" onClick={onDialer}>
          <span aria-hidden="true">☎</span> 1332로 전화 걸기
        </a>
      </div>
    );
  }
  if (card.merge_key === "procedure:written_followup") {
    return (
      <div className="action-stack">
        <OfficialLink
          href={OFFICIAL_SOURCES["SRC-EASYLAW-STOPPAY"].url}
          className="primary-action"
        >
          <span aria-hidden="true">↗</span> 피해구제신청서 제출 방법 확인
        </OfficialLink>
        {requiresSafeDevice ? <SafeDeviceCallNotice /> : null}
        <a className="secondary-action-link" href="tel:1394">
          <span aria-hidden="true">☎</span> 1394에 절차 상담하기
        </a>
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
          상대가 알려준 번호가 아니라 카드 뒷면·공식 앱·공식 홈페이지의
          대표번호를 사용하세요.
        </p>
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

function SafeDeviceCallNotice() {
  return (
    <p className="safe-device-call-note" data-safe-device-call="true">
      전화 상담은 의심 기기와 분리된 안전한 기기에서 하세요.
    </p>
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
      label:
        card.merge_key === "procedure:written_followup"
          ? "피해구제신청서를 금융회사에 제출했다고 확인했어요"
          : "요청을 전달했어요",
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

const QUESTION_AXIS_FIELD_KEYS: Readonly<
  Record<QuestionAxis, keyof IncidentState>
> = {
  transfer: "transfer_state",
  device: "device_compromise_state",
  credential: "credential_exposure_state",
  personal_data: "personal_data_exposure_state",
};

function QuestionCardFields({
  axes,
  state,
  onChange,
}: {
  axes: readonly QuestionAxis[];
  state: IncidentState;
  onChange: ActionCardViewProps["onIncidentStateChange"];
}) {
  return (
    <div className="question-card-fields">
      {axes.map((axis) => {
        const fieldKey = QUESTION_AXIS_FIELD_KEYS[axis];
        const field = INCIDENT_FIELD_CONFIG.find(
          (candidate) => candidate.key === fieldKey,
        );
        return field ? (
          <IncidentStateFieldset
            key={axis}
            field={field}
            state={state}
            onChange={onChange}
            idPrefix="question-card-"
          />
        ) : null;
      })}
    </div>
  );
}

export function ActionCardView({
  card,
  nonCallConfirmed,
  currentState,
  onRecord,
  onToggleNonCall,
  incidentState,
  onIncidentStateChange,
  templateReferenceDate,
}: ActionCardViewProps) {
  const titleId = `title-${card.id.replaceAll(":", "-")}`;
  const isQuestionCard =
    card.question_axes !== undefined && card.question_axes.length > 0;
  const isRequired =
    card.merge_key === "procedure:written_followup" ||
    card.merge_key === "notice:proxy_scope";
  const templateResolutions = card.template_versions.map((version) =>
    resolveTemplate(version as TemplateVersion, templateReferenceDate),
  );
  const templateBodies = templateResolutions.flatMap((resolution) =>
    resolution.ok ? [resolution.body] : [],
  );
  const blockedTemplateStatuses = [
    ...new Set(
      templateResolutions.flatMap((resolution) =>
        resolution.ok ? [] : [resolution.status],
      ),
    ),
  ];
  const requiresSafeDevice =
    incidentState.device_compromise_state === "suspected_app" ||
    incidentState.device_compromise_state === "remote_control" ||
    incidentState.device_compromise_state === "unknown";
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

        <h3 id={titleId}>{displayCardTitle(card)}</h3>
        {isQuestionCard ? (
          <>
            <p className="question-card-intro">
              먼저 {card.question_axes?.length}가지만 확인할게요.
            </p>
            <QuestionCardFields
              axes={card.question_axes ?? []}
              state={incidentState}
              onChange={onIncidentStateChange}
            />
          </>
        ) : (
          <div className="purpose-block">
            <h4>이 전화나 확인에서 할 일</h4>
            <ul>
              {card.purpose_slots.map((slot) => (
                <li key={slot}>{slot}</li>
              ))}
            </ul>
          </div>
        )}

        {!isQuestionCard ? (
          <PrimaryAction
            card={card}
            checked={nonCallConfirmed}
            onDialer={() => onRecord(card, "dialer_opened", "ui_event")}
            onToggle={(checked) => onToggleNonCall(card.id, checked)}
            requiresSafeDevice={requiresSafeDevice}
          />
        ) : null}

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

        {blockedTemplateStatuses.map((status) => (
          <div
            className="template-gate-notice"
            data-template-status={status}
            key={status}
            role="status"
          >
            <strong>
              안내 문구 상태:{" "}
              {status === "unconfirmed"
                ? "출처 시행일 미확인"
                : "재검토 기한 경과"}
            </strong>
            <p>
              {status === "unconfirmed"
                ? "이 문구는 출처 시행일 확인 전이라 표시하지 않습니다."
                : "이 문구는 재검토 기한이 지나 표시하지 않습니다."}
            </p>
          </div>
        ))}

        {!isQuestionCard && templateBodies.length > 0 ? (
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
          <p>안내 문구 버전: {card.template_versions.join(" · ")}</p>
        </details>

        {!isQuestionCard ? (
          <EventControls
            card={card}
            currentState={currentState}
            onRecord={onRecord}
          />
        ) : null}
      </div>
    </article>
  );
}
