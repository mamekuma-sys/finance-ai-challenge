import type { ReactNode } from "react";

import { allowedExternalUrl } from "@/lib/security/allowed-links";

interface OfficialLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export function OfficialLink({
  href,
  children,
  className,
}: OfficialLinkProps) {
  const safeHref = allowedExternalUrl(href);
  if (!safeHref) {
    return (
      <span className={className} data-link-blocked="true">
        {children} (안전 정책으로 링크 차단)
      </span>
    );
  }
  return (
    <a
      className={className}
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <span className="sr-only"> (새 창)</span>
    </a>
  );
}
