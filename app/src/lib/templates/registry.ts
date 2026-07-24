import { OFFICIAL_SOURCES } from "@/lib/decision/sources";

import type {
  RegulatoryTemplate,
  TemplateStatus,
} from "./types";

export const TEMPLATE_VERSIONS = [
  "TPL-SAFE-DEVICE-001@1.0",
  "TPL-BANK-STOP-001@1.0",
  "TPL-WRITTEN-FOLLOWUP-001@1.1",
  "TPL-CREDENTIAL-RECOVERY-001@1.0",
  "TPL-OFFICIAL-VERIFY-001@1.0",
  "TPL-UNDETERMINED-001@1.0",
  "TPL-PROXY-SCOPE-001@1.0",
] as const;

export type TemplateVersion = (typeof TEMPLATE_VERSIONS)[number];

const INITIAL_CHANGE_LOG = {
  reason: "W1-A 계약 동결본의 승인 문구를 최초 등록",
  changed_by: "GoldenTime W1-A",
  previous_version: "none-initial-version",
  rollback_owner: "GoldenTime 운영 책임자",
} as const;

const PREVIOUS_WRITTEN_FOLLOWUP_DEADLINE = ["3", "영업일"].join("");
const WRITTEN_FOLLOWUP_CHANGE_LOG = {
  reason: `법령 원문 대조: ${PREVIOUS_WRITTEN_FOLLOWUP_DEADLINE} → 신청한 날부터 3일 이내`,
  changed_by: "GoldenTime r5 개정 담당자",
  previous_version: "1.0",
  rollback_owner: "GoldenTime 운영 책임자",
} as const;

export const TEMPLATE_REGISTRY: Readonly<
  Record<TemplateVersion, RegulatoryTemplate>
> = {
  "TPL-SAFE-DEVICE-001@1.0": {
    status: "unconfirmed",
    template_id: "TPL-SAFE-DEVICE-001",
    template_version: "1.0",
    official_source: OFFICIAL_SOURCES["SRC-FSC-MALAPP"],
    source_effective_date: "2026-07-25",
    source_effective_date_confirmed: false,
    source_reviewed_at: "2026-07-25",
    next_review_at: "2026-09-01",
    change_log: INITIAL_CHANGE_LOG,
    body: "의심 기기의 사용을 중지하고, 그 기기와 분리된 안전한 기기에서 공식 대표번호를 확인하세요.",
  },
  "TPL-BANK-STOP-001@1.0": {
    status: "active",
    template_id: "TPL-BANK-STOP-001",
    template_version: "1.0",
    official_source: OFFICIAL_SOURCES["SRC-EASYLAW-STOPPAY"],
    source_effective_date: "2011-09-30",
    source_effective_date_confirmed: true,
    source_reviewed_at: "2026-07-25",
    next_review_at: "2026-09-01",
    change_log: INITIAL_CHANGE_LOG,
    body: "해당 금융회사 공식 대표번호로 연락해 사기이용계좌 지급정지를 요청하세요.",
  },
  "TPL-WRITTEN-FOLLOWUP-001@1.1": {
    status: "active",
    template_id: "TPL-WRITTEN-FOLLOWUP-001",
    template_version: "1.1",
    official_source: OFFICIAL_SOURCES["SRC-EASYLAW-STOPPAY"],
    source_effective_date: "2011-09-30",
    source_effective_date_confirmed: true,
    source_reviewed_at: "2026-07-25",
    next_review_at: "2026-09-01",
    change_log: WRITTEN_FOLLOWUP_CHANGE_LOG,
    body: "긴급하거나 부득이한 사유로 전화 또는 구술로 피해구제를 신청한 경우, 신청한 날부터 3일 이내에 피해구제신청서를 해당 금융회사에 제출해야 합니다. 이어서 1394에서 피해상담, 의심 전화번호·사이트 제보, 관계기관 연계를 안내받으세요.",
  },
  "TPL-CREDENTIAL-RECOVERY-001@1.0": {
    status: "unconfirmed",
    template_id: "TPL-CREDENTIAL-RECOVERY-001",
    template_version: "1.0",
    official_source: OFFICIAL_SOURCES["SRC-FSC-10RULES"],
    source_effective_date: "2026-07-25",
    source_effective_date_confirmed: false,
    source_reviewed_at: "2026-07-25",
    next_review_at: "2026-09-01",
    change_log: INITIAL_CHANGE_LOG,
    body: "공식 대표번호로 인증정보 노출을 알리고, 금융회사 안내에 따라 인증수단 폐기·재발급과 보호조치를 진행하세요.",
  },
  "TPL-OFFICIAL-VERIFY-001@1.0": {
    status: "unconfirmed",
    template_id: "TPL-OFFICIAL-VERIFY-001",
    template_version: "1.0",
    official_source: OFFICIAL_SOURCES["SRC-FSC-10RULES"],
    source_effective_date: "2026-07-25",
    source_effective_date_confirmed: false,
    source_reviewed_at: "2026-07-25",
    next_review_at: "2026-09-01",
    change_log: INITIAL_CHANGE_LOG,
    body: "메시지 속 연락처가 아닌 공식 기관 대표채널에서 사실을 교차 확인하세요.",
  },
  "TPL-UNDETERMINED-001@1.0": {
    status: "unconfirmed",
    template_id: "TPL-UNDETERMINED-001",
    template_version: "1.0",
    official_source: OFFICIAL_SOURCES["SRC-FSS-1332"],
    source_effective_date: "2026-07-25",
    source_effective_date_confirmed: false,
    source_reviewed_at: "2026-07-25",
    next_review_at: "2026-09-01",
    change_log: INITIAL_CHANGE_LOG,
    body: "확인되지 않은 상태를 먼저 확인하고, 근거가 부족하면 판단을 유보한 채 1332 안내를 이용하세요.",
  },
  "TPL-PROXY-SCOPE-001@1.0": {
    status: "unconfirmed",
    template_id: "TPL-PROXY-SCOPE-001",
    template_version: "1.0",
    official_source: OFFICIAL_SOURCES["SRC-EASYLAW-CONTACT"],
    source_effective_date: "2026-07-25",
    source_effective_date_confirmed: false,
    source_reviewed_at: "2026-07-25",
    next_review_at: "2026-09-01",
    change_log: INITIAL_CHANGE_LOG,
    body: "ECRM 온라인 신고 등 본인 제한 절차는 본인이 수행하고, 가족은 준비를 보조합니다.",
  },
};

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function isIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const [, year, month, day] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

