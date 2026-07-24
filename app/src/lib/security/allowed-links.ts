const OFFICIAL_ALLOWED_HOSTS = new Set([
  "fsc.go.kr",
  "easylaw.go.kr",
  "fss.or.kr",
  "counterscam112.go.kr",
  "korea.kr",
  "kmcc.go.kr",
]);

const REVIEWED_EVIDENCE_URLS = new Set([
  "https://www.nongmin.com/article/20210702340948",
]);

function hostMatchesAllowedDomain(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return [...OFFICIAL_ALLOWED_HOSTS].some(
    (domain) =>
      normalized === domain || normalized.endsWith(`.${domain}`),
  );
}

export function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return false;
    }
    return (
      hostMatchesAllowedDomain(url.hostname) ||
      REVIEWED_EVIDENCE_URLS.has(url.href)
    );
  } catch {
    return false;
  }
}

export function allowedExternalUrl(value: string): string | null {
  return isAllowedExternalUrl(value) ? value : null;
}

export const ALLOWED_LINK_POLICY = {
  official_domains: [...OFFICIAL_ALLOWED_HOSTS],
  reviewed_evidence_urls: [...REVIEWED_EVIDENCE_URLS],
} as const;
