import type { DecisionActionCard } from "@/lib/decision";
import { displayCardTitle } from "@/lib/ui/labels";

export const ACTION_MEANING_CATALOG_KEY =
  "goldentime.action-meaning-catalog.v1";

export interface ActionMeaningSnapshot {
  readonly title: string;
  readonly purpose_slots: readonly string[];
  readonly template_versions: readonly string[];
}

export type ActionMeaningCatalog = Readonly<
  Record<string, ActionMeaningSnapshot>
>;

interface StoredActionMeaningCatalog {
  readonly version: 1;
  readonly entries: ActionMeaningCatalog;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  );
}

function isActionMeaningSnapshot(
  value: unknown,
): value is ActionMeaningSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    isStringArray(candidate.purpose_slots) &&
    isStringArray(candidate.template_versions)
  );
}

function parseCatalog(value: unknown): ActionMeaningCatalog {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== 1 ||
    typeof candidate.entries !== "object" ||
    candidate.entries === null
  ) {
    return {};
  }

  const entries = Object.entries(
    candidate.entries as Record<string, unknown>,
  );
  if (
    entries.some(
      ([eventId, snapshot]) =>
        eventId.length === 0 || !isActionMeaningSnapshot(snapshot),
    )
  ) {
    return {};
  }
  return Object.fromEntries(entries) as ActionMeaningCatalog;
}

export function meaningSnapshotForCard(
  card: DecisionActionCard,
): ActionMeaningSnapshot {
  return {
    title: displayCardTitle(card),
    purpose_slots: [...card.purpose_slots],
    template_versions: [...card.template_versions],
  };
}

export function catalogCardMeaning(
  catalog: ActionMeaningCatalog,
  eventId: string,
  card: DecisionActionCard,
): ActionMeaningCatalog {
  return {
    ...catalog,
    [eventId]: meaningSnapshotForCard(card),
  };
}

export function catalogCorrectionMeaning(
  catalog: ActionMeaningCatalog,
  eventId: string,
  correctedEventId: string,
): ActionMeaningCatalog {
  const correctedMeaning = catalog[correctedEventId];
  return correctedMeaning
    ? { ...catalog, [eventId]: correctedMeaning }
    : catalog;
}

export function loadActionMeaningCatalog(
  storage: Pick<Storage, "getItem">,
): ActionMeaningCatalog {
  const raw = storage.getItem(ACTION_MEANING_CATALOG_KEY);
  if (!raw) {
    return {};
  }
  try {
    return parseCatalog(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveActionMeaningCatalog(
  storage: Pick<Storage, "setItem">,
  catalog: ActionMeaningCatalog,
): void {
  const payload: StoredActionMeaningCatalog = {
    version: 1,
    entries: catalog,
  };
  storage.setItem(ACTION_MEANING_CATALOG_KEY, JSON.stringify(payload));
}

export function clearActionMeaningCatalog(
  storage: Pick<Storage, "removeItem">,
): void {
  storage.removeItem(ACTION_MEANING_CATALOG_KEY);
}