function assertReferenceDate(referenceDate: string): void {
  if (!isIsoCalendarDate(referenceDate)) {
    throw new Error(
      "템플릿 기준일은 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.",
    );
  }
}

export function getTemplateStatus(
  template: RegulatoryTemplate,
  referenceDate: string,
): TemplateStatus {
  assertReferenceDate(referenceDate);
  if (template.source_effective_date_confirmed !== true) {
    return "unconfirmed";
  }
  if (template.next_review_at < referenceDate) {
    return "expired";
  }
  return "active";
}

export type TemplateResolution =
  | {
      readonly ok: true;
      readonly status: "active";
      readonly version: TemplateVersion;
      readonly body: string;
      readonly template: RegulatoryTemplate;
    }
  | {
      readonly ok: false;
      readonly status: "unconfirmed" | "expired";
      readonly version: TemplateVersion;
      readonly reason:
        | "SOURCE_EFFECTIVE_DATE_UNCONFIRMED"
        | "NEXT_REVIEW_AT_EXPIRED";
      readonly template: RegulatoryTemplate;
    };

export function resolveTemplate(
  version: TemplateVersion,
  referenceDate: string,
): TemplateResolution {
  const template = TEMPLATE_REGISTRY[version];
  const status = getTemplateStatus(template, referenceDate);

  if (status === "active") {
    return {
      ok: true,
      status,
      version,
      body: template.body,
      template,
    };
  }

  return {
    ok: false,
    status,
    version,
    reason:
      status === "unconfirmed"
        ? "SOURCE_EFFECTIVE_DATE_UNCONFIRMED"
        : "NEXT_REVIEW_AT_EXPIRED",
    template,
  };
}

export function assertTemplateRegistryComplete(
  registry: Readonly<Record<TemplateVersion, RegulatoryTemplate>> =
    TEMPLATE_REGISTRY,
): void {
  for (const templateVersion of TEMPLATE_VERSIONS) {
    const template = registry[templateVersion];
    const changeLog = template.change_log;
    const metadata = [
      template.template_id,
      template.template_version,
      template.official_source.institution,
      template.official_source.document_title,
      template.official_source.url,
      template.source_effective_date,
      template.source_reviewed_at,
      template.next_review_at,
      changeLog.reason,
      changeLog.changed_by,
      changeLog.previous_version,
      changeLog.rollback_owner,
      template.body,
    ];

    if (
      metadata.some((value) => !isNonEmpty(value)) ||
      !["active", "unconfirmed"].includes(template.status) ||
      `${template.template_id}@${template.template_version}` !==
        templateVersion ||
      !isIsoCalendarDate(template.source_effective_date) ||
      !isIsoCalendarDate(template.source_reviewed_at) ||
      !isIsoCalendarDate(template.next_review_at)
    ) {
      throw new Error(`규제 문구 메타데이터가 비었습니다: ${templateVersion}`);
    }
    if (
      template.status === "active" &&
      template.source_effective_date_confirmed !== true
    ) {
      throw new Error(
        `활성 템플릿의 시행일이 확인되지 않았습니다: ${templateVersion}`,
      );
    }
    if (
      template.status === "unconfirmed" &&
      template.source_effective_date_confirmed === true
    ) {
      throw new Error(
        `확인된 템플릿 상태가 unconfirmed입니다: ${templateVersion}`,
      );
    }
  }
}

assertTemplateRegistryComplete();
