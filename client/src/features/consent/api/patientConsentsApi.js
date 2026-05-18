import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/patient/consents";
const LINKS_BASE = "/api/patient/practice-links";

export async function fetchPatientConsents() {
  const res = await authFetch(BASE);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPatientPracticeLinks() {
  const res = await authFetch(`${LINKS_BASE}?status=active&limit=50`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postPatientConsent(body) {
  const res = await authFetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchRevokePatientConsent(consentId) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(consentId)}/revoke`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postConsentAiExplanation(consentId, locale) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(consentId)}/ai-explanation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
