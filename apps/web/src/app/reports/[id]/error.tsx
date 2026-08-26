"use client";

import { ErrorNotice } from "@/components/error-notice";

export default function Error({ reset }: { error: globalThis.Error; reset: () => void }) {
  return <ErrorNotice what="리포트를" reset={reset} />;
}
