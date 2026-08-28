"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Form,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextField,
} from "react-aria-components";

import {
  getOperatorReadiness,
  logoutOperator,
  unlockOperator,
  type Readiness,
} from "@/lib/adapters/health";
import { AppError } from "@/lib/adapters/errors";

export function OperatorUnlockDialog() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [open, setOpen] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function refreshReadiness() {
    try {
      setReadiness(await getOperatorReadiness());
    } catch {
      setReadiness({
        ready: false,
        server_configured: false,
        backend_operator: false,
        session_active: false,
      });
    }
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    getOperatorReadiness()
      .then((result) => {
        if (active) setReadiness(result);
      })
      .catch(() => {
        if (active) {
          setReadiness({
            ready: false,
            server_configured: false,
            backend_operator: false,
            session_active: false,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await unlockOperator(accessCode);
      setAccessCode("");
      await refreshReadiness();
      setOpen(false);
    } catch (cause) {
      setAccessCode("");
      setError(
        cause instanceof AppError && cause.kind === "unauthorized"
          ? "접근 코드를 확인하세요."
          : "검토자 세션을 시작하지 못했습니다.",
      );
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    try {
      await logoutOperator();
      await refreshReadiness();
    } finally {
      setPending(false);
    }
  }

  if (readiness?.session_active) {
    return (
      <span className="operator-session-control">
        <span className="status-mark" data-freshness="FRESH">검토자 세션 활성</span>
        <button className="btn btn-small" type="button" disabled={pending} onClick={logout}>
          잠금
        </button>
      </span>
    );
  }

  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <Button className="btn btn-small">
        {readiness?.ready === false ? "검토자 설정 확인" : "검토자 잠금 해제"}
      </Button>
      <ModalOverlay className="registration-overlay" isDismissable>
        <Modal className="registration-modal">
          <Dialog aria-label="검토자 잠금 해제">
            {({ close }) => (
              <Form className="registration-form" onSubmit={submit}>
                <header>
                  <div>
                    <h2>검토자 잠금 해제</h2>
                    <p>단일 검토자 P0 변경 세션은 30분 후 만료됩니다.</p>
                  </div>
                  <Button className="btn btn-small" onPress={close}>닫기</Button>
                </header>
                {readiness?.server_configured === false ? (
                  <p className="state" data-tone="breach" role="alert">
                    서버 검토자 환경 설정이 준비되지 않았습니다.
                  </p>
                ) : null}
                <TextField isRequired>
                  <Label>Operator access code</Label>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={accessCode}
                    onChange={(event) => setAccessCode(event.target.value)}
                  />
                </TextField>
                {error ? <p className="form-error" role="alert">{error}</p> : null}
                <footer>
                  <Button className="btn" onPress={close}>취소</Button>
                  <button className="btn btn-primary" type="submit" disabled={pending}>
                    {pending ? "확인 중…" : "잠금 해제"}
                  </button>
                </footer>
              </Form>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
