import type { OfficialSource } from "@/lib/decision/sources";

export type TemplateStatus = "active" | "unconfirmed" | "expired";

export interface TemplateChangeLog {
  readonly reason: string;
  readonly changed_by: string;
  readonly previous_version: string;
  readonly rollback_owner: string;
}

export interface RegulatoryTemplate {
  readonly status: Exclude<TemplateStatus, "expired">;
  readonly template_id: string;
  readonly template_version: string;
  readonly official_source: OfficialSource;
  readonly source_effective_date: string;
  readonly source_effective_date_confirmed: boolean;
  readonly source_reviewed_at: string;
  readonly next_review_at: string;
  readonly change_log: TemplateChangeLog;
  readonly body: string;
}
