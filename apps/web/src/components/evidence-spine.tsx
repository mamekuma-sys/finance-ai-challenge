import type { SpineNode } from "@/types/contracts";

export function EvidenceSpine({ nodes }: { nodes: SpineNode[] }) {
  return (
    <ol className="spine" aria-label="판정 증거 연결">
      {nodes.map((node) => (
        <li className="spine-node" key={`${node.kind}-${node.locator}`}>
          <span className="spine-label">{node.kind}</span>
          <div className="spine-content">
            <strong>{node.title}</strong>
            <span>{node.locator}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
