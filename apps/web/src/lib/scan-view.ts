import type {
  CodeFinding,
  ControlSpec,
  ImplementationStatus,
  MismatchFinding,
  ScanStatus,
} from "@/types/ui";
import { hasConfirmedP0Controls } from "@/lib/document-review-state";

export function implementationByConstraint(
  mismatches: readonly MismatchFinding[],
): Map<string, ImplementationStatus> {
  return new Map(mismatches.map((item) => [item.constraint_id, item.implementation_status]));
}

export type ScanVerdict =
  | "PASS"
  | "INCOMPLETE"
  | "CONTROL_REVIEW_REQUIRED"
  | "PROBABLE_REVIEW_REQUIRED"
  | "FINDING_REVIEW_REQUIRED"
  | "UNMAPPED_FINDING"
  | "CONFIRMED_RISK"
  | "GAPS";

export function scanVerdict(input: {
  status: ScanStatus;
  controls: readonly Pick<ControlSpec, "constraint_id" | "field" | "confirmed">[];
  findings: readonly Pick<CodeFinding, "finding_id" | "status" | "severity">[];
  mismatches: readonly Pick<MismatchFinding, "finding_id" | "implementation_status">[];
}): ScanVerdict {
  if (input.status !== "COMPLETED") return "INCOMPLETE";
  if (!hasConfirmedP0Controls(input.controls)) {
    return "CONTROL_REVIEW_REQUIRED";
  }
  if (input.findings.some((item) => item.status === "NEEDS_REVIEW" || item.status === "UNKNOWN")) {
    return "FINDING_REVIEW_REQUIRED";
  }
  if (input.findings.some((item) => item.status === "PROBABLE")) {
    return "PROBABLE_REVIEW_REQUIRED";
  }
  const confirmed = input.findings.filter((item) => item.status === "CONFIRMED");
  const unknownImplementation = new Set(
    input.mismatches
      .filter((item) => item.implementation_status === "UNKNOWN")
      .map((item) => item.finding_id),
  );
  if (confirmed.some((item) => unknownImplementation.has(item.finding_id))) {
    return "FINDING_REVIEW_REQUIRED";
  }
  const mapped = new Set(input.mismatches.map((item) => item.finding_id));
  if (confirmed.some((item) => !mapped.has(item.finding_id))) return "UNMAPPED_FINDING";
  if (confirmed.length > 0) return "CONFIRMED_RISK";
  if (input.mismatches.some((item) => item.implementation_status !== "IMPLEMENTED")) {
    return "GAPS";
  }
  return "PASS";
}

export function reportState(status: "QUEUED" | "RUNNING" | "READY" | "FAILED") {
  if (status === "FAILED") return "FAILED" as const;
  if (status === "QUEUED" || status === "RUNNING") return "PROGRESS" as const;
  return "READY" as const;
}
