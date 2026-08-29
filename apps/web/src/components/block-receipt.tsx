import { Badge } from "@/components/badge";
import { numeric } from "@/lib/evidence-report";
import type { OnchainEvidence } from "@/types/ui";

/**
 * 온체인 증거 한 건의 영수증.
 *
 * 불변식 6: 모든 온체인 데이터는 LIVE 또는 REPLAY를 노출한다. 탐색기 링크는
 * LIVE에서만 연다 — REPLAY의 tx_hash는 합성값이라 탐색기에 존재하지 않고,
 * 링크를 걸면 receipt 없는 데이터가 실거래처럼 보인다.
 */
const EXPLORER = "https://kairos.kaiascan.io/tx";

function short(hash: string) {
  return hash.length <= 20 ? hash : `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function BlockReceipt({ evidence }: { evidence: OnchainEvidence }) {
  const live = evidence.mode === "LIVE";
  const verifiedLive =
    live
    && evidence.receipt_status === "SUCCESS"
    && Boolean(evidence.block_hash)
    && Boolean(evidence.verified_at)
    && evidence.chain_id === 1001
    && /^0x[0-9a-fA-F]{64}$/.test(evidence.tx_hash);

  return (
    <div className="card" data-mode={evidence.mode}>
      <div className="receipt-head">
        {evidence.event_name}
        <span className="row-tail">
          <Badge tone={verifiedLive ? "safe" : live ? "warn" : "accent"}>
            {verifiedLive ? "LIVE · 영수증 확인" : live ? "LIVE · 증거 불완전" : "REPLAY · 재현"}
          </Badge>
        </span>
      </div>

      <dl className="receipt-body">
        <div>
          <dt>block</dt>
          <dd>#{evidence.block_number.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>tx</dt>
          <dd data-testid="tx-hash" title={evidence.tx_hash}>
            {short(evidence.tx_hash)}
          </dd>
        </div>
        {evidence.previous_value && evidence.changed_value ? (
          <div>
            <dt>변화</dt>
            <dd>
              {numeric(evidence.previous_value)} → {numeric(evidence.changed_value)}
            </dd>
          </div>
        ) : null}
        {!live && evidence.fixture_version ? (
          <div>
            <dt>fixture</dt>
            <dd>{evidence.fixture_version}</dd>
          </div>
        ) : null}
      </dl>

      {verifiedLive ? (
        <a
          className="btn btn-small"
          style={{ margin: "0 16px 14px" }}
          href={`${EXPLORER}/${evidence.tx_hash}`}
          rel="noreferrer"
          target="_blank"
        >
          탐색기에서 보기
        </a>
      ) : null}
    </div>
  );
}
