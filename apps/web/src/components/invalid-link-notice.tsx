import type { InvalidUrlState } from "@/lib/url-state";

const REASON_LABEL = {
  empty: "값이 비어 있습니다",
  duplicate: "값이 중복되었습니다",
  invalid: "허용되지 않는 형식입니다",
  not_allowed: "이 화면에서 사용할 수 없습니다",
  missing_reference: "대상을 찾을 수 없습니다",
} as const;

export function InvalidLinkNotice({ invalid }: { invalid: InvalidUrlState[] }) {
  return (
    <section className="state invalid-link-notice" data-tone="warn" role="alert">
      <div className="state-text">
        <h1 className="state-title">잘못된 링크입니다.</h1>
        <p className="state-detail">
          선택 상태를 적용하지 않았습니다. 주소를 확인하거나 기본 화면으로 돌아가세요.
        </p>
        <ul className="invalid-link-list">
          {invalid.map((item) => (
            <li key={`${item.key}-${item.reason}`}>
              <code>{item.key}</code> — {REASON_LABEL[item.reason]}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
