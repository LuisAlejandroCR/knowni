// history.ts: what the person did with each request — shared or declined, and when.
// Kept on this phone only; it names the purpose, never the answers or the document.

export type Outcome = "shared" | "declined";

export interface HistoryEntry {
  readonly outcome: Outcome;
  readonly purpose: string;
  readonly at: number;
}

export const HISTORY_LIMIT = 20;

// Newest first, and bounded: a list that only grows is a list nobody reads.
export function addEntry(history: readonly HistoryEntry[], entry: HistoryEntry): readonly HistoryEntry[] {
  return [entry, ...history].slice(0, HISTORY_LIMIT);
}

// Storage is outside the process: whatever comes back is checked before use,
// and anything malformed is dropped rather than shown.
export function parseHistory(raw: string | null): readonly HistoryEntry[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .filter(
      (item): item is HistoryEntry =>
        typeof item === "object" &&
        item !== null &&
        (item.outcome === "shared" || item.outcome === "declined") &&
        typeof item.purpose === "string" &&
        typeof item.at === "number" &&
        Number.isFinite(item.at),
    )
    .map(({ outcome, purpose, at }) => ({ outcome, purpose, at }))
    .slice(0, HISTORY_LIMIT);
}
