// Per-process throttle for page-triggered syncs. Writes mark the household dirty so the next page load syncs.
const last = new Map<string, number>();
const dirty = new Set<string>();
const MAX_AGE_MS = 5 * 60_000;

export const markDirty = (householdId: string) => dirty.add(householdId);

export function needsSync(householdId: string) {
  return dirty.has(householdId) || Date.now() - (last.get(householdId) ?? 0) > MAX_AGE_MS;
}

export function markSynced(householdId: string) {
  dirty.delete(householdId);
  last.set(householdId, Date.now());
}
