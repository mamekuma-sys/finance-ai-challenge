import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable.css";
import "./globals.css";

import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "RWA Guard | Assurance Ledger",
  description: "토큰증권의 발행 문서, 코드, 온체인 증거를 연결하는 연속검증 콘솔",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
