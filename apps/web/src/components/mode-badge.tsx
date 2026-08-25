import type { EvidenceMode } from "@/types/contracts";

export function ModeBadge({ mode }: { mode: EvidenceMode }) {
  return <span className="mode-badge">{mode}</span>;
}
