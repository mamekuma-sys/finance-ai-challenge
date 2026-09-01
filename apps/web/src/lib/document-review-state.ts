import type { ControlSpec } from "@/types/ui";

export interface ControlDraft {
  value: ControlSpec["value"];
  confirmed: boolean;
}

export const P0_CONTROL_FIELDS = [
  "max_supply",
  "issuer_role",
  "collateral_verified",
  "oracle_max_age",
  "price_band_breach",
  "pauser_role",
] as const satisfies readonly ControlSpec["field"][];

export type P0ControlField = (typeof P0_CONTROL_FIELDS)[number];

export function isP0ControlField(value: string): value is P0ControlField {
  return P0_CONTROL_FIELDS.some((field) => field === value);
}

export function hasConfirmedP0Controls(
  controls: readonly Pick<ControlSpec, "field" | "confirmed">[],
): boolean {
  const confirmed = new Set(
    controls.filter((control) => control.confirmed).map((control) => control.field),
  );
  return P0_CONTROL_FIELDS.every((field) => confirmed.has(field));
}

export function controlDraft(
  control: ControlSpec,
  override: ControlDraft | undefined,
): ControlDraft {
  return override ?? { value: control.value, confirmed: control.confirmed };
}

export function policyPatch(control: ControlSpec, draft: ControlDraft) {
  return {
    constraint_id: control.constraint_id,
    field: control.field,
    value: draft.value,
    unit: control.unit,
    evidence_span: control.evidence_span,
    confirmed: draft.confirmed,
    expected_version: control.version,
    is_synthetic: true as const,
  };
}

export function manualControlValidity(
  draft: { value: string; quote: string; page: string | number },
  extractedText: string | null,
  sourceAccessible = false,
): boolean {
  const page = Number(draft.page);
  if (!draft.value.trim() || !draft.quote.trim() || !Number.isInteger(page) || page < 1) {
    return false;
  }
  return extractedText === null ? sourceAccessible : extractedText.includes(draft.quote);
}

export function recoveryNextStep(canScan: boolean): "document" | "scan" {
  return canScan ? "scan" : "document";
}
