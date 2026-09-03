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

import { CONTROL_NAMES } from "@/components/control-card";
import { createAsset, createContract } from "@/lib/adapters/assets";
import { uploadDocument } from "@/lib/adapters/documents";
import {
  RegistrationPartialError,
  runRegistration,
  type RegistrationDependencies,
} from "@/lib/registration-workflow";
import { safeErrorMessage } from "@/lib/error-presentation";
import {
  DOCUMENT_CHECKLIST,
  SAMPLE_ASSET,
  SAMPLE_CONTRACT_PATH,
  SAMPLE_DOCUMENT_NAME,
  fetchSampleDocument,
  fetchSampleText,
} from "@/lib/registration-samples";

const defaults: RegistrationDependencies = { createAsset, uploadDocument, createContract };

/** 컨트랙트를 넣는 세 가지 경로. 무엇을 골라야 하는지 화면에서 먼저 정한다. */
type CodeMode = "sample" | "source" | "address";

export function RegistrationDialog({
  dependencies = defaults,
}: {
  dependencies?: RegistrationDependencies;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentIsSample, setDocumentIsSample] = useState(false);
  const [codeMode, setCodeMode] = useState<CodeMode>("sample");
  const [sampleContract, setSampleContract] = useState("");
  const [sampleBusy, setSampleBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const assetFirstRef = useRef<HTMLInputElement>(null);
  const documentFirstRef = useRef<HTMLInputElement>(null);
  const contractFirstRef = useRef<HTMLInputElement>(null);
  const sampleRequested = useRef(false);

  useEffect(() => {
    const target = step === 0
      ? assetFirstRef.current
      : step === 1
        ? documentFirstRef.current
        : contractFirstRef.current;
    target?.focus();
  }, [step]);

  /* 샘플이 기본 선택지다. 코드 단계에 들어오면 클릭을 기다리지 않고 미리 불러온다. */
  useEffect(() => {
    if (step !== 2 || codeMode !== "sample" || sampleRequested.current) return;
    sampleRequested.current = true;
    setSampleBusy(true);
    fetchSampleText(SAMPLE_CONTRACT_PATH)
      .then(setSampleContract)
      .catch(() => {
        sampleRequested.current = false;
        setError("샘플 컨트랙트를 불러오지 못했습니다. 코드를 직접 붙여넣으세요.");
      })
      .finally(() => setSampleBusy(false));
  }, [step, codeMode]);

  function field(name: string) {
    return formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  }

  function setValue(name: string, value: string) {
    const target = field(name);
    if (target) target.value = value;
  }

  function fillSampleAsset() {
    setError("");
    setValue("name", SAMPLE_ASSET.name);
    setValue("underlying", SAMPLE_ASSET.underlying);
    setValue("supply", SAMPLE_ASSET.supply);
    setValue("currency", SAMPLE_ASSET.currency);
    setValue("unit", SAMPLE_ASSET.unit);
    assetFirstRef.current?.focus();
  }

  async function useSampleDocument() {
    if (sampleBusy) return;
    setError("");
    setSampleBusy(true);
    try {
      setDocumentFile(await fetchSampleDocument());
      setDocumentIsSample(true);
    } catch {
      setError("샘플 발행조건서를 불러오지 못했습니다. 직접 파일을 선택하세요.");
    } finally {
      setSampleBusy(false);
    }
  }

  function selectCodeMode(mode: CodeMode) {
    setError("");
    setCodeMode(mode);
  }

  function nextStep() {
    setError("");
    if (step === 0) {
      const name = field("name");
      const underlying = field("underlying");
      const supply = Number(field("supply")?.value);
      if (!name?.value.trim()) {
        setError("자산명을 입력하세요. 아래 ‘샘플 값으로 채우기’를 눌러도 됩니다.");
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
    if (step === 1 && !documentFile) {
      setError("발행 문서를 선택하거나 ‘샘플 발행조건서 사용’을 누르세요.");
      documentFirstRef.current?.focus();
      return;
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
    const supply = Number(form.get("supply"));
    const typedSource = String(form.get("source") ?? "").trim();
    const sourceCode = codeMode === "sample" ? sampleContract.trim() : codeMode === "source" ? typedSource : "";
    const address = codeMode === "address" ? String(form.get("address") ?? "").trim() : "";
    if (!documentFile || documentFile.size === 0) {
      setError("발행 문서를 선택하거나 ‘샘플 발행조건서 사용’을 누르세요.");
      return;
    }
    if (!Number.isSafeInteger(supply) || supply <= 0) {
      setError("예정 공급량은 1 이상의 정수여야 합니다.");
      return;
    }
    if (!sourceCode && !address) {
      setError(
        codeMode === "address"
          ? "Kaia 컨트랙트 주소를 입력하세요."
          : "Solidity 코드를 붙여넣거나 샘플 컨트랙트를 선택하세요.",
      );
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
          document: documentFile,
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
              <form ref={formRef} className="registration-form" noValidate onSubmit={submit} aria-busy={pending} aria-describedby={error ? "registration-error" : undefined}>
                <header>
                  <div>
                    <h2>신규 자산 등록</h2>
                    <p>발행 문서와 컨트랙트를 연결하면 통제 불일치를 검사합니다.</p>
                  </div>
                  <Button className="btn btn-small" onPress={close}>
                    닫기
                  </Button>
                </header>
                <ul className="registration-scope" aria-label="고정 범위">
                  <li>자산 유형 <strong>합성 상업용 부동산 수익증권</strong></li>
                  <li>네트워크 <strong>Kaia Kairos · chain 1001</strong></li>
                </ul>
                <ol className="step-progress" aria-label="등록 단계">
                  {["자산", "문서", "코드"].map((label, index) => (
                    <li key={label} aria-current={index === step ? "step" : undefined} data-complete={index < step || undefined}>
                      <span>{index + 1}</span> {label}
                    </li>
                  ))}
                </ol>

                <fieldset className="registration-step" hidden={step !== 0}>
                  <legend>1. 자산 정보</legend>
                  <p>리포트와 경보에 표시될 자산의 이름과 발행 계획입니다. 세 항목 모두 필수입니다.</p>
                  <button className="btn btn-small sample-fill" type="button" onClick={fillSampleAsset}>
                    샘플 값으로 채우기
                  </button>
                  <div className="field">
                    <label htmlFor="registration-name">자산명</label>
                    <input ref={assetFirstRef} id="registration-name" name="name" autoComplete="off" autoFocus aria-describedby="registration-name-help" />
                    <p className="field-help" id="registration-name-help">예: 한강 오피스 수익증권 01</p>
                  </div>
                  <div className="field">
                    <label htmlFor="registration-underlying">기초자산 설명</label>
                    <textarea id="registration-underlying" name="underlying" aria-describedby="registration-underlying-help" />
                    <p className="field-help" id="registration-underlying-help">무엇에서 수익이 나오는지 한두 문장으로 씁니다. 예: 서울 여의도 소재 오피스의 임대수익</p>
                  </div>
                  <div className="field">
                    <label htmlFor="registration-supply">예정 공급량</label>
                    <input id="registration-supply" name="supply" type="number" min="1" step="1" aria-describedby="registration-supply-help" />
                    <p className="field-help" id="registration-supply-help">발행조건서의 최대 발행량과 같은 값을 넣으세요. 문서와 코드가 다르면 그 차이를 불일치로 탐지합니다.</p>
                  </div>
                  <details className="registration-advanced">
                    <summary>표시 단위 · 기본값 사용</summary>
                    <div className="responsive-split">
                      <div className="field">
                        <label htmlFor="registration-currency">통화</label>
                        <input id="registration-currency" name="currency" defaultValue="KRW" />
                      </div>
                      <div className="field">
                        <label htmlFor="registration-unit">토큰 단위</label>
                        <input id="registration-unit" name="unit" defaultValue="TOKEN" />
                      </div>
                    </div>
                  </details>
                </fieldset>

                <fieldset className="registration-step" hidden={step !== 1}>
                  <legend>2. 발행 문서</legend>
                  <p>AI가 이 문서에서 6개 통제조건과 그 근거 문장을 뽑습니다. 아래 조건이 문장으로 들어 있는 발행조건서여야 합니다.</p>
                  <ul className="document-checklist" aria-label="문서에 필요한 통제조건">
                    {DOCUMENT_CHECKLIST.map((item) => (
                      <li key={item.field}>
                        <strong>{CONTROL_NAMES[item.field] ?? item.field}</strong>
                        <span className="field-help">“{item.example}”</span>
                      </li>
                    ))}
                  </ul>
                  <button className="btn btn-small sample-fill" type="button" onClick={useSampleDocument} disabled={sampleBusy}>
                    {sampleBusy ? "불러오는 중…" : "샘플 발행조건서 사용"}
                  </button>
                  <div className="field">
                    <label htmlFor="registration-document">직접 업로드 · PDF 또는 TXT</label>
                    <input
                      ref={documentFirstRef}
                      id="registration-document"
                      name="document"
                      type="file"
                      accept=".pdf,.txt,application/pdf,text/plain"
                      onChange={(event) => {
                        setDocumentFile(event.target.files?.[0] ?? null);
                        setDocumentIsSample(false);
                      }}
                    />
                  </div>
                  {documentFile ? (
                    <p className="state" data-tone="accent" role="status">
                      선택됨 · {documentFile.name}
                      {documentIsSample ? ` (샘플 · ${SAMPLE_DOCUMENT_NAME})` : ""}
                    </p>
                  ) : null}
                </fieldset>

                <fieldset className="registration-step" hidden={step !== 2}>
                  <legend>3. 컨트랙트 코드</legend>
                  <p>문서 조건이 실제 코드에 구현됐는지 비교할 대상입니다. 하나만 고르면 됩니다.</p>
                  <fieldset className="code-mode">
                    <legend>컨트랙트 입력 방법</legend>
                    <label className="check-row">
                      <input ref={contractFirstRef} type="radio" name="codeMode" value="sample" checked={codeMode === "sample"} onChange={() => selectCodeMode("sample")} />
                      샘플 취약 컨트랙트 사용 · 권장
                    </label>
                    <label className="check-row">
                      <input type="radio" name="codeMode" value="source" checked={codeMode === "source"} onChange={() => selectCodeMode("source")} />
                      Solidity 코드 직접 붙여넣기
                    </label>
                    <label className="check-row">
                      <input type="radio" name="codeMode" value="address" checked={codeMode === "address"} onChange={() => selectCodeMode("address")} />
                      배포된 Kaia 주소 입력
                    </label>
                  </fieldset>
                  {codeMode === "sample" ? (
                    <p className="field-help">
                      {sampleBusy
                        ? "샘플 컨트랙트를 불러오는 중입니다…"
                        : sampleContract
                          ? "VulnerableRwaToken.sol · 발행 권한과 한도 검사가 빠진 합성 fixture입니다. 문서 조건과의 불일치가 그대로 드러납니다."
                          : "VulnerableRwaToken.sol 합성 fixture를 사용합니다."}
                    </p>
                  ) : null}
                  {codeMode === "source" ? (
                    <div className="field">
                      <label htmlFor="registration-source">Solidity source</label>
                      <textarea id="registration-source" name="source" rows={8} maxLength={200_000} aria-describedby="registration-source-help" />
                      <p className="field-help" id="registration-source-help">컨트랙트 전체 코드를 붙여넣으세요. 최대 200,000자.</p>
                    </div>
                  ) : null}
                  {codeMode === "address" ? (
                    <div className="field">
                      <label htmlFor="registration-address">Kaia 컨트랙트 주소</label>
                      <input id="registration-address" name="address" placeholder="0x…" pattern="^0x[0-9a-fA-F]{40}$" aria-describedby="registration-address-help" />
                      <p className="field-help" id="registration-address-help">소스가 공개돼 있지 않으면 분석이 제한되고 결과를 ‘검증 제한’으로 표시합니다.</p>
                    </div>
                  ) : null}
                  <p className="row-meta">등록하면 문서에서 통제조건을 추출합니다. 이어서 담당자가 근거를 확인하고 검사를 실행하면 리포트가 만들어집니다.</p>
                </fieldset>

                {pending ? <p className="row-meta" role="status" aria-live="polite">자산 생성, 문서 업로드, 컨트랙트 연결을 순서대로 처리 중입니다. 창을 닫아도 시작된 서버 작업은 유지됩니다.</p> : null}
                {error ? <p className="form-error" id="registration-error" role="alert">{error}</p> : null}
                <footer>
                  <Button className="btn" onPress={close}>취소</Button>
                  <div className="registration-step-actions">
                    {step > 0 ? <button className="btn" type="button" onClick={previousStep}>뒤로: {step === 1 ? "자산" : "문서"}</button> : null}
                    {step < 2 ? <button className="btn btn-primary" type="button" onClick={nextStep}>다음: {step === 0 ? "문서" : "코드"}</button> : (
                      <button className="btn btn-primary" type="submit" disabled={pending || (codeMode === "sample" && !sampleContract)}>{pending ? "등록 중…" : "자산 등록"}</button>
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
