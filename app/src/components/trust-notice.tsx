export function TrustNotice() {
  return (
    <footer className="trust-notice" aria-label="서비스 한계와 재확인 안내">
      <div>
        <strong>공식 출처를 함께 확인하세요.</strong>
        <p>
          상태 선택과 규칙 결과에는 오분류 가능성이 있습니다. 금융회사·경찰·
          금융감독원 등 공식 채널에서 다시 확인하세요.
        </p>
      </div>
      <p className="authority-limit">
        이 서비스는 지급정지·신고 접수·수사 판정을 수행하지 않습니다.
      </p>
    </footer>
  );
}
