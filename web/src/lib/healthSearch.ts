import type { Profile, SchemeRow } from "@/lib/types";

export const HEALTH_TERMS = ["health insurance", "hospital", "medical treatment"];

// EC-2 (PROJECT.md Section 8): colloquial medical needs are also searched as formal health categories.
export function healthQueriesFor(profile: Profile | null): string[] {
  return profile?.medical_need?.trim() ? HEALTH_TERMS : [];
}

export function mergeSchemes(lists: SchemeRow[][]): SchemeRow[] {
  const seen = new Set<string>();
  const merged: SchemeRow[] = [];
  for (const list of lists) {
    for (const scheme of list) {
      if (seen.has(scheme.slug)) continue;
      seen.add(scheme.slug);
      merged.push(scheme);
    }
  }
  return merged;
}
