import type { BadgeTone } from "@/components/badge";
import type { ImplementationStatus, ScanStatus } from "@/types/ui";

/**
 * 자산 원장 한 줄의 표시 상태.
 *
 * mismatch가 없다는 사실 하나로는 "구현됐다"를 말할 수 없다. 분석기는 필요한
 * 가드가 빠졌을 때만 결함을 내므로, 검사 대상 함수가 아예 없는 컨트랙트도
 * 결함 0건이 된다. 그래서 결함이 없을 때는 `구현됨`이 아니라 `결함 없음`으로
 * 적고, 대응 룰이 없는 필드는 검사 실패와 구분해 `P0 범위 밖`으로 적는다.
 */
export type ControlLedgerState =
  | "UNCHECKED"
  | "SCANNING"
  | "MISSING"
  | "IMPLEMENTED"
  | "PARTIAL"
  | "NO_FINDING"
  | "OUT_OF_SCOPE"
  | "UNKNOWN";

/**
 * 백엔드 `FIELD_RULE_MAP`이 룰에 연결한 필드 집합.
 * 어긋나면 `control-ledger.test.ts`가 실패한다.
 */
export const RULE_MAPPED_CONTROL_FIELDS = [
  "collateral_verified",
  "issuer_role",
  "max_supply",
  "oracle_max_age",
] as const;

export const CONTROL_LEDGER_LABEL: Record<ControlLedgerState, string> = {
  UNCHECKED: "미검사",
  SCANNING: "검사 중",
  MISSING: "통제 공백",
  IMPLEMENTED: "구현됨",
  PARTIAL: "부분 구현",
  NO_FINDING: "결함 없음",
  OUT_OF_SCOPE: "P0 범위 밖",
  UNKNOWN: "판단 불가",
};

export const CONTROL_LEDGER_TONE: Record<ControlLedgerState, BadgeTone> = {
  UNCHECKED: "neutral",
  SCANNING: "neutral",
  MISSING: "breach",
  IMPLEMENTED: "safe",
  PARTIAL: "warn",
  NO_FINDING: "safe",
  OUT_OF_SCOPE: "neutral",
  UNKNOWN: "neutral",
};

export function isRuleMappedControlField(field: string): boolean {
  return RULE_MAPPED_CONTROL_FIELDS.some((mapped) => mapped === field);
}

export function controlLedgerState({
  field,
  implementation,
  scanStatus,
}: {
  field: string;
  implementation?: ImplementationStatus;
  scanStatus?: ScanStatus | null;
}): ControlLedgerState {
  if (!scanStatus) return "UNCHECKED";
  // 서버가 판정을 냈으면 그 판정을 그대로 쓴다.
  if (implementation) return implementation;
  if (!isRuleMappedControlField(field)) return "OUT_OF_SCOPE";
  if (scanStatus === "QUEUED" || scanStatus === "RUNNING") return "SCANNING";
  // 실패한 검사의 결함 0건은 "결함 없음"이 아니다.
  if (scanStatus === "FAILED") return "UNKNOWN";
  return "NO_FINDING";
}
