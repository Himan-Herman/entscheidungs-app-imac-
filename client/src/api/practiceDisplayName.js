/**
 * Human-readable label for a practice in selectors/headers.
 * Always prefer the name; the raw id is only a last-resort fallback so the UI
 * never shows a database id like "cmpbso0pr0001ph21j5kh602m".
 *
 * Dependency-free on purpose so it is unit-testable under `node --test`.
 * @param {{ practiceName?: string, name?: string, id?: string }} [p]
 */
export function practiceDisplayName(p) {
  if (!p) return "";
  return p.practiceName || p.name || p.id || "";
}
