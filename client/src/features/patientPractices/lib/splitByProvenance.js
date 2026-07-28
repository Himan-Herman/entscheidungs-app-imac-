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
 * @param {Array<{ dataScope?: string|null, contextPracticePatientLinkId?: string|null }>} records
 * @param {(linkId: string|null|undefined) => { resolved: boolean, label: string }} resolve
 */
export function splitByProvenance(records, resolve) {
  const global = [];
  const unresolved = [];
  /** @type {Map<string, Array<object>>} */
  const byLink = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    if (record?.dataScope === "patient_global") {
      global.push(record);
      continue;
    }
    if (record?.dataScope === "practice_contextual") {
      const linkId = record.contextPracticePatientLinkId;
      const { resolved } = resolve(linkId);
      if (resolved && linkId) {
        if (!byLink.has(linkId)) byLink.set(linkId, []);
        byLink.get(linkId).push(record);
        continue;
      }
    }
    // Legacy (no scope), a foreign link, or a link the patient no longer holds.
    unresolved.push(record);
  }

  return { global, byLink, unresolved };
}

/**
 * Records filed under one specific care relationship.
 * @param {Map<string, Array<object>>} byLink
 * @param {string} linkId
 */
export function recordsForLink(byLink, linkId) {
  return byLink.get(linkId) ?? [];
}
