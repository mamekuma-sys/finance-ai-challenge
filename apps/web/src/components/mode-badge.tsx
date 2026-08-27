import type { EvidenceMode } from "@/types/ui";

export function ModeBadge({ mode }: { mode: EvidenceMode }) {
  return <span className="mode-badge">{mode}</span>;
}
