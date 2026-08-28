import Link from "next/link";

import { OperatorUnlockDialog } from "@/components/operator-unlock-dialog";
import { StateNotice } from "@/components/states";
import type { AppError } from "@/lib/adapters/errors";
import { errorPresentation } from "@/lib/error-presentation";

export function ApiErrorNotice({
  error,
  actionHref,
}: {
  error: AppError;
  actionHref: string;
}) {
  const presentation = errorPresentation(error.kind);
  return (
    <StateNotice
      tone={error.kind === "validation" || error.kind === "conflict" ? "warn" : "breach"}
      title={presentation.title}
      detail={presentation.detail}
      tail={
        error.kind === "unauthorized"
          ? <OperatorUnlockDialog />
          : <Link className="btn" href={actionHref}>{presentation.actionLabel}</Link>
      }
    />
  );
}
