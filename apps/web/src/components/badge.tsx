import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "safe" | "accent" | "warn" | "breach" | "breach-solid";

/**
 * 상태 배지. 색만으로 의미를 전달하지 않으므로 글자가 항상 함께 있다.
 */
export function Badge({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="badge" data-tone={tone}>
      {icon}
      {children}
    </span>
  );
}
