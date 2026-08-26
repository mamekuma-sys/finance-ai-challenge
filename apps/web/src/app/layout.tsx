import type { Metadata } from "next";

// 폰트는 self-host 한다. 심사 기간 무중단 요건상 외부 CDN에 의존하지 않는다.
// 본문 Pretendard, 수치·해시·코드 IBM Plex Mono는 확정이고,
// 제목 서체는 P0 이후로 미룬 미결 항목이다.
// 근거: docs/project/team-technical-stack.md §9
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "RWA Guard | Assurance Ledger",
  description: "토큰증권의 발행 문서, 코드, 온체인 증거를 연결하는 연속검증 콘솔",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
