"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
} from "react-aria-components";

import { createAsset, createContract } from "@/lib/adapters/assets";
import { uploadDocument } from "@/lib/adapters/documents";
import {
  RegistrationPartialError,
  runRegistration,
  type RegistrationDependencies,
} from "@/lib/registration-workflow";
import { safeErrorMessage } from "@/lib/error-presentation";

const defaults: RegistrationDependencies = { createAsset, uploadDocument, createContract };

export function RegistrationDialog({
  dependencies = defaults,
}: {
  dependencies?: RegistrationDependencies;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const assetFirstRef = useRef<HTMLInputElement>(null);
  const documentFirstRef = useRef<HTMLInputElement>(null);
  const contractFirstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const target = step === 0
      ? assetFirstRef.current
      : step === 1
        ? documentFirstRef.current
        : contractFirstRef.current;
    target?.focus();
  }, [step]);

  function field(name: string) {
    return formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  }

  function nextStep() {
    setError("");
    if (step === 0) {
      const name = field("name");
      const underlying = field("underlying");
      const supply = Number(field("supply")?.value);
      if (!name?.value.trim()) {
        setError("자산명을 입력하세요.");
        name?.focus();
        return;
      }
      if (!underlying?.value.trim()) {
        setError("기초자산 설명을 입력하세요.");
        underlying?.focus();
        return;
      }
      if (!Number.isSafeInteger(supply) || supply <= 0) {
        setError("예정 공급량은 1 이상의 정수여야 합니다.");
        field("supply")?.focus();
        return;
      }
    }
    if (step === 1) {
      const documentInput = field("document") as HTMLInputElement | null;
      if (!documentInput?.files?.[0]) {
        setError("PDF 또는 TXT 발행 문서를 선택하세요.");
        documentInput?.focus();
        return;
      }
    }
    setStep((current) => Math.min(current + 1, 2));
  }

  function previousStep() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const file = form.get("document");
    const supply = Number(form.get("supply"));
    const sourceCode = String(form.get("source") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();
    if (!(file instanceof File) || file.size === 0) {
      setError("PDF 또는 TXT 발행 문서를 선택하세요.");
      return;
    }
    if (!Number.isSafeInteger(supply) || supply <= 0) {
      setError("예정 공급량은 1 이상의 정수여야 합니다.");
      return;
    }
    if (!sourceCode && !address) {
      setError("Kaia 컨트랙트 주소 또는 Solidity source를 입력하세요.");
      return;
    }
    if (address && !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setError("Kaia 주소는 0x로 시작하는 40자리 16진수여야 합니다.");
      field("address")?.focus();
      return;
    }
    if (sourceCode.length > 200_000) {
      setError("Solidity source는 200,000자 이하여야 합니다.");
      return;
    }

    setPending(true);
    try {
      const result = await runRegistration(
        {
          asset: {
            name: String(form.get("name") ?? "").trim(),
            asset_type: "SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
            underlying_description: String(form.get("underlying") ?? "").trim(),
            total_planned_supply: supply,
            network: "KAIA_KAIROS",
            currency: String(form.get("currency") ?? "").trim(),
            token_unit: String(form.get("unit") ?? "").trim(),
            is_synthetic: true,
          },
          document: file,
          sourceCode: sourceCode || undefined,
          address: address || undefined,
        },
        dependencies,
      );
      router.push(`/assets/${encodeURIComponent(result.assetId)}/document`);
      router.refresh();
    } catch (cause) {
      if (cause instanceof RegistrationPartialError) {
        router.push(
          `/assets/${encodeURIComponent(cause.assetId)}?registration=${cause.failedStage}_failed`,
        );
        return;
      }
      setError(safeErrorMessage(cause, "등록에 실패했습니다. 입력을 확인하고 다시 시도하세요."));
      setPending(false);
    }
  }

  return (
    <DialogTrigger>
      <Button className="btn">신규 자산 등록</Button>
      <ModalOverlay className="registration-overlay" isDismissable>
        <Modal className="registration-modal">
          <Dialog aria-label="신규 합성 자산 등록">
            {({ close }) => (
              <form ref={formRef} className="registration-form" onSubmit={submit} aria-busy={pending} aria-describedby={error ? "registration-error" : undefined}>
                <header>
                  <div>
                    <h2>신규 자산 등록</h2>
                    <p>합성 상업용 부동산 · Kaia Kairos 범위로 고정됩니다.</p>
                  </div>
                  <Button className="btn btn-small" onPress={close}>
                    닫기
                  </Button>
                </header>
                <ol className="step-progress" aria-label="등록 단계">
                  {["자산", "문서", "코드"].map((label, index) => (
                    <li key={label} aria-current={index === step ? "step" : undefined} data-complete={index < step || undefined}>
                      <span>{index + 1}</span> {label}
                    </li>
                  ))}
                </ol>
                <fieldset className="registration-step" hidden={step !== 0}>
                  <legend>1. 자산 정보</legend>
                  <p>심사 데모에 사용할 합성 자산의 식별 정보와 발행 계획을 입력합니다.</p>
                  <label>자산명<input ref={assetFirstRef} name="name" autoComplete="off" autoFocus /></label>
                  <label>기초자산 설명<textarea name="underlying" /></label>
                  <div className="responsive-split">
                    <label>예정 공급량<input name="supply" type="number" min="1" step="1" /></label>
                    <label>통화<input name="currency" defaultValue="KRW" /></label>
                  </div>
                  <label>토큰 단위<input name="unit" defaultValue="TOKEN" /></label>
                </fieldset>
                <fieldset className="registration-step" hidden={step !== 1}>
                  <legend>2. 발행 문서</legend>
                  <p>통제조건의 page/span 근거가 될 합성 PDF 또는 TXT 문서를 등록합니다.</p>
                  <label>발행 문서 PDF/TXT<input ref={documentFirstRef} name="document" type="file" accept=".pdf,.txt,application/pdf,text/plain" /></label>
                </fieldset>
                <fieldset className="registration-step" hidden={step !== 2}>
                  <legend>3. 컨트랙트 코드</legend>
                  <p>Kaia Kairos(chain 1001) 주소, Solidity source 또는 둘 다 입력할 수 있습니다.</p>
                  <label>Kaia 컨트랙트 주소 · 선택<input ref={contractFirstRef} name="address" placeholder="0x…" pattern="^0x[0-9a-fA-F]{40}$" /></label>
                  <label>Solidity source / fixture · 선택<textarea name="source" rows={8} maxLength={200_000} /></label>
                  <p className="row-meta">주소만 등록하면 소스 분석이 제한될 수 있습니다. 3분 데모는 source fixture 입력을 권장합니다.</p>
                </fieldset>
                {pending ? <p className="row-meta" role="status" aria-live="polite">자산 생성, 문서 업로드, 컨트랙트 연결을 순서대로 처리 중입니다. 창을 닫아도 시작된 서버 작업은 유지됩니다.</p> : null}
                {error ? <p className="form-error" id="registration-error" role="alert">{error}</p> : null}
                <footer>
                  <Button className="btn" onPress={close}>취소</Button>
                  <div className="registration-step-actions">
                    {step > 0 ? <button className="btn" type="button" onClick={previousStep}>뒤로: {step === 1 ? "자산" : "문서"}</button> : null}
                    {step < 2 ? <button className="btn btn-primary" type="button" onClick={nextStep}>다음: {step === 0 ? "문서" : "코드"}</button> : (
                      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "등록 중…" : "자산 등록"}</button>
                    )}
                  </div>
                </footer>
              </form>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
