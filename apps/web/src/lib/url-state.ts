import type { AppError } from "@/lib/adapters/errors";

const KEYS = ["scan", "base", "finding", "constraint", "panel"] as const;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type UrlStateKey = (typeof KEYS)[number];
export type UrlState = {
  scan?: string;
  base?: string;
  finding?: string;
  constraint?: string;
  panel?: "simulator";
};
export type RouteKey = "home" | "asset" | "document" | "scan" | "report";
export type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;
export type InvalidReason =
  | "empty"
  | "duplicate"
  | "invalid"
  | "not_allowed"
  | "missing_reference";
export interface InvalidUrlState {
  key: UrlStateKey;
  reason: InvalidReason;
  values: string[];
}

export type ParsedUrlState =
  | { ok: true; value: UrlState }
  | { ok: false; value: UrlState; invalid: InvalidUrlState[] };

export type SerializedUrlState =
  | { ok: true; search: string }
  | { ok: false; invalid: InvalidUrlState[] };

function validValue(key: UrlStateKey, value: string): boolean {
  if (key === "panel") return value === "simulator";
  return ID_PATTERN.test(value);
}

function invalidReason(values: string[], key: UrlStateKey): InvalidReason | undefined {
  if (values.length > 1) return "duplicate";
  if (values[0] === "") return "empty";
  if (!values[0] || !validValue(key, values[0])) return "invalid";
  return undefined;
}

function toSearchParams(input: SearchParamsInput): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(input)) {
    if (Array.isArray(raw)) raw.forEach((value) => params.append(key, value));
    else if (raw !== undefined) params.append(key, raw);
  }
  return params;
}

export function parseUrlState(input: SearchParamsInput): ParsedUrlState {
  const params = toSearchParams(input);
  const value: UrlState = {};
  const invalid: InvalidUrlState[] = [];

  for (const key of KEYS) {
    const values = params.getAll(key);
    if (values.length === 0) continue;

    const reason = invalidReason(values, key);
    if (reason) {
      invalid.push({ key, reason, values });
      continue;
    }

    if (key === "panel") value.panel = "simulator";
    else value[key] = values[0];
  }

  return invalid.length > 0 ? { ok: false, value, invalid } : { ok: true, value };
}

const ROUTE_KEYS: Record<RouteKey, readonly UrlStateKey[]> = {
  home: [],
  asset: ["scan", "panel"],
  document: ["constraint"],
  scan: ["scan", "base", "finding"],
  report: ["finding"],
};

export function parseRouteUrlState(
  route: RouteKey,
  input: SearchParamsInput,
): ParsedUrlState {
  const params = toSearchParams(input);
  const parsed = parseUrlState(params);
  const invalid = parsed.ok ? [] : [...parsed.invalid];
  const allowed = new Set(ROUTE_KEYS[route]);

  for (const key of KEYS) {
    const values = params.getAll(key);
    if (values.length > 0 && !allowed.has(key)) {
      invalid.push({ key, reason: "not_allowed", values });
    }
  }

  return invalid.length > 0
    ? { ok: false, value: parsed.value, invalid }
    : { ok: true, value: parsed.value };
}

export function validateUrlStateReferences(
  state: UrlState,
  refs: {
    scanIds?: readonly string[];
    findingIds?: readonly string[];
    constraintIds?: readonly string[];
  },
): InvalidUrlState[] {
  const checks: Array<[UrlStateKey, string | undefined, readonly string[] | undefined]> = [
    ["scan", state.scan, refs.scanIds],
    ["base", state.base, refs.scanIds],
    ["finding", state.finding, refs.findingIds],
    ["constraint", state.constraint, refs.constraintIds],
  ];

  return checks.flatMap(([key, selected, available]) =>
    selected !== undefined && available !== undefined && !available.includes(selected)
      ? [{ key, reason: "missing_reference" as const, values: [selected] }]
      : [],
  );
}

export function missingReferenceFromError(
  error: AppError,
  state: UrlState,
): InvalidUrlState | undefined {
  if (error.kind !== "not_found") return undefined;
  const resource = error.metadata.resource;
  if (resource !== "scan" && resource !== "base" && resource !== "finding") {
    return undefined;
  }
  const selected = state[resource];
  if (!selected || error.metadata.requestedId !== selected) return undefined;
  return { key: resource, reason: "missing_reference", values: [selected] };
}

export function serializeUrlState(state: UrlState): SerializedUrlState {
  const search = new URLSearchParams();
  const invalid: InvalidUrlState[] = [];

  for (const key of KEYS) {
    const value = state[key];
    if (value === undefined) continue;
    const values = [value];
    const reason = invalidReason(values, key);
    if (reason) invalid.push({ key, reason, values });
    else search.set(key, value);
  }

  return invalid.length > 0 ? { ok: false, invalid } : { ok: true, search: search.toString() };
}
