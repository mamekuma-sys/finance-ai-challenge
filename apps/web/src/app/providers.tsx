"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

/**
 * 서버 상태 provider.
 *
 * P0 scan 상태는 TanStack Query polling으로 동작한다. Realtime이나 SSE가
 * 없어도 핵심 경로가 완주해야 하기 때문이다.
 *
 * client를 useState로 만드는 이유는 Next의 요청 간 재사용을 막기 위해서다.
 * 모듈 최상위에 두면 서버에서 요청끼리 cache를 공유하게 된다.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // 재시도 여부는 error envelope의 retryable을 따른다.
            // 그 값이 붙기 전까지는 자동 재시도를 켜지 않는다.
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
