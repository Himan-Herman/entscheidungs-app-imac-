import { authFetch } from "../../../api/authFetch.js";

/**
 * Request a plain-language explanation of manually entered GOÄ/PKV billing details.
 * Stateless: nothing is stored. Returns { res, data }.
 *
 * @param {{ rows?: Array<object>, text?: string }} payload
 */
export async function requestBillingExplanation(payload) {
  const res = await authFetch("/api/patient/billing-explainer/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { res, data };
}
