import { authFetch } from "../../../api/authFetch.js";

export async function fetchPatientTelemedicineSessions() {
  const res = await authFetch("/api/patient/telemedicine");
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchPatientTelemedicineSession(sessionId) {
  const res = await authFetch(`/api/patient/telemedicine/${encodeURIComponent(sessionId)}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function grantTelemedicineConsent(sessionId) {
  const res = await authFetch(`/api/patient/telemedicine/${encodeURIComponent(sessionId)}/consent`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patientJoinTelemedicine(sessionId) {
  const res = await authFetch(`/api/patient/telemedicine/${encodeURIComponent(sessionId)}/join`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patientLeaveTelemedicine(sessionId) {
  const res = await authFetch(`/api/patient/telemedicine/${encodeURIComponent(sessionId)}/leave`, {
    method: "PATCH",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
