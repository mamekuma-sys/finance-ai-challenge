import Link from "next/link";

import { Badge } from "@/components/badge";
import { CoverageCard } from "@/components/coverage-card";
import { EvidenceSpine } from "@/components/evidence-spine";
import { HomeActions } from "@/components/home-actions";
import { RiskRuler } from "@/components/risk-ruler";
import { VerdictBanner } from "@/components/verdict-banner";
import {
  confirmedRiskFindings,
  evidenceModeOf,
  leadMismatch,
  linkOf,
  spineOf,
} from "@/lib/evidence-report";
import type { AlertSummary, EvidenceReport } from "@/types/ui";

export function HomeTheater({
  assetId,
  assetName,
  report,
  alert,
}: {
  assetId: string;
  assetName: string;
  report: EvidenceReport;
  alert?: AlertSummary;
}) {
  const mismatch = leadMismatch(report);
  const linked = mismatch ? linkOf(report, mismatch) : undefined;
  const mode = evidenceModeOf(report);
  const replay = report.onchain_evidence.find((item) => item.mode === "REPLAY");
  const confirmedFindings = confirmedRiskFindings(report);

  return (
    <article className="home-theater" aria-label={`${assetName} Evidence Theater`}>
      <header className="theater-intro">
        <p className="key">EVIDENCE THEATER · 최위험 저장 리포트</p>
        <div className="theater-status" aria-label="홈 증거 상태">
          <Badge tone="neutral">SYNTHETIC</Badge>
          <Badge tone={mode === "LIVE" ? "safe" : mode === "REPLAY" ? "accent" : "neutral"}>
            {mode === "LIVE"
              ? "LIVE · receipt 확인"
              : mode === "REPLAY"
                ? `REPLAY · fixture ${replay?.fixture_version ?? "미제공"}`
                : "온체인 증거 없음"}
          </Badge>
          <span className="mono">{report.scan_run.status}</span>
        </div>
      </header>

      <div className="theater-grid">
        <div className="theater-verdict">
          <VerdictBanner
            report={report}
            assetId={assetId}
            reportId={report.report_id}
            theater
          />
          <div className="theater-metrics">
            <div className="theater-metric">
              <RiskRuler findings={confirmedFindings} compact />
            </div>
            <div className="theater-metric">
              <CoverageCard report={report} />
            </div>
          </div>
        </div>

        <section className="theater-evidence" aria-label="최상위 불일치 대조">
          <div className="theater-section-head">
            <p className="key">TOP FINDING · DOCUMENT ↔ CODE</p>
            {mismatch ? <Badge tone="breach">{mismatch.implementation_status}</Badge> : null}
          </div>
          {linked?.control && linked.finding ? (
            <div className="theater-compare">
              <section aria-label="문서 약속">
                <p className="compare-tags">문서 약속</p>
                <blockquote className="quote">{linked.control.evidence_span.quote}</blockquote>
                <Link
                  className="locator"
                  href={`/assets/${encodeURIComponent(assetId)}/document?constraint=${encodeURIComponent(
                    linked.control.constraint_id,
                  )}`}
                >
                  p.{linked.control.evidence_span.page} · span{" "}
                  {linked.control.evidence_span.start}–{linked.control.evidence_span.end}
                </Link>
              </section>
              <section aria-label="코드 현실">
                <p className="compare-tags">코드 현실</p>
                <p className="compare-text">{linked.finding.title}</p>
                <Link
                  className="locator"
                  href={`/assets/${encodeURIComponent(assetId)}/scan?scan=${encodeURIComponent(
                    report.scan_run.scan_id,
                  )}&finding=${encodeURIComponent(linked.finding.finding_id)}`}
                >
                  {linked.finding.code_location.file.split("/").pop()}:
                  {linked.finding.code_location.start_line}
                </Link>
              </section>
            </div>
          ) : (
            <p className="muted">최상위 불일치에 연결된 문서·코드 근거가 없습니다.</p>
          )}

          <div className="theater-spine">
            <p className="key">EVIDENCE SPINE</p>
            {mismatch ? (
              <EvidenceSpine nodes={spineOf(report, mismatch, assetId, alert)} />
            ) : (
              <p className="muted">연결된 증거가 없습니다.</p>
            )}
          </div>
        </section>

        <aside className="theater-actions" aria-label="다음 행동">
          <p className="key">VERIFY THE CLAIM</p>
          <h2>샘플을 재현하거나 직접 자료를 연결하세요.</h2>
          <p className="muted">
            자동 승인 없이 문서 조항과 결정론적 코드 근거를 담당자가 확인합니다.
          </p>
          <HomeActions />
          <div className="theater-links">
            <Link
              className="btn"
              href={`/assets/${encodeURIComponent(assetId)}/scan?scan=${encodeURIComponent(
                report.scan_run.scan_id,
              )}${linked?.finding ? `&finding=${encodeURIComponent(linked.finding.finding_id)}` : ""}`}
            >
              전체 검사 근거
            </Link>
            <Link className="btn" href={`/reports/${encodeURIComponent(report.report_id)}`}>
              저장 리포트
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
