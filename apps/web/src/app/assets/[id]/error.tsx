"use client";

import { ErrorNotice } from "@/components/error-notice";

export default function Error({ reset }: { error: globalThis.Error; reset: () => void }) {
  return <ErrorNotice what="자산 정보를" reset={reset} />;
}
