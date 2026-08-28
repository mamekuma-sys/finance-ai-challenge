"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/badge";
import { CONTROL_NAMES } from "@/components/control-card";
import { PollingRefresher } from "@/components/polling-refresher";
import {
  getDocument,
  getDocumentContent,
  updatePolicies,
  type Control,
} from "@/lib/adapters/documents";
import { createScan } from "@/lib/adapters/scans";
import {
  controlDraft,
  hasConfirmedP0Controls,
  manualControlValidity,
  P0_CONTROL_FIELDS,
  policyPatch,
  type ControlDraft,
} from "@/lib/document-review-state";

const terminal = new Set(["READY", "PARTIAL", "FAILED"]);
export function DocumentReview({
  assetId,
  documentId,
  contractId,
}: {
  assetId: string;
  documentId: string;
  contractId?: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const selected = search.get("constraint");
  const [activeKey, setActiveKey] = useState<string | null>(selected);
  const document = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocument(documentId),
  });
  const content = useQuery({
    queryKey: ["document-content", documentId],
    queryFn: () => getDocumentContent(documentId),
    retry: false,
  });
  const [drafts, setDrafts] = useState<Record<string, ControlDraft>>({});
  const [manual, setManual] = useState<Record<string, {
    value: string;
    unit: string;
    page: string;
    quote: string;
    confirmed: boolean;
  }>>({});
  const [manualError, setManualError] = useState("");
  const controls = document.data?.controls ?? [];
  const missingFields = P0_CONTROL_FIELDS.filter(
    (field) => !controls.some((control) => control.field === field),
  );
  const requestedKey = activeKey ?? selected;
  const activeSelection = controls.some((control) => control.constraint_id === requestedKey)
    ? requestedKey
    : missingFields.some((field) => `manual:${field}` === requestedKey)
      ? requestedKey
      : controls[0]?.constraint_id ?? (missingFields[0] ? `manual:${missingFields[0]}` : null);

  useEffect(() => {
    if (!activeSelection || !document.data) return;
    const source = window.document.getElementById(`source-${activeSelection}`);
    const card = window.document.getElementById(activeSelection)
      ?? window.document.getElementById(`editor-${activeSelection}`);
    source?.scrollIntoView?.({ block: "center", behavior: "auto" });
    source?.focus({ preventScroll: true });
    card?.scrollIntoView?.({ block: "center", behavior: "auto" });
    card?.focus({ preventScroll: true });
  }, [activeSelection, content.data, document.data]);

  const save = useMutation({
    mutationFn: (control: Control) => {
      const draft = controlDraft(control, drafts[control.constraint_id]);
      return updatePolicies(assetId, {
        document_id: documentId,
        is_synthetic: true,
        policies: [policyPatch(control, draft)],
      });
    },
    onSuccess: () => {
      const next = missingFields[0] ? `manual:${missingFields[0]}` : null;
      if (next) {
        setActiveKey(next);
        router.replace(`?constraint=${encodeURIComponent(next)}`);
      }
      return queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    },
  });
  const scan = useMutation({
    mutationFn: () => createScan(assetId, { contract_id: contractId!, is_synthetic: true }),
    onSuccess: (created) => router.push(`/assets/${assetId}/scan?scan=${created.scan_id}`),
  });

  if (document.isPending) return <p role="status" aria-live="polite">문서 처리 상태를 확인 중입니다…</p>;
  if (document.isError || !document.data) return <p role="alert">문서를 불러오지 못했습니다. <button className="btn btn-small" type="button" onClick={() => document.refetch()}>다시 시도</button></p>;
  const selectedControl = controls.find((control) => control.constraint_id === activeSelection);
  const selectedManualField = activeSelection?.startsWith("manual:")
    ? activeSelection.slice("manual:".length)
    : undefined;
  const selectedText = content.data?.text;
  const selectedSpan = selectedControl?.evidence_span;
  const hasExactTextSpan = Boolean(
    selectedText
      && selectedSpan
      && selectedSpan.start >= 0
      && selectedSpan.end <= selectedText.length
      && selectedText.slice(selectedSpan.start, selectedSpan.end) === selectedSpan.quote,
  );
  const invalidConstraint = selected !== null
    && !controls.some((control) => control.constraint_id === selected)
    && !missingFields.some((field) => `manual:${field}` === selected);
  const allConfirmed = hasConfirmedP0Controls(
    controls.map((control) => ({
      field: control.field,
      confirmed: drafts[control.constraint_id]?.confirmed ?? control.confirmed,
    })),
  );
  const sourceAccessible = Boolean(content.data?.text || content.data?.content_base64);
  const selectConstraint = (key: string) => {
    setActiveKey(key);
    router.replace(`?constraint=${encodeURIComponent(key)}`);
  };

  return (
    <>
      <ol className="step-progress" aria-label="검증 단계"><li>1 등록 완료</li><li aria-current="step">2 문서 검토</li><li>3 컨트랙트 검사</li><li>4 리포트</li></ol>
      <PollingRefresher
        active={!terminal.has(document.data.status)}
        onRefresh={document.refetch}
      />
      {invalidConstraint ? <p className="state" data-tone="warn" role="alert">요청한 통제조건을 찾을 수 없습니다. 목록에서 다시 선택하세요.</p> : null}
      {!terminal.has(document.data.status) ? <p className="state" role="status" aria-live="polite">처리 중 · {document.data.page_count ? `${document.data.page_count}페이지 문서 분석` : document.data.status}</p> : null}
      {document.data.status === "PARTIAL" ? <p className="state" data-tone="warn" role="status">부분 추출 완료 · 실패 페이지 {(document.data.failed_pages ?? []).join(", ") || "미제공"}. 추출된 통제조건은 계속 검토할 수 있습니다.</p> : null}
      {document.data.status === "FAILED" ? <p className="state" data-tone="breach" role="alert">문서 분석 실패 · 내부 오류 정보는 숨겼습니다. 자산 상세에서 문서를 다시 업로드하세요.</p> : null}
      <div className="document-workbench" data-layout="selection">
        <section className="document-source" aria-label="발행 문서 원문">
          <p className="key">{document.data.media_type === "application/pdf" ? "PDF 원문" : "TXT 원문"}</p>
          {content.data?.text ? (
            <pre className="document-text">
              {hasExactTextSpan && selectedSpan ? (
                <>
                  {content.data.text.slice(0, selectedSpan.start)}
                  <mark
                    id={`source-${selectedControl!.constraint_id}`}
                    tabIndex={-1}
                    aria-label={`${selectedSpan.page}페이지 선택 근거`}
                  >
                    {content.data.text.slice(selectedSpan.start, selectedSpan.end)}
                  </mark>
                  {content.data.text.slice(selectedSpan.end)}
                </>
              ) : content.data.text}
            </pre>
          ) : null}
          {content.data?.content_base64 ? (
            <iframe
              title="발행 문서 PDF"
              className="document-pdf"
              src={`data:application/pdf;base64,${content.data.content_base64}#page=${selectedSpan?.page ?? 1}`}
            />
          ) : null}
          {selectedControl && (!content.data?.text || !hasExactTextSpan) ? (
            <aside className="evidence-highlight" aria-live="polite">
              <strong
                id={`source-${selectedControl.constraint_id}`}
                tabIndex={-1}
              >
                선택 근거 · {selectedControl.evidence_span.page}페이지
              </strong>
              <blockquote>{selectedControl.evidence_span.quote}</blockquote>
              {content.data?.content_base64 ? (
                <p className="row-meta">
                  브라우저 PDF 뷰어는 exact quote 자동 강조를 지원하지 않습니다.
                  페이지 이동과 인접 locator를 함께 확인하세요.
                </p>
              ) : null}
            </aside>
          ) : null}
          {content.isError ? (
            <p className="state" data-tone="warn" role="alert">
              원문 접근 불가 시 수동 조건을 confirmed로 저장할 수 없습니다.
              <button className="btn btn-small" type="button" onClick={() => content.refetch()}>원문 다시 시도</button>
              <Link className="btn btn-small" href={`/assets/${assetId}`}>문서 다시 업로드</Link>
            </p>
          ) : null}
        </section>
        <section className="constraint-review" aria-label="통제조건 검토">
          <nav className="constraint-rail" aria-label="통제조건 선택">
            <p className="key">CONSTRAINTS · {controls.length + missingFields.length}</p>
            <ul className="rows">
              {controls.map((control) => (
                <li key={control.constraint_id}>
                  <button
                    className="row constraint-row"
                    type="button"
                    aria-current={activeSelection === control.constraint_id ? "true" : undefined}
                    data-selected={activeSelection === control.constraint_id || undefined}
                    onClick={() => selectConstraint(control.constraint_id)}
                  >
                    <span className="row-mark" data-status={control.confirmed ? "IMPLEMENTED" : "PARTIAL"} />
                    <span><strong className="row-name">{CONTROL_NAMES[control.field] ?? control.field}</strong><span className="row-meta">{control.field}</span></span>
                    <span className="row-tail"><Badge tone={control.confirmed ? "safe" : "warn"}>{control.confirmed ? "확정" : "검토"}</Badge></span>
                  </button>
                </li>
              ))}
              {missingFields.map((field) => (
                <li key={field}>
                  <button
                    className="row constraint-row"
                    type="button"
                    aria-current={activeSelection === `manual:${field}` ? "true" : undefined}
                    data-selected={activeSelection === `manual:${field}` || undefined}
                    onClick={() => selectConstraint(`manual:${field}`)}
                  >
                    <span className="row-mark" data-status="MISSING" />
                    <span><strong className="row-name">{CONTROL_NAMES[field] ?? field}</strong><span className="row-meta">{field}</span></span>
                    <span className="row-tail"><Badge tone="warn">누락</Badge></span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="constraint-editor">
            {selectedControl ? (() => {
              const draft = controlDraft(selectedControl, drafts[selectedControl.constraint_id]);
              const confirmedWithoutSource = draft.confirmed && !sourceAccessible;
              return (
                <article className="control control-editor" id={selectedControl.constraint_id} tabIndex={-1}>
                  <header><p className="key">선택 통제</p><h2>{CONTROL_NAMES[selectedControl.field] ?? selectedControl.field}</h2></header>
                  <label>값<input value={String(draft.value)} onChange={(event) => setDrafts((current) => ({ ...current, [selectedControl.constraint_id]: { ...draft, value: event.target.value } }))} /></label>
                  <label className="check-row"><input type="checkbox" checked={draft.confirmed} onChange={(event) => setDrafts((current) => ({ ...current, [selectedControl.constraint_id]: { ...draft, confirmed: event.target.checked } }))} /> 원문 근거를 확인했습니다</label>
                  {!selectedControl.evidence_span.quote ? <Badge tone="warn">확인 필요</Badge> : null}
                  {confirmedWithoutSource ? <p className="form-error" role="alert">원문 content가 없어 confirmed 상태로 저장할 수 없습니다.</p> : null}
                  <button className="btn btn-small" type="button" disabled={save.isPending || confirmedWithoutSource} onClick={() => save.mutate(selectedControl)}>저장</button>
                </article>
              );
            })() : null}

            {selectedManualField ? (() => {
              const draft = manual[selectedManualField] ?? {
                value: "",
                unit: "",
                page: "1",
                quote: "",
                confirmed: false,
              };
              const source = content.data?.text ?? "";
              const extractedText = document.data.media_type === "application/pdf" && !source ? null : source;
              const valid = manualControlValidity(draft, extractedText, sourceAccessible);
              return (
                <article className="control control-editor" id={`editor-manual:${selectedManualField}`} tabIndex={-1}>
                  <header><p className="key">누락 통제</p><h2>{CONTROL_NAMES[selectedManualField] ?? selectedManualField}</h2><Badge tone="warn">누락 · 수동 입력</Badge></header>
                  <label>값<input value={draft.value} onChange={(event) => setManual((current) => ({ ...current, [selectedManualField]: { ...draft, value: event.target.value } }))} /></label>
                  <label>단위<input value={draft.unit} onChange={(event) => setManual((current) => ({ ...current, [selectedManualField]: { ...draft, unit: event.target.value } }))} /></label>
                  <label>페이지<input type="number" min="1" value={draft.page} onChange={(event) => setManual((current) => ({ ...current, [selectedManualField]: { ...draft, page: event.target.value } }))} /></label>
                  <label>해당 페이지의 정확한 원문 인용<textarea value={draft.quote} onChange={(event) => setManual((current) => ({ ...current, [selectedManualField]: { ...draft, quote: event.target.value } }))} /></label>
                  <label className="check-row"><input type="checkbox" checked={draft.confirmed} onChange={(event) => setManual((current) => ({ ...current, [selectedManualField]: { ...draft, confirmed: event.target.checked } }))} /> 서버 원문 검증 후 확정</label>
                  <button className="btn btn-small" type="button" disabled={!valid || save.isPending} onClick={() => updatePolicies(assetId, {
                    document_id: documentId,
                    is_synthetic: true,
                    policies: [{
                      constraint_id: `control_${selectedManualField}`,
                      field: selectedManualField,
                      value: draft.value,
                      unit: draft.unit || null,
                      page: Number(draft.page),
                      quote: draft.quote,
                      confirmed: draft.confirmed,
                      expected_version: 0,
                      is_synthetic: true,
                    }],
                  }).then(() => {
                    setManualError("");
                    return queryClient.invalidateQueries({ queryKey: ["document", documentId] });
                  }).catch(() => setManualError("페이지와 정확한 원문 인용을 검증하지 못했습니다."))}>수동 조건 저장</button>
                  {!valid && draft.quote ? <p className="form-error">{!sourceAccessible ? "원문 접근 불가로 확정 저장할 수 없습니다." : "TXT 인용문은 원문과 일치해야 합니다."}</p> : null}
                </article>
              );
            })() : null}
            {manualError ? <p className="form-error" role="alert">{manualError}</p> : null}
          </div>
        </section>
      </div>
      <div className="document-sticky-actions">
      {contractId ? (
        <>
          {!allConfirmed || !sourceAccessible ? <p className="state" data-tone="warn">필수 P0 통제조건 6개와 원문 근거를 모두 저장·확정해야 검사를 시작할 수 있습니다.</p> : null}
          <button className="btn btn-primary" type="button" disabled={!allConfirmed || !sourceAccessible || scan.isPending} onClick={() => scan.mutate()}>
            {scan.isPending ? "검사 시작 중…" : "컨트랙트 검사 시작"}
          </button>
          {scan.isError ? <p className="form-error" role="alert">검사 시작 조건을 다시 확인하세요.</p> : null}
        </>
      ) : <p className="state">컨트랙트를 연결하면 검사를 시작할 수 있습니다.</p>}
      </div>
      <p className="screen-note">문서 구조화 결과는 담당자 확인이 필요하며 자동 발행 승인 또는 법률 판단을 수행하지 않습니다.</p>
    </>
  );
}
