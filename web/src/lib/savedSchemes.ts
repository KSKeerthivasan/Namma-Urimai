// Pure helpers for bookmarked (saved) schemes, stored in browser localStorage.
// No React here. Every localStorage access is guarded and wrapped in try/catch.

export const SAVED_STORAGE_KEY = "namma-urimai:saved-schemes";
export const SAVED_EVENT = "namma-urimai:saved-changed";

export type SavedScheme = {
  slug: string;
  scheme_name: string;
  short_title: string | null;
  level: string | null;
  state: string | null;
  scheme_close_date: string | null;
  saved_at: string;
};

// What a caller passes when saving; saved_at is stamped by toggleSaved.
export type SavedSchemeInput = Omit<SavedScheme, "saved_at">;

function isSavedScheme(value: unknown): value is SavedScheme {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { slug?: unknown }).slug === "string"
  );
}

export function readSaved(): SavedScheme[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedScheme);
  } catch {
    return [];
  }
}

export function writeSaved(list: SavedScheme[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: the in-memory change is lost silently.
  }
  window.dispatchEvent(new CustomEvent(SAVED_EVENT));
}

export function isSaved(slug: string): boolean {
  return readSaved().some((s) => s.slug === slug);
}

// Adds the scheme when it is not saved, removes it when it is. Returns the new list.
export function toggleSaved(scheme: SavedSchemeInput): SavedScheme[] {
  const current = readSaved();
  const exists = current.some((s) => s.slug === scheme.slug);
  const next = exists
    ? current.filter((s) => s.slug !== scheme.slug)
    : [...current, { ...scheme, saved_at: new Date().toISOString() }];
  writeSaved(next);
  return next;
}

// Whole days from today's local date to a YYYY-MM-DD close date.
// Negative when past, null when there is no usable date. Uses the date parts
// directly so a timezone shift cannot move the result by a day.
export function daysUntilClose(dateStr: string | null, now: Date = new Date()): number | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!m) return null;
  const close = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((close - today) / 86400000);
}
