import type { ScreenState } from "@/lib/screen-state";

/**
 * 화면 상태 배너.
 *
 * 문구는 `docs/product/screens-and-states.md` §3의 고정 어휘를 따른다.
 * REPLAY는 실시간으로 위장하지 않고 fixture version을 함께 노출한다.
 */
const MESSAGES: Record<Exclude<ScreenState, "normal">, string> = {
  loading: "불러오는 중입니다.",
  empty: "표시할 데이터가 없습니다.",
  partial: "일부 검사가 실패했습니다. 성공한 항목은 그대로 표시합니다.",
  unknown: "확인 필요 — 결정론적 근거가 없어 확정할 수 없습니다.",
  replay: "재현 데이터 기준입니다.",
};

export function ScreenStateNotice({
  state,
  fixtureVersion,
}: {
  state: ScreenState;
  fixtureVersion?: string;
}) {
  if (state === "normal") {
    return null;
  }

  return (
    <p className="state-notice" role="status" data-state={state}>
      <span className="state-notice-label">{state.toUpperCase()}</span>
      <span>{MESSAGES[state]}</span>
      {state === "replay" && fixtureVersion ? (
        <span className="state-notice-meta">{fixtureVersion}</span>
      ) : null}
    </p>
  );
}
