"use client";

import { Icon } from "@/components/icon";

export function ReportActions({ reportId }: { reportId: string }) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const downloadHref = `${baseUrl}/v1/reports/${encodeURIComponent(reportId)}/download?format=json`;

  return (
    <>
      <a className="btn btn-small" href={downloadHref}>
        {Icon.download()} JSON 다운로드
      </a>
      <button className="btn btn-small btn-primary" type="button" onClick={() => window.print()}>
        인쇄
      </button>
    </>
  );
}
