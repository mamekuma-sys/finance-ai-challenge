import type { IncidentState } from "@/lib/contracts";
import type { DecisionActionCard } from "@/lib/decision";
import { OFFICIAL_SOURCES } from "@/lib/decision/sources";
import {
  displayCardTitle,
  explainCardOrder,
} from "@/lib/ui/labels";

import { OfficialLink } from "./official-link";

interface NextStepsProps {
  cards: readonly DecisionActionCard[];
  incidentState: IncidentState;
}

const NEXT_STEP_PHONE_ACTIONS: Readonly<
  Record<string, { href: string; label: string }>
> = {
  "call:112": { href: "tel:112", label: "112로 전화 걸기" },
  "call:1332": { href: "tel:1332", label: "1332로 전화 걸기" },
};

function NextStepAction({
  card,
  requiresSafeDevice,
}: {
  card: DecisionActionCard;
  requiresSafeDevice: boolean;
}) {
  if (card.merge_key === "procedure:written_followup") {
    return (
      <div className="next-step-actions">
        <OfficialLink
          href={OFFICIAL_SOURCES["SRC-EASYLAW-STOPPAY"].url}
          className="primary-action"
        >
          <span aria-hidden="true">↗</span> 피해구제신청서 제출 방법 확인
        </OfficialLink>
        {requiresSafeDevice ? <SafeDeviceCallNotice /> : null}
        <a
          className="secondary-action-link next-step-call"
          href="tel:1394"
        >
          <span aria-hidden="true">☎</span> 1394에 절차 상담하기
        </a>
      </div>
    );
  }

  const phoneAction = NEXT_STEP_PHONE_ACTIONS[card.merge_key];
  if (!phoneAction) {
    return null;
  }
  return (
    <div className="next-step-actions">
      {requiresSafeDevice ? <SafeDeviceCallNotice /> : null}
      <a className="next-step-call" href={phoneAction.href}>
        <span aria-hidden="true">☎</span> {phoneAction.label}
      </a>
    </div>
  );
}

function SafeDeviceCallNotice() {
  return (
    <p className="safe-device-call-note" data-safe-device-call="true">
      전화 상담은 의심 기기와 분리된 안전한 기기에서 하세요.
    </p>
  );
}

function CardField({
  field,
  title,
  items,
}: {
  field: string;
  title: string;
  items: readonly string[];
}) {
  return (
    <section className="next-step-field" data-card-field={field}>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>없음</p>
      )}
    </section>
  );
}

export function NextSteps({ cards, incidentState }: NextStepsProps) {
  if (cards.length === 0) {
    return null;
  }
  const requiresSafeDevice =
    incidentState.device_compromise_state === "suspected_app" ||
    incidentState.device_compromise_state === "remote_control" ||
    incidentState.device_compromise_state === "unknown";

  return (
    <details className="next-steps">
      <summary>접힌 다음 행동 (전부 보존됨)</summary>
      <ol start={cards[0].priority}>
        {cards.map((card) => (
          <li
            data-next-step-card={card.id}
            key={card.id}
            value={card.priority}
          >
            <strong>
              {card.priority}. {displayCardTitle(card)}
            </strong>
            <CardField
              field="purpose_slots"
              title="할 일"
              items={
                card.question_axes && card.question_axes.length > 0
                  ? ["질문에 답하면 행동 순서가 바로 바뀝니다."]
                  : card.purpose_slots
              }
            />
            <CardField
              field="prerequisite"
              title="먼저 확인할 조건"
              items={card.prerequisite}
            />
            <NextStepAction
              card={card}
              requiresSafeDevice={requiresSafeDevice}
            />
            <CardField
              field="required_followup"
              title="이어서 확인할 일"
              items={card.required_followup}
            />
            <section
              className="next-step-field"
              data-card-field="official_sources"
            >
              <h4>공식 출처</h4>
              {card.official_sources.length > 0 ? (
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
              ) : (
                <p>없음</p>
              )}
            </section>
            <CardField
              field="do_not_show_when"
              title="이때는 표시하지 않음"
              items={card.do_not_show_when}
            />
            <CardField
              field="prohibited_actions"
              title="하지 말아야 할 행동"
              items={card.prohibited_actions}
            />
            <details className="order-details">
              <summary>왜 이 순서인가</summary>
              <p>{explainCardOrder(card)}</p>
              <p>행동 분류: {card.merge_key}</p>
              <p data-card-field="template_versions">
                안내 문구 버전: {card.template_versions.join(" · ")}
              </p>
            </details>
          </li>
        ))}
      </ol>
    </details>
  );
}
