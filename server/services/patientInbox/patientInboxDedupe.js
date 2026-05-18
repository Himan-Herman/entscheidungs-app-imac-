/**
 * Patient inbox dedupe key helpers — no clinical content in keys.
 */

/**
 * @param {{ type: string, sourceRefType?: string | null, sourceRefId?: string | null, titleKey?: string | null }} input
 * @returns {string | null}
 */
export function buildPatientInboxDedupeKey(input) {
  const type = String(input.type || "").trim();
  const sourceRefType = input.sourceRefType ? String(input.sourceRefType).trim() : "";
  const sourceRefId = input.sourceRefId ? String(input.sourceRefId).trim() : "";
  if (!type || !sourceRefType || !sourceRefId) return null;

  const titleKey = input.titleKey ? String(input.titleKey).trim() : "";
  if (titleKey) {
    return `${type}:${sourceRefType}:${sourceRefId}:${titleKey}`;
  }
  return `${type}:${sourceRefType}:${sourceRefId}`;
}

/**
 * @param {{ dedupeKey?: string | null, type: string, sourceRefType?: string | null, sourceRefId?: string | null, titleKey?: string | null }} input
 * @returns {string | null}
 */
export function resolvePatientInboxDedupeKey(input) {
  if (input.dedupeKey && String(input.dedupeKey).trim()) {
    return String(input.dedupeKey).trim().slice(0, 180);
  }
  const built = buildPatientInboxDedupeKey(input);
  return built ? built.slice(0, 180) : null;
}
