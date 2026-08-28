import type { EvidenceReport } from "@/types/ui";

const REVIEWER_NOTICE =
  "이 리포트는 합성 데이터 기반 기술적 통제 보조 자료입니다. 투자 권유, 법률 의견, 자동 발행 승인 또는 거래정지를 수행하지 않으며 담당자 검토가 필요합니다.";

export function reportDisclosureOf(
  report: EvidenceReport,
  envelopeLimitations: readonly string[] = [],
) {
  return {
    inputHashes: report.lineage.input_hashes,
    ruleVersions: report.lineage.rule_versions,
    limitations: [...new Set([...report.lineage.limitations, ...envelopeLimitations])],
    reviewerNotice: REVIEWER_NOTICE,
  };
}
