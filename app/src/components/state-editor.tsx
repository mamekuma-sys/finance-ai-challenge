"use client";

import type { IncidentState } from "@/lib/contracts";
import { INCIDENT_FIELD_CONFIG } from "@/lib/ui/labels";

interface StateEditorProps {
  state: IncidentState;
  onChange: (
    key: keyof IncidentState,
    value: IncidentState[keyof IncidentState],
  ) => void;
}

type IncidentFieldConfig = (typeof INCIDENT_FIELD_CONFIG)[number];

interface IncidentStateFieldsetProps extends StateEditorProps {
  field: IncidentFieldConfig;
  idPrefix?: string;
}

export function IncidentStateFieldset({
  field,
  state,
  onChange,
  idPrefix = "",
}: IncidentStateFieldsetProps) {
  const helpId = `${idPrefix}${field.key}-help`;
  return (
    <fieldset aria-describedby={helpId}>
      <legend>{field.legend}</legend>
      <p id={helpId} className="field-help">
        {field.help}
      </p>
      <div className="radio-options">
        {field.options.map(([value, label]) => {
          const id = `${idPrefix}${field.key}-${value}`;
          const isSelected = state[field.key] === value;
          return (
            <div className="radio-option" key={value}>
              <input
                id={id}
                type="radio"
                name={`${idPrefix}${field.key}`}
                value={value}
                checked={isSelected}
                onChange={() =>
                  onChange(
                    field.key,
                    value as IncidentState[typeof field.key],
                  )
                }
              />
              <label htmlFor={id}>
                <span>{label}</span>
                {isSelected ? (
                  <small className="selected-label" aria-hidden="true">
                    선택됨
                  </small>
                ) : null}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function StateEditor({ state, onChange }: StateEditorProps) {
  return (
    <section className="state-editor" aria-labelledby="state-editor-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">상황 확인</p>
          <h2 id="state-editor-title">아는 만큼만 알려주세요</h2>
        </div>
        <p>
          “모르겠어요”도 정식 답변입니다. 선택할 때마다 공식 행동 순서가 즉시
          바뀝니다.
        </p>
      </div>
      <div className="state-field-grid">
        {INCIDENT_FIELD_CONFIG.map((field) => (
          <IncidentStateFieldset
            key={field.key}
            field={field}
            state={state}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  );
}
