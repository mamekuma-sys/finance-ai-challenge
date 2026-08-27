"use client";

/**
 * 세그먼트 error 경계의 공통 표시.
 *
 * `what`은 조사까지 포함한 구다. 조사 형태가 받침에 따라 달라지므로
 * 컴포넌트가 붙이지 않고 호출부가 소유한다.
 *
 * 원본 오류 문구는 화면에 내보내지 않는다. stack trace, SQL, 내부 경로가
 * 사용자에게 노출되면 안 되기 때문이다(api-contract.md §2 규칙 2).
 */
export function ErrorNotice({ what, reset }: { what: string; reset: () => void }) {
  return (
    <div className="error-notice" role="alert">
      <p>{what} 불러오지 못했습니다.</p>
      <button type="button" onClick={reset}>
        다시 시도
      </button>
    </div>
  );
}
