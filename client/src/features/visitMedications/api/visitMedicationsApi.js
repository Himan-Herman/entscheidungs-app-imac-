import { authFetch } from "../../../api/authFetch.js";

export async function fetchPracticeMedications(sessionId, practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(
    `/api/practice-dashboard/preparations/${encodeURIComponent(sessionId)}/medications?${q}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "load_failed");
  return data.entries || [];
}

export async function savePracticeMedications(sessionId, practiceId, payload) {
  const res = await authFetch(
    `/api/practice-dashboard/preparations/${encodeURIComponent(sessionId)}/medications`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ practiceId, ...payload }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "save_failed");
  return data;
}

export async function fetchPatientMedicationSessions() {
  const res = await authFetch("/api/previsit/visit-medications");
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "load_failed");
  return data.sessions || [];
}

export async function fetchPatientSessionMedications(sessionId, { markViewed = false } = {}) {
  const q = markViewed ? "?markViewed=1" : "";
  const res = await authFetch(
    `/api/previsit/visit-medications/session/${encodeURIComponent(sessionId)}${q}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "load_failed");
  return data;
}
