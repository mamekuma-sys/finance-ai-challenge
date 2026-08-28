import type { ReactNode } from "react";

/**
 * 화면에 쓰는 아이콘. 이모지나 딩뱃 글리프를 쓰지 않는다 — 크기와 색을
 * 제어할 수 없고 금융 도구의 격에 맞지 않는다.
 */
function svg(children: ReactNode, size: number) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Icon = {
  shield: (size = 19) =>
    svg(
      <>
        <path d="M12 3 4 6.5v5c0 4.6 3.2 8.6 8 9.5 4.8-.9 8-4.9 8-9.5v-5L12 3Z" />
        <path d="m9 12 2 2 4-4" />
      </>,
      size,
    ),
  grid: (size = 15) =>
    svg(
      <>
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </>,
      size,
    ),
  doc: (size = 15) =>
    svg(
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
      </>,
      size,
    ),
  code: (size = 15) =>
    svg(
      <>
        <path d="m16 18 6-6-6-6" />
        <path d="m8 6-6 6 6 6" />
      </>,
      size,
    ),
  building: (size = 15) =>
    svg(
      <>
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
      </>,
      size,
    ),
  clipboard: (size = 15) =>
    svg(
      <>
        <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z" />
        <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      </>,
      size,
    ),
  check: (size = 12) => svg(<path d="M20 6 9 17l-5-5" />, size),
  spark: (size = 12) =>
    svg(
      <>
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="m5.6 5.6 2.1 2.1" />
        <path d="m16.3 16.3 2.1 2.1" />
        <path d="M3 12h3" />
        <path d="M18 12h3" />
      </>,
      size,
    ),
  replay: (size = 11) =>
    svg(
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
      </>,
      size,
    ),
  alert: (size = 12) =>
    svg(
      <>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </>,
      size,
    ),
  download: (size = 13) =>
    svg(
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m7 10 5 5 5-5" />
        <path d="M12 15V3" />
      </>,
      size,
    ),
  chart: (size = 26) =>
    svg(
      <>
        <path d="M3 3v18h18" />
        <path d="m7 15 4-4 3 3 5-6" />
      </>,
      size,
    ),
};
