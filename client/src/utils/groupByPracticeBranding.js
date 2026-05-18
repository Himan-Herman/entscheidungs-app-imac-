/**
 * Group list items by practice for branding headers.
 * @param {unknown[]} items
 * @param {(item: unknown) => { id?: string } | null | undefined} getPractice
 */
export function groupByPracticeBranding(items, getPractice) {
  const map = new Map();
  for (const item of items) {
    const practice = getPractice(item);
    const key = practice?.id || "unknown";
    if (!map.has(key)) {
      map.set(key, { branding: practice, items: [] });
    }
    map.get(key).items.push(item);
  }
  return [...map.values()];
}

/**
 * @param {{ displayName?: string, practiceName?: string } | null | undefined} practice
 */
export function practiceDisplayLabel(practice) {
  return practice?.displayName?.trim() || practice?.practiceName?.trim() || "";
}
