import { authFetch } from "../../../api/authFetch.js";

function qs(practiceId) {
  return `practiceId=${encodeURIComponent(practiceId)}`;
}

export async function fetchBillingPlausibilitySessions(practiceId) {
  const res = await authFetch(`/api/practice/billing-plausibility?${qs(practiceId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Read the active GOÄ catalogue version (reference metadata only).
 * Returns { version: null } when no active catalogue has been seeded yet.
 * @param {string} practiceId
 */
export async function fetchActiveGoaeCatalogue(practiceId) {
  const res = await authFetch(
    `/api/practice/billing-plausibility/catalogue/active?${qs(practiceId)}`,
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Stateless GOÄ rule-check (Billing-4a) — runs the deterministic rule engine
 * without storing anything. Sends only code/factor/quantity per position.
 * @param {string} practiceId
 * @param {Array<{ ziffer?: string, code?: string, factor?: string|number, count?: string|number, quantity?: string|number }>} items
 */
export async function runGoaeRuleCheck(practiceId, items) {
  const res = await authFetch(`/api/practice/billing-plausibility/rule-check?${qs(practiceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
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
 * Download a plausibility report PDF for a saved session.
 * Triggers browser file download via a temporary object URL.
 * No report generation happens on the frontend — PDF is built by the server.
 *
 * @param {string} practiceId
 * @param {string} sessionId
 * @param {{ format?: string, locale?: string }} opts
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function downloadBillingPlausibilityReport(practiceId, sessionId, opts = {}) {
  const format = opts.format || "pdf";
  const locale = opts.locale || "de";
  const res = await authFetch(
    `/api/practice/billing-plausibility/${encodeURIComponent(sessionId)}/export?${qs(practiceId)}&format=${encodeURIComponent(format)}&locale=${encodeURIComponent(locale)}`,
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || "export_failed" };
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plausibilitaetsbericht-${encodeURIComponent(sessionId).slice(0, 32)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { ok: true };
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
