import type { CSSProperties, ReactNode } from "react";

export function WorkbenchGrid({
  children,
  aside,
  asideWidth = "340px",
  rail,
  content,
  evidence,
  evidenceSummary,
  actions,
  className,
}: {
  children?: ReactNode;
  aside?: ReactNode;
  asideWidth?: string;
  rail?: ReactNode;
  content?: ReactNode;
  evidence?: ReactNode;
  evidenceSummary?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const audit = rail !== undefined || content !== undefined || evidence !== undefined;
  return (
    <div
      className={`workbench-grid${audit ? " audit-workbench-grid" : ""}${className ? ` ${className}` : ""}`}
      data-testid="workbench-grid"
      data-layout={audit ? "audit" : "split"}
      style={{ "--workbench-aside": asideWidth } as CSSProperties}
    >
      {audit ? (
        <>
          <div className="workbench-rail-slot" data-slot="rail">{rail}</div>
          <div className="workbench-content-slot" data-slot="content">{content ?? children}</div>
          <div className="workbench-evidence-slot" data-slot="evidence">{evidence}</div>
          {evidenceSummary ? (
            <div className="workbench-evidence-summary" data-slot="evidence-summary">
              {evidenceSummary}
            </div>
          ) : null}
          {actions ? <div className="workbench-actions-slot" data-slot="actions">{actions}</div> : null}
        </>
      ) : (
        <>
          <div className="workbench-grid-main">{children}</div>
          <div className="workbench-grid-aside">{aside}</div>
        </>
      )}
    </div>
  );
}
