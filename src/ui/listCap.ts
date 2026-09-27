/** Most messages a list renders; a large file can produce thousands. */
export const MAX_LISTED = 50;

/** The first `max` items, and the line that stands for the rest ("… y N más"), or null if all fit. */
export function capList<T>(items: readonly T[], max = MAX_LISTED): { shown: readonly T[]; more: string | null } {
  if (items.length <= max) return { shown: items, more: null };
  return { shown: items.slice(0, max), more: `… y ${items.length - max} más` };
}
