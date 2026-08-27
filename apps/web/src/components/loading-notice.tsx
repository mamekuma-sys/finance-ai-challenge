/**
 * 세그먼트 loading 경계의 공통 표시.
 *
 * 상태표 §3: spinner만 두지 않고 무엇을 기다리는지 문구로 밝힌다.
 */
export function LoadingNotice({ what }: { what: string }) {
  return (
    <p className="loading-notice" role="status">
      {what} 불러오는 중입니다.
    </p>
  );
}
