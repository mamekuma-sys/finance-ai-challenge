"use client";

import { useId, useRef, useState } from "react";

interface CopyScriptProps {
  text: string;
  title: string;
}

export function CopyScript({ text, title }: CopyScriptProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const helpId = useId();

  async function copyText() {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        setMessage("고정 문구를 복사했습니다.");
        return;
      } catch {
        // 안전 컨텍스트가 아닌 브라우저에서는 선택 폴백을 사용한다.
      }
    }

    textareaRef.current?.focus();
    textareaRef.current?.select();
    setMessage("문구를 선택했습니다. 브라우저의 복사 기능을 사용하세요.");
  }

  return (
    <section className="copy-script" aria-labelledby={helpId}>
      <div className="copy-script-heading">
        <h4 id={helpId}>{title}</h4>
        <span className="fixed-copy-badge">승인된 고정 문구</span>
      </div>
      <textarea
        ref={textareaRef}
        className="copy-textarea"
        value={text}
        readOnly
        rows={Math.min(8, Math.max(3, text.split("\n").length + 1))}
        aria-label={`${title} 복사할 문구`}
      />
      <button className="secondary-button copy-button" type="button" onClick={copyText}>
        문구 복사
      </button>
      <p className="live-message" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
