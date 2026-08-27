import type { ControlSpec } from "@/types/contracts";

/**
 * 발행 문서에서 뽑은 통제조건 한 건과 그 근거.
 *
 * 값과 원문 인용, page/span을 항상 함께 둔다. 근거 없는 값은 화면에 두지
 * 않는다. 원문 PDF 뷰어는 업로드 API가 생긴 뒤에 붙인다.
 */
export function ControlEvidence({ control }: { control: ControlSpec }) {
  const value =
    typeof control.value === "number" ? control.value.toLocaleString("en-US") : control.value;

  return (
    <article className="control" data-confirmed={control.confirmed}>
      <header className="control-head">
        <span className="control-field">{control.field}</span>
        <span className="control-status">{control.confirmed ? "확정" : "확인 필요"}</span>
      </header>

      <p className="control-value">
        <strong>{value}</strong>
        {control.unit ? <span className="control-unit">{control.unit}</span> : null}
      </p>

      <blockquote className="control-quote">{control.evidence_span.quote}</blockquote>

      <p className="control-locator">
        문서 p.{control.evidence_span.page} · span {control.evidence_span.start}–
        {control.evidence_span.end}
      </p>
    </article>
  );
}
