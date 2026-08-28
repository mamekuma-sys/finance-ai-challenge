import Link from "next/link";

import { Badge } from "@/components/badge";
import { CodeView } from "@/components/code-view";
import { ControlSourceBadge, FindingSourceBadge } from "@/components/source-badge";
import { IMPLEMENTATION_LABEL, IMPLEMENTATION_TONE } from "@/components/control-card";
import { numeric } from "@/lib/evidence-report";
import type { Linked } from "@/lib/evidence-report";
import type { FindingDiff } from "@/types/ui";

export type ComparePanelVariant = "default" | "compact";

/**
 * 문서와 코드를 좌우로 놓는 대조.
 *
 * 이 제품의 핵심 화면이다. 불변식 5에 따라 모든 Critical/High는 문서
 * page/span과 코드 file/line을 함께 연결한다.
 */
export async function ComparePanel({
  linked,
  assetId,
  excerpt,
  showCode = true,
  variant = "default",
  selected = false,
  readOnly = false,
  diffStatus,
}: {
  linked: Linked;
  assetId: string;
  excerpt?: { firstLine: number; source: string };
  /** 같은 결함이 여러 조건을 깰 때 코드 발췌를 한 번만 보여준다. */
  showCode?: boolean;
  variant?: ComparePanelVariant;
  selected?: boolean;
  readOnly?: boolean;
  diffStatus?: FindingDiff["change"];
}) {
  const { mismatch, control, finding } = linked;
  const diffTone = diffStatus === "RESOLVED" ? "safe" : diffStatus === "NEW" ? "breach" : "warn";

  return (
    <section
      className={`compare-panel${variant === "compact" ? " compare-panel-compact" : ""}`}
      aria-label={selected ? "선택 발견사항 비교" : "발견사항 비교"}
      data-variant={variant}
      data-selected={selected || undefined}
      data-readonly={readOnly || undefined}
    >
      <div className="card-head">
        <h2>문서와 코드 대조</h2>
        {control ? <span className="muted mono" style={{ fontSize: 10.5 }}>{control.field}</span> : null}
        <span className="row-tail">
          {diffStatus ? <Badge tone={diffTone}>{diffStatus}</Badge> : null}
          <Badge tone={IMPLEMENTATION_TONE[mismatch.implementation_status]}>
            {IMPLEMENTATION_LABEL[mismatch.implementation_status]}
          </Badge>
        </span>
      </div>

      <div className="compare">
        <section className="compare-side" aria-label="발행 문서가 요구하는 것">
          <p className="compare-tags">
            발행 문서가 요구하는 것
            {control ? <ControlSourceBadge control={control} /> : null}
          </p>

          {control ? (
            <>
              <p className="compare-value">
                {control.field} {numeric(control.value)}
                {control.unit ? <span className="muted"> {control.unit}</span> : null}
              </p>
              <blockquote className="quote">{control.evidence_span.quote}</blockquote>
              <p className="locator hash-overflow">
                발행규정.pdf · p.{control.evidence_span.page} · span{" "}
                {control.evidence_span.start}–{control.evidence_span.end}
              </p>
              {!readOnly ? (
                <Link
                  className="btn btn-small"
                  style={{ marginTop: 10 }}
                  href={`/assets/${assetId}/document?constraint=${control.constraint_id}`}
                >
                  문서 조항 보기
                </Link>
              ) : null}
            </>
          ) : (
            <p className="muted">연결된 조항이 없습니다.</p>
          )}
        </section>

        <section className="compare-side" aria-label="코드가 실제로 하는 것">
          <p className="compare-tags">
            코드가 실제로 하는 것
            {finding ? <FindingSourceBadge finding={finding} /> : null}
          </p>

          {finding ? (
            <>
              <p className="compare-text">{finding.title}</p>
              {showCode && excerpt
                ? await CodeView({
                    source: excerpt.source,
                    file: finding.code_location.file,
                    startLine: excerpt.firstLine,
                    hit: {
                      start: finding.code_location.start_line,
                      end: finding.code_location.end_line,
                    },
                  })
                : null}
              <p className="locator hash-overflow">
                {finding.code_location.file}:{finding.code_location.start_line}
                {finding.code_location.end_line !== finding.code_location.start_line
                  ? `–${finding.code_location.end_line}`
                  : ""}
                {showCode ? null : " · 위 대조와 같은 결함입니다"}
              </p>
            </>
          ) : (
            <p className="muted">연결된 발견사항이 없습니다.</p>
          )}
        </section>
      </div>
    </section>
  );
}
