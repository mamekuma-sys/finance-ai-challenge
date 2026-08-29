"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { RegistrationDialog } from "@/components/registration-dialog";
import { bootstrapDemo } from "@/lib/adapters/demo";
import { safeErrorMessage } from "@/lib/error-presentation";

export function HomeActions() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function startDemo() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const demo = await bootstrapDemo();
      router.push(
        `/assets/${encodeURIComponent(demo.asset_id)}/scan?scan=${encodeURIComponent(demo.scan_id)}`,
      );
      router.refresh();
    } catch (cause) {
      setError(safeErrorMessage(cause, "샘플 검증을 시작하지 못했습니다."));
      setPending(false);
    }
  }

  return (
    <div className="home-actions">
      <button className="btn btn-primary" type="button" onClick={startDemo} disabled={pending}>
        {pending ? "샘플 준비 중…" : "샘플 검증 시작"}
      </button>
      <RegistrationDialog />
      {error ? <span className="form-error" role="alert">{error}</span> : null}
    </div>
  );
}
