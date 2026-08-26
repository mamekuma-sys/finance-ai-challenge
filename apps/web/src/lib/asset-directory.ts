/**
 * 자산 표시명과 화면 간 이동.
 *
 * 계약에 자산 표시명 필드가 없어서 여기서 매핑한다. 사용자에게 raw id를
 * 보여주지 않기 위한 임시 조치이며, AssetSummary에 name이 생기면 걷어낸다.
 */
const ASSET_NAMES: Record<string, string> = {
  asset_synthetic_hanriver_01: "Han River Office 01",
};

export function assetNameOf(assetId: string): string {
  return ASSET_NAMES[assetId] ?? assetId;
}

export type ScreenKey = "home" | "document" | "scan" | "asset" | "report";

export interface NavigationItem {
  key: ScreenKey;
  label: string;
  href: string;
  current: boolean;
}

// 리포트 endpoint가 확정되기 전까지 데모 report 하나를 가리킨다.
const DEMO_REPORT_ID = "report_demo_01";

/** PRD §9.1의 권장 내비게이션을 자산 컨텍스트 탭으로 만든다. */
export function navigationFor(assetId: string, current?: ScreenKey): NavigationItem[] {
  const items: Array<Omit<NavigationItem, "current">> = [
    { key: "home", label: "관제", href: "/" },
    { key: "document", label: "발행조건", href: `/assets/${assetId}/document` },
    { key: "scan", label: "검증 결과", href: `/assets/${assetId}/scan` },
    { key: "asset", label: "자산", href: `/assets/${assetId}` },
    { key: "report", label: "리포트", href: `/reports/${DEMO_REPORT_ID}` },
  ];

  return items.map((item) => ({ ...item, current: item.key === current }));
}
