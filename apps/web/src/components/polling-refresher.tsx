"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type StopReason = "TIMEOUT" | "WORKER";

function configuredNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function PollingRefresher({
  active,
  interval = configuredNumber(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS, 1_500),
  maxAttempts = configuredNumber(process.env.NEXT_PUBLIC_POLL_MAX_ATTEMPTS, 40),
  timeoutMs = configuredNumber(process.env.NEXT_PUBLIC_POLL_TIMEOUT_MS, 60_000),
  onRefresh,
}: {
  active: boolean;
  interval?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  onRefresh?: () => void | Promise<unknown>;
}) {
  const router = useRouter();
  const attempts = useRef(0);
  const startedAt = useRef<number | null>(null);
  const [stopReason, setStopReason] = useState<StopReason | null>(null);

  useEffect(() => {
    if (!active) {
      attempts.current = 0;
      startedAt.current = null;
      return;
    }
    if (stopReason) return;
    if (startedAt.current === null) startedAt.current = Date.now();
    let cancelled = false;
    const tick = async () => {
      if (
        Date.now() - (startedAt.current ?? Date.now()) >= timeoutMs
        || attempts.current >= maxAttempts
      ) {
        setStopReason("TIMEOUT");
        return;
      }
      try {
        const response = await fetch("/api/readiness", { cache: "no-store" });
        let body: { ready?: boolean } | null = null;
        try {
          body = await response.clone().json() as { ready?: boolean };
        } catch {
          body = null;
        }
        if (!response.ok || body?.ready === false) {
          if (!cancelled) setStopReason("WORKER");
          return;
        }
      } catch {
        if (!cancelled) setStopReason("WORKER");
        return;
      }
      if (cancelled) return;
      attempts.current += 1;
      await (onRefresh ? onRefresh() : router.refresh());
      if (!cancelled && attempts.current >= maxAttempts) setStopReason("TIMEOUT");
    };
    const timer = window.setInterval(() => void tick(), interval);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, interval, maxAttempts, onRefresh, router, stopReason, timeoutMs]);

  if (!stopReason) return null;
  return (
    <p className="state" data-tone="warn" role="alert">
      처리 지연 · worker 확인 후 다시 시도하세요.{" "}
      <button
        className="btn btn-small"
        type="button"
        onClick={() => {
          attempts.current = 0;
          startedAt.current = Date.now();
          setStopReason(null);
          void (onRefresh ? onRefresh() : router.refresh());
        }}
      >
        재시도
      </button>
    </p>
  );
}
