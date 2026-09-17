import { authFetch } from "../../../api/authFetch.js";

/**
 * Medication plans of ONE care relationship. The link is the only scope — no
 * practiceId, patientId or planId is ever sent as proof of anything.
 *
 * Deliberately NOT the cross-practice endpoint with client-side filtering:
 * that endpoint answers with every practice's plans, so filtering afterwards
 * would mean the other relationships' medication data had already been
 * transmitted to this device.
 */
function base(linkId) {
  return `/api/patient/practice/${encodeURIComponent(linkId)}/medication-plans`;
}

export async function fetchScopedMedicationPlans(linkId, { signal } = {}) {
  const res = await authFetch(base(linkId), { signal });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Raises a question with the practice. The text stays in the secure message area. */
export async function askScopedMedicationPlanQuestion(linkId, planId, { signal } = {}) {
  const res = await authFetch(
    `${base(linkId)}/${encodeURIComponent(planId)}/question`,
    { method: "POST", signal },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
