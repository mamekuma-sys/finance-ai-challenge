import type { OnchainEvidence } from "@/types/contracts";

/**
 * 온체인 증거 한 건의 영수증.
 *
 * 불변식 6: 모든 온체인 데이터는 LIVE 또는 REPLAY를 노출한다. receipt 없는
 * 데이터를 LIVE로 표시하지 않는다. 그래서 탐색기 링크는 LIVE에서만 연다 —
 * REPLAY의 tx_hash는 합성값이라 탐색기에 존재하지 않는다.
 */
const EXPLORER_BASE = "https://kairos.kaiascan.io/tx";

function truncateHash(hash: string): string {
  return hash.length <= 18 ? hash : `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function formatNumeric(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : value;
}

export function BlockReceipt({ evidence }: { evidence: OnchainEvidence }) {
  const previous = formatNumeric(evidence.previous_value);
  const changed = formatNumeric(evidence.changed_value);

  return (
    <div className="block-receipt" data-mode={evidence.mode}>
      <div className="block-receipt-head">
        <strong>{evidence.event_name}</strong>
        <span className="block-receipt-mode">{evidence.mode}</span>
      </div>

      <dl className="block-receipt-body">
        <div>
          <dt>block</dt>
          <dd>#{evidence.block_number.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>tx</dt>
          <dd data-testid="tx-hash" title={evidence.tx_hash}>
            {truncateHash(evidence.tx_hash)}
          </dd>
        </div>
        {previous !== null && changed !== null ? (
          <div>
            <dt>변화</dt>
            <dd>
              {previous} → {changed}
            </dd>
          </div>
        ) : null}
        {evidence.mode === "REPLAY" && evidence.fixture_version ? (
          <div>
            <dt>fixture</dt>
            <dd>{evidence.fixture_version}</dd>
          </div>
        ) : null}
      </dl>

      {evidence.mode === "LIVE" ? (
        <a href={`${EXPLORER_BASE}/${evidence.tx_hash}`} rel="noreferrer" target="_blank">
          탐색기에서 보기
        </a>
      ) : null}
    </div>
  );
}
