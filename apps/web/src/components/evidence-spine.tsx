import Link from "next/link";

import { Badge } from "@/components/badge";
import type { SpineNode } from "@/lib/evidence-report";

/**
 * Evidence Spine.
 *
 * 하나의 경보가 어떤 증거 체인을 거쳤는지 위에서 아래로 읽힌다.
 * 각 노드에 판정 출처를 함께 달아 어디까지가 기계 분석인지 밝힌다.
 */
export function EvidenceSpine({ nodes }: { nodes: readonly SpineNode[] }) {
  return (
    <ol className="spine" aria-label="판정 증거 연결">
      {nodes.map((node) => (
        <li
          className={`spine-node${node.selected ? " selected-row" : ""}`}
          key={`${node.kind}-${node.locator}`}
          data-kind={node.kind}
          data-selected={node.selected || undefined}
        >
          <span className="spine-rail" aria-hidden="true">
            <span className="spine-dot" />
            <span className="spine-thread" />
          </span>

          <div className="spine-body">
            <p className="spine-kind">
              {node.label}
              {node.source ? <Badge tone="accent">{node.source}</Badge> : null}
            </p>
            <p className="spine-title">
              {node.href ? (
                <Link href={node.href} aria-current={node.selected ? "location" : undefined}>
                  {node.title}
                </Link>
              ) : node.title}
            </p>
            <p className="spine-locator">{node.locator}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
