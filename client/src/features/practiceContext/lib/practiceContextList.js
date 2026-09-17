/**
 * Ordering and filtering for the patient's practice list — pure, testable, and
 * free of anything that could become a source of context truth.
 */

/** Diacritic- and case-insensitive comparison text. */
function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

import { patientContextSearchText, comparePatientContextTieBreak } from "./patientContextLabel.js";

/**
 * Local search across the patient's OWN connected practices.
 *
 * Not a practice directory search: the input is the list the server already
 * scoped to this patient. Every term must match somewhere, so "kardio düssel"
 * narrows rather than widens — no fuzzy engine, which would only add surprise to
 * a list of this size.
 *
 * @param {Array<object>} contexts
 * @param {string} query
 * @param {Record<string, string>} [t] practiceContext messages, so the wording
 *   the patient reads on the card is the wording they can search for
 */
export function filterPracticeContexts(contexts, query, t) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return contexts;

  return contexts.filter((c) => {
    const haystack = normalize(
      [
        c.practice?.displayName,
        // Searchable for the same reason it is visible: with several
        // relationships to one practice, the person is the only thing that
        // tells them apart, so "max" has to narrow the list.
        t ? patientContextSearchText(c, t) : c.patientProfileName,
        c.practice?.specialty,
        c.practice?.city,
      ]
        .filter(Boolean)
        .join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });
}

/**
 * Default order: what needs attention, then what was used recently, then a
 * stable alphabetical fallback so the list never reshuffles unpredictably.
 *
 * `lastUsedLinkId` is pure convenience and only nudges ordering. It is never a
 * context: the URL decides that (Phase 2B), and two tabs must stay independent.
 *
 * @param {Array<object>} contexts
 * @param {{ lastUsedLinkId?: string | null }} [opts]
 */
export function sortPracticeContexts(contexts, opts = {}) {
  const lastUsed = String(opts.lastUsedLinkId || "").trim();

  return [...contexts].sort((a, b) => {
    if (a.unreadCount > 0 !== b.unreadCount > 0) return a.unreadCount > 0 ? -1 : 1;
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;

    if (lastUsed && a.linkId !== b.linkId) {
      if (a.linkId === lastUsed) return -1;
      if (b.linkId === lastUsed) return 1;
    }

    const at = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
    const bt = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
    if (at !== bt) return bt - at;

    const byName = normalize(a.practice?.displayName).localeCompare(
      normalize(b.practice?.displayName),
    );
    if (byName !== 0) return byName;

    // Two relationships with the same practice compare equal on everything
    // above, which would leave their order to whatever the database returned.
    // A displayed value decides first, `linkId` settles the rest.
    return comparePatientContextTieBreak(a, b);
  });
}

/**
 * Splits live relationships from former ones.
 *
 * Former relationships stay reachable — the Phase 1' policy keeps the history
 * readable — but they do not belong scattered between the practices the patient
 * actually works with.
 *
 * @param {Array<object>} contexts
 */
export function splitByRelationship(contexts) {
  return {
    active: contexts.filter((c) => c.isActive),
    former: contexts.filter((c) => !c.isActive),
  };
}
