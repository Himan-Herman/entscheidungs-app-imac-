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
