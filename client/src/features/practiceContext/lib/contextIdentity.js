/**
 * Practice context identity — the pure rules, free of React and of the network.
 *
 * WHY practicePatientLinkId AND NOT practiceId
 * --------------------------------------------
 * Phases 1'/2A established that the authorized care relationship — the
 * PracticePatientLink — is the security boundary, not the practice. Two
 * practices treating the same person hold two different links, and every
 * server-side check resolves the tenant FROM the link. Using the same key on the
 * client means the thing the URL names is exactly the thing the server
 * authorizes, with no translation step in between that could drift.
 *
 * The client id is routing convenience only. It never grants anything: the
 * server re-authorizes every request independently.
 */

/** Context resolution outcomes. Deliberately explicit — never a silent fallback. */
export const CONTEXT_STATE = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  NOT_FOUND: "not_found",
  ERROR: "error",
});

/**
 * @param {unknown} raw
 * @returns {string} empty string when the route names none
 */
export function normalizeLinkId(raw) {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Decides which context is authoritative.
 *
 * A total order with no escape hatch:
 *   1. the link id in the route,
 *   2. validated against the patient's own relationships by the server,
 *   3. nothing else.
 *
 * A previously used practice or a leftover in-memory value are NOT inputs. If
 * the route names a link the patient does not hold, the answer is "not found" —
 * never "then take the last one", which would show one practice's data under
 * another practice's URL.
 *
 * @param {{ routeLinkId?: unknown }} input
 * @returns {{ linkId: string, resolvedFrom: "route" | "none" }}
 */
export function resolveContextIdentity(input) {
  const routeLinkId = normalizeLinkId(input?.routeLinkId);
  if (routeLinkId) return { linkId: routeLinkId, resolvedFrom: "route" };
  return { linkId: "", resolvedFrom: "none" };
}

/**
 * True when a response requested for `requestedLinkId` may still be applied
 * while the active context is `currentLinkId`.
 *
 * This is the whole stale-response rule: a slow request started in the GP's
 * context must never land on the cardiologist's screen, however late it
 * resolves.
 *
 * @param {string} requestedLinkId
 * @param {string} currentLinkId
 */
export function responseBelongsToContext(requestedLinkId, currentLinkId) {
  const a = normalizeLinkId(requestedLinkId);
  const b = normalizeLinkId(currentLinkId);
  return a !== "" && a === b;
}

/**
 * Relationship states the patient may open a practice context for.
 *
 * Mirrors the server. A link the patient declined is not a context at all. An
 * ended relationship stays openable because the Phase 1' policy lets the patient
 * READ their history; what they may still DO inside it is decided per request by
 * the server, never by this flag.
 *
 * @param {string | null | undefined} status
 */
export function isContextOpenable(status) {
  return ["invited", "active", "revoked", "archived"].includes(String(status || "").trim());
}

/**
 * Whether the relationship is still live, for callers that need to distinguish
 * "you can look" from "you can act". Presentation only — never an authorization.
 *
 * @param {string | null | undefined} status
 */
export function isContextActive(status) {
  return ["invited", "active"].includes(String(status || "").trim());
}
