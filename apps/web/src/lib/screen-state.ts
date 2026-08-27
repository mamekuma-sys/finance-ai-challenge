/**
 * 화면 상태 전환 파라미터.
 *
 * 상태 목록과 폴백 규칙의 근거는 `docs/product/screens-and-states.md` §2·§3이다.
 * 파라미터가 가리키는 대상이 없으면 404로 넘기지 않고 정상 상태로 되돌린다.
 */
export const SCREEN_STATES = [
  "normal",
  "loading",
  "empty",
  "partial",
  "unknown",
  "replay",
] as const;

export type ScreenState = (typeof SCREEN_STATES)[number];

export function parseScreenState(value: string | undefined): ScreenState {
  return SCREEN_STATES.includes(value as ScreenState) ? (value as ScreenState) : "normal";
}
