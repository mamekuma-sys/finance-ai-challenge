import type { ReactNode } from "react";

import { Badge } from "@/components/badge";
import { Icon } from "@/components/icon";
import type { FailedStage, ScanRun } from "@/types/ui";

/**
 * 상태 표시.
 *
 * 실패와 제한을 숨기지 않는 것이 데모와 서비스를 가른다. 부분 실패에서는
 * 성공한 구간을 그대로 보여주고 실패한 구간만 밝힌다.
 */
export function StateNotice({
  tone = "neutral",
  title,
  detail,
  tail,
  headingLevel,
}: {
  tone?: "neutral" | "warn" | "breach" | "accent";
  title: string;
  detail?: ReactNode;
  tail?: ReactNode;
  headingLevel?: 1 | 2;
}) {
  return (
    <div className="state" data-tone={tone} role={tone === "breach" ? "alert" : "status"}>
      <div className="state-text">
        {headingLevel === 1 ? (
          <h1 className="state-title">{title}</h1>
        ) : headingLevel === 2 ? (
          <h2 className="state-title">{title}</h2>
        ) : (
          <p className="state-title">{title}</p>
        )}
        {detail ? <p className="state-detail">{detail}</p> : null}
      </div>
      {tail ? <span className="state-tail">{tail}</span> : null}
    </div>
  );
}

/** ScanRun이 PARTIAL이면 어느 단계가 왜 실패했는지 반드시 밝힌다. */
export function PartialScanNotice({ scan }: { scan: ScanRun }) {
  const failed: FailedStage[] = scan.failed_stages ?? [];

  if (scan.status !== "PARTIAL" || failed.length === 0) {
    return null;
  }

  return (
    <div className="state" data-tone="warn" role="status">
      <div className="state-text">
        <p className="state-title">일부 검사가 완료되지 않았습니다.</p>
        <p className="state-detail">
          아래 단계를 제외한 결과는 그대로 유효합니다.
          <span style={{ display: "block", marginTop: 6 }}>
            {failed.map((stage) => (
              <span key={`${stage.stage}-${stage.rule_id ?? ""}`} style={{ marginRight: 8 }}>
                <Badge tone="warn">{stage.rule_id ?? stage.stage}</Badge>{" "}
                <span className="muted">{stage.reason}</span>
              </span>
            ))}
          </span>
        </p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="muted">{Icon.chart(26)}</span>
      <p style={{ fontWeight: 600, color: "var(--ink)" }}>{title}</p>
      {detail ? <p>{detail}</p> : null}
      {action}
    </div>
  );
}

export function SkeletonScreen({ label }: { label: string }) {
  return (
    <div role="status" aria-label={`${label} 불러오는 중`}>
      <h1 className="screen-title">{label} 불러오는 중</h1>
      <div className="skeleton" style={{ height: 96, marginBottom: 18 }} />
      <div className="skeleton-layout" data-testid="skeleton-layout">
        <div className="skeleton" style={{ height: 260 }} />
        <div className="skeleton" style={{ height: 260 }} />
      </div>
      <p className="muted" style={{ marginTop: 14, fontSize: "var(--t-small)" }}>
        {label} 불러오는 중입니다.
      </p>
    </div>
  );
}
