"use client";

import type { EmergencyChoice } from "@/lib/session/desk-session";

interface EmergencyQuestionProps {
  selected: EmergencyChoice | null;
  onSelect: (choice: EmergencyChoice) => void;
}

const OPTIONS: Array<{
  value: EmergencyChoice;
  label: string;
  detail: string;
}> = [
  {
    value: "sent",
    label: "돈을 보냈어요",
    detail: "금융회사 연락과 지급정지 요청 순서를 바로 확인합니다.",
  },
  {
    value: "installed",
    label: "앱을 설치했어요",
    detail: "의심 기기 사용 중지와 안전한 기기 확보부터 확인합니다.",
  },
  {
    value: "credentials",
    label: "인증정보를 알려줬어요",
    detail: "공식 대표번호로 노출 통지와 보호조치를 확인합니다.",
  },
  {
    value: "unknown",
    label: "해당 없음·모름",
    detail: "모르는 상태를 숨기지 않고 필요한 질문부터 확인합니다.",
  },
];

export function EmergencyQuestion({
  selected,
  onSelect,
}: EmergencyQuestionProps) {
  return (
    <section className="emergency-question" aria-labelledby="emergency-title">
      <p className="section-kicker">바로 시작</p>
      <h1 id="emergency-title">
        돈을 보냈거나, 앱을 설치했거나, 인증정보를 알려주셨나요?
      </h1>
      <p className="hero-intro">
        가장 가까운 상황 하나를 누르면 AI를 기다리지 않고 지금 할 일을
        보여드립니다. 계좌번호·주민번호·인증번호·비밀번호는 묻지 않습니다.
      </p>
      <div className="emergency-options" aria-describedby="emergency-title">
        {OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className="emergency-option"
              aria-pressed={isSelected}
              onClick={() => onSelect(option.value)}
            >
              <span className="option-mark" aria-hidden="true">
                {isSelected ? "✓" : "→"}
              </span>
              <span>
                <strong>{option.label}</strong>
                <small>{option.detail}</small>
              </span>
              {isSelected ? (
                <span className="selected-label">선택됨</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
