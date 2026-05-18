import { authFetch } from "../../../api/authFetch.js";

const CONTROL_BASE = "/api/patient/data-control";
const REQUESTS_BASE = "/api/patient/data-requests";
const LINKS_BASE = "/api/patient/practice-links";

export async function fetchPatientDataControl() {
  const res = await authFetch(CONTROL_BASE);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postPatientDataRequest(body) {
  const res = await authFetch(REQUESTS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchPatientLinkArchive(linkId) {
  const res = await authFetch(`${LINKS_BASE}/${encodeURIComponent(linkId)}/archive`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchPatientProfileAccess(linkId, granted) {
  const res = await authFetch(
    `${LINKS_BASE}/${encodeURIComponent(linkId)}/profile-access`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ granted }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPracticeDataRequests(practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(`/api/practice/data-requests?${q}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
