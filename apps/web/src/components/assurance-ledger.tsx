import { demoFinding } from "@/lib/demo-finding";
import { EvidenceSpine } from "./evidence-spine";
import { ModeBadge } from "./mode-badge";

export function AssuranceLedger() {
  const finding = demoFinding;

  return (
    <main className="ledger-shell">
      <header className="topbar">
        <div className="brand">
          <strong>RWA GUARD</strong>
          <span>ASSURANCE LEDGER / P0 SCAFFOLD</span>
        </div>
        <div className="timestamp">
          <ModeBadge mode={finding.mode} /> · SYNTHETIC FIXTURE
        </div>
      </header>

      <div className="workspace">
        <aside className="panel" aria-label="자산 목록">
          <div className="panel-heading">
            <span>Asset ledger</span>
            <span>1</span>
          </div>
          <button className="asset-button" type="button" aria-current="true">
            ▲ {finding.assetName}
            <small>CRITICAL · 검토 필요</small>
          </button>
          <button className="asset-button" type="button" disabled>
            ○ 다음 자산
            <small>P2 다중 자산 범위</small>
          </button>
        </aside>

        <section className="panel" aria-labelledby="finding-title">
          <div className="panel-heading">
            <span>Contract verification</span>
            <span className="mono">{finding.ruleVersion}</span>
          </div>

          <div className="finding-header">
            <h1 id="finding-title">{finding.title}</h1>
            <div className="risk-ruler" aria-label={`Exploit risk ${finding.risk}`}>
              <span>EXPLOIT RISK</span>
              <div className="risk-value">{finding.risk}</div>
              <div className="ruler-track" aria-hidden="true">
                <span className="ruler-marker" />
              </div>
            </div>
          </div>

          <div className="finding-grid">
            <article className="evidence-card">
              <p className="eyebrow">SPEC / {finding.documentLocator}</p>
              <blockquote>“{finding.documentQuote}”</blockquote>
            </article>
            <article className="evidence-card">
              <p className="eyebrow">CODE / {finding.codeLocator}</p>
              <pre>
                <code>{finding.codeExcerpt}</code>
              </pre>
            </article>
          </div>

          <div className="status-row">
            <span>
              STATUS <strong>{finding.status}</strong>
            </span>
            <span>
              SEVERITY <strong>{finding.severity}</strong>
            </span>
            <span>
              ASSET <strong>{finding.assetId}</strong>
            </span>
          </div>
        </section>

        <aside className="panel" aria-label="Evidence Spine">
          <div className="panel-heading">
            <span>Evidence spine</span>
            <ModeBadge mode={finding.mode} />
          </div>
          <EvidenceSpine nodes={finding.spine} />
        </aside>
      </div>

      <footer className="event-ledger">
        <span>REPLAY EVENT</span>
        <span>Minted · supply 120,000 · issuance limit exceeded</span>
        <span>fixture v0.1.0</span>
      </footer>
    </main>
  );
}
