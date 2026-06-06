import { authFetch } from "../../../api/authFetch.js";

function qs(practiceId) {
  return `practiceId=${encodeURIComponent(practiceId)}`;
}

export async function fetchBillingPlausibilitySessions(practiceId) {
  const res = await authFetch(`/api/practice/billing-plausibility?${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createBillingPlausibilitySession(practiceId, payload) {
  const res = await authFetch(`/api/practice/billing-plausibility?${qs(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Fetch a single plausibility session with its items.
 * @param {string} practiceId
 * @param {string} sessionId
 */
export async function fetchBillingPlausibilitySession(practiceId, sessionId) {
  const res = await authFetch(
    `/api/practice/billing-plausibility/${encodeURIComponent(sessionId)}?${qs(practiceId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Dismiss (archive) a plausibility session. Non-destructive — sets status to "dismissed".
 * @param {string} practiceId
 * @param {string} sessionId
 */
export async function dismissBillingPlausibilitySession(practiceId, sessionId) {
  const res = await authFetch(
    `/api/practice/billing-plausibility/${encodeURIComponent(sessionId)}/dismiss?${qs(practiceId)}`,
    { method: "POST", headers: { "Content-Type": "application/json" } },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Request AI-assisted plausibility hints for an existing session.
 * Requires ENABLE_BILLING_AI_REVIEW=true on the backend.
 * Returns 404 { error: "feature_disabled" } when AI review is off.
 * Never triggers AI automatically — must be called explicitly by user action.
 *
 * @param {string} practiceId
 * @param {string} sessionId
 */
export async function requestBillingPlausibilityAiReview(practiceId, sessionId) {
  const res = await authFetch(
    `/api/practice/billing-plausibility/${encodeURIComponent(sessionId)}/review?${qs(practiceId)}`,
    { method: "POST", headers: { "Content-Type": "application/json" } },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
