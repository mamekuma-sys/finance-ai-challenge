"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createContract } from "@/lib/adapters/assets";
import { uploadDocument } from "@/lib/adapters/documents";
import { createScan } from "@/lib/adapters/scans";
import { recoveryNextStep } from "@/lib/document-review-state";
import { safeErrorMessage } from "@/lib/error-presentation";

export function AssetRecoveryActions({
  assetId,
  needsDocument,
  needsContract,
  contractId,
  baseScanId,
  canScan,
}: {
  assetId: string;
  needsDocument: boolean;
  needsContract: boolean;
  contractId?: string;
  baseScanId?: string;
  canScan: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function recoverDocument(file: File | undefined) {
    if (!file || pending) return;
    setPending(true);
    try {
      await uploadDocument(assetId, file);
      router.push(`/assets/${assetId}/document`);
      router.refresh();
    } catch (error) {
      setMessage(safeErrorMessage(error, "문서 업로드에 실패했습니다."));
      setPending(false);
    }
  }

  async function scanSource(source: string) {
    const normalized = source.trim();
    if (!normalized) return setMessage("Solidity source를 입력하세요.");
    if (normalized.length > 200_000) return setMessage("Source는 200,000자 이하여야 합니다.");
    if (pending) return;
    setPending(true);
    try {
      const contract = await createContract(assetId, {
        source_code: normalized,
        chain_id: 1001,
        is_synthetic: true,
      });
      if (recoveryNextStep(canScan) === "document") {
        router.push(`/assets/${assetId}/document`);
        return;
      }
      const scan = await createScan(assetId, {
        contract_id: contract.contract_id,
        base_scan_id: baseScanId,
        is_synthetic: true,
      });
      router.push(`/assets/${assetId}/scan?scan=${scan.scan_id}${baseScanId ? `&base=${baseScanId}` : ""}`);
    } catch (error) {
      setMessage(safeErrorMessage(error, "컨트랙트 검사 시작에 실패했습니다."));
      setPending(false);
    }
  }

  async function scanExisting() {
    if (!contractId || pending || !canScan) return;
    setPending(true);
    try {
      const scan = await createScan(assetId, { contract_id: contractId, is_synthetic: true });
      router.push(`/assets/${assetId}/scan?scan=${scan.scan_id}`);
    } catch (error) {
      setMessage(safeErrorMessage(error, "검증 시작에 실패했습니다."));
      setPending(false);
    }
  }

  return (
    <section className="recovery-actions" aria-label="등록 복구와 재검사">
      {!canScan ? <p className="state" data-tone="warn">검사 전 필수 통제조건 6개를 모두 확정하세요. Source 연결은 계속할 수 있습니다.</p> : null}
      {needsDocument ? <label>문서 재업로드<input type="file" accept=".pdf,.txt" disabled={pending} onChange={(event) => recoverDocument(event.target.files?.[0])} /></label> : null}
      {contractId && !baseScanId ? <button className="btn btn-primary" type="button" disabled={pending || !canScan} onClick={scanExisting}>검증 시작</button> : null}
      <label>{needsContract ? "컨트랙트 source 재연결" : "재검사 Solidity source"}<textarea id="recovery-source" rows={6} maxLength={200_000} /></label>
      <button className="btn" type="button" disabled={pending} onClick={() => scanSource((document.getElementById("recovery-source") as HTMLTextAreaElement).value)}>
        {baseScanId ? "새 source로 재검사" : "Source 연결 후 검사"}
      </button>
      {message ? <p className="form-error" role="alert">{message}</p> : null}
    </section>
  );
}
