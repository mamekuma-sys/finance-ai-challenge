import { Badge } from "@/components/badge";
import { ControlSourceBadge } from "@/components/source-badge";
import { numeric } from "@/lib/evidence-report";
import type { ControlSpec, ImplementationStatus } from "@/types/ui";

/**
 * 발행 문서에서 뽑은 통제조건 한 건과 그 근거.
 *
 * 값과 원문 인용, page/span을 항상 함께 둔다. 근거 없는 값은 화면에 두지
 * 않는다.
 */
const IMPLEMENTATION_LABEL: Record<ImplementationStatus, string> = {
  IMPLEMENTED: "구현됨",
  PARTIAL: "부분 구현",
  MISSING: "통제 공백",
  UNKNOWN: "판단 불가",
};

const IMPLEMENTATION_TONE = {
  IMPLEMENTED: "safe",
  PARTIAL: "warn",
  MISSING: "breach",
  UNKNOWN: "neutral",
} as const;

/** PRD 4.2 표의 사람이 읽는 이름. 필드명만 보여주면 준법 담당자가 못 읽는다. */
const CONTROL_NAMES: Record<string, string> = {
  max_supply: "최대 발행량",
  collateral_verified: "담보·기초자산 확인",
  issuer_role: "발행 권한",
  oracle_max_age: "오라클 갱신주기",
  price_band_breach: "가격 이상 기준",
  pauser_role: "비상 통제",
};

export function ControlCard({
  control,
  status,
  selected = false,
}: {
  control: ControlSpec;
  status?: ImplementationStatus;
  selected?: boolean;
}) {
  return (
    <article
      className="control"
      data-status={status ?? "UNCHECKED"}
      data-selected={selected ? "true" : undefined}
      id={control.constraint_id}
    >
      <div className="control-tags">
        <span className="control-field">{control.field}</span>
        <span className="row-tail" style={{ display: "flex", gap: 7 }}>
          <ControlSourceBadge control={control} />
          {status ? (
            <Badge tone={IMPLEMENTATION_TONE[status]}>{IMPLEMENTATION_LABEL[status]}</Badge>
          ) : (
            <Badge tone="neutral">미검사</Badge>
          )}
        </span>
      </div>

      <p className="control-name">{CONTROL_NAMES[control.field] ?? control.field}</p>

      <p className="control-value">
        {numeric(control.value)}
        {control.unit ? <span className="control-unit"> {control.unit}</span> : null}
      </p>

      <blockquote className="quote">{control.evidence_span.quote}</blockquote>

      <p className="locator">
        p.{control.evidence_span.page} · span {control.evidence_span.start}–
        {control.evidence_span.end}
      </p>
    </article>
  );
}

export { CONTROL_NAMES, IMPLEMENTATION_LABEL, IMPLEMENTATION_TONE };
