"use client";

import { useState, type FormEvent } from "react";
import { Button, Form, Label, TextArea, TextField } from "react-aria-components";

import { listAlerts, updateAlert, type AlertStatus } from "@/lib/adapters/alerts";
import { AppError } from "@/lib/adapters/errors";

const STATUS_LABEL: Record<AlertStatus, string> = {
  NEW: "신규",
  ACKNOWLEDGED: "확인",
  INVESTIGATING: "조사 중",
  RESOLVED: "해결",
  FALSE_POSITIVE: "오탐",
};
const NEXT_STATUS: Record<AlertStatus, AlertStatus[]> = {
  NEW: ["ACKNOWLEDGED"],
  ACKNOWLEDGED: ["INVESTIGATING"],
  INVESTIGATING: ["RESOLVED", "FALSE_POSITIVE"],
  RESOLVED: [],
  FALSE_POSITIVE: [],
};

export function AlertReviewForm({
  alertId,
  assetId,
  initialStatus,
  initialMemo,
  initialUpdatedAt,
}: {
  alertId: string;
  assetId: string;
  initialStatus: AlertStatus;
  initialMemo?: string | null;
  initialUpdatedAt: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [persistedStatus, setPersistedStatus] = useState(initialStatus);
  const [memo, setMemo] = useState(initialMemo ?? "");
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      const changed = await updateAlert(alertId, {
        status,
        memo: memo.trim() || null,
        expected_updated_at: updatedAt,
        is_synthetic: true,
      }, assetId);
      setStatus(changed.status);
      setPersistedStatus(changed.status);
      setMemo(changed.memo ?? "");
      setUpdatedAt(changed.updated_at);
      setMessage("경보 검토 내용이 저장됐습니다.");
    } catch (error) {
      if (error instanceof AppError && error.kind === "conflict") {
        const latest = (await listAlerts({ assetId })).find((item) => item.alert_id === alertId);
        if (latest) {
          setStatus(latest.status);
          setPersistedStatus(latest.status);
          setMemo(latest.memo ?? "");
          setUpdatedAt(latest.updated_at);
        }
        setMessage("다른 변경이 먼저 저장되어 최신 값을 다시 불러왔습니다. 내용을 확인하세요.");
      } else {
        setMessage(
          error instanceof AppError && error.kind === "validation"
            ? "상태와 메모 입력을 확인하세요."
            : "저장하지 못했습니다. 잠시 후 다시 시도하세요.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Form className="alert-review-form" onSubmit={submit} aria-label="경보 상태와 메모 변경">
      <label>
        <span>경보 상태</span>
        <select value={status} onChange={(event) => setStatus(event.target.value as AlertStatus)}>
          {[persistedStatus, ...NEXT_STATUS[persistedStatus]].map((value) => (
            <option key={value} value={value}>{STATUS_LABEL[value]}</option>
          ))}
        </select>
      </label>
      <TextField>
        <Label>검토 메모</Label>
        <TextArea value={memo} maxLength={2000} onChange={(event) => setMemo(event.target.value)} />
      </TextField>
      <Button className="btn btn-small" type="submit" isDisabled={pending}>
        {pending ? "저장 중…" : "변경 저장"}
      </Button>
      <p className="row-meta" aria-live="polite">{message}</p>
      <p className="row-meta">빈 메모를 저장하면 기존 메모를 지웁니다.</p>
      <p className="row-meta">자동 거래정지나 발행 승인은 수행하지 않습니다.</p>
    </Form>
  );
}
