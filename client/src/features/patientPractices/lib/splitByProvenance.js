/**
 * Splits the patient's own medical records into the three levels the patient
 * area keeps apart: their own global data, one bucket per care relationship,
 * and the records whose origin cannot be established.
 *
 * Pure and side-effect free so the separation itself can be tested without a
 * browser. The rule is deliberately strict: a record is only filed under a
 * practice when its context link is one the PATIENT holds. Anything else goes
 * to `unresolved` — never to `global`, because presenting an unclassified
 * record as "your own data" is a claim we cannot support.
 *
 * @param {Array<{ practiceContextState?: string|null, dataScope?: string|null, contextPracticePatientLinkId?: string|null }>} records
 * @param {(linkId: string|null|undefined) => { resolved: boolean, label: string }} resolve
 */
export function splitByProvenance(records, resolve) {
  const global = [];
  const archived = [];
  const unresolved = [];
  /** @type {Map<string, Array<object>>} */
  const byLink = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    // The server states the context explicitly. dataScope is kept as a
    // fallback so a response from before that field existed still sorts.
    const state = record?.practiceContextState
      ?? (record?.dataScope === "patient_global" ? "none" : null);

    if (state === "none") {
      global.push(record);
      continue;
    }

    // A practice that no longer exists. Its own bucket: filing it under an
    // active practice would misrepresent a deleted one as current, and filing
    // it under the patient's own data would erase where it came from.
    if (state === "archived") {
      archived.push(record);
      continue;
    }

    if (state === "active" || record?.dataScope === "practice_contextual") {
      const linkId = record.contextPracticePatientLinkId;
      const { resolved } = resolve(linkId);
      if (resolved && linkId) {
        if (!byLink.has(linkId)) byLink.set(linkId, []);
        byLink.get(linkId).push(record);
        continue;
      }
    }

    // Legacy, a foreign link, a link the patient no longer holds, or a state
    // the server could not classify. Never silently global.
    unresolved.push(record);
  }

  return { global, byLink, archived, unresolved };
}

/**
 * Records filed under one specific care relationship.
 * @param {Map<string, Array<object>>} byLink
 * @param {string} linkId
 */
export function recordsForLink(byLink, linkId) {
  return byLink.get(linkId) ?? [];
}
