/**
 * 자산 표시명과 화면 간 이동.
 *
 * 표시명은 AssetSummary.name에서 오지만 데모 report에는 자산 목록이 없어
 * 여기서 보완한다. /v1/assets가 붙으면 이 매핑은 사라진다.
 */
const ASSET_NAMES: Record<string, string> = {
  asset_synthetic_hanriver_01: "Han River Office 01",
};

export function assetNameOf(assetId: string, given?: string | null): string {
  return given ?? ASSET_NAMES[assetId] ?? assetId;
}

export type ScreenKey = "home" | "controls" | "scan" | "asset" | "report";

export interface NavItem {
  key: ScreenKey;
  label: string;
  href: string;
}

export function navigationFor(assetId: string, reportId: string | null = null): NavItem[] {
  const asset = encodeURIComponent(assetId);
  const report = encodeURIComponent(reportId ?? "report_pending");
  return [
    { key: "home", label: "관제", href: "/" },
    { key: "controls", label: "발행조건", href: `/assets/${asset}/document` },
    { key: "scan", label: "검증 결과", href: `/assets/${asset}/scan` },
    { key: "asset", label: "자산", href: `/assets/${asset}` },
    { key: "report", label: "리포트", href: `/reports/${report}` },
  ];
}

/** 시각은 화면 전체에서 KST 단일 표기다. 감사 문서에서 시간대를 섞지 않는다. */
export function formatKst(iso: string | null | undefined, withSeconds = true): string {
  if (!iso) return "—";

  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";

  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const time = withSeconds
    ? `${get("hour")}:${get("minute")}:${get("second")}`
    : `${get("hour")}:${get("minute")}`;

  return `${get("year")}-${get("month")}-${get("day")} ${time} KST`;
}
