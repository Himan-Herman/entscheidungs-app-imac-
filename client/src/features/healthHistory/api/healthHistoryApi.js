import { authFetch } from "../../../api/authFetch.js";

const ALLERGY_BASE = "/api/patient/allergies";
const DIAGNOSIS_BASE = "/api/patient/diagnoses";
const AI_BASE = "/api/patient/health-history/ai";

export async function fetchAllergies() {
  const res = await authFetch(ALLERGY_BASE);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createAllergy(payload) {
  const res = await authFetch(ALLERGY_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function updateAllergy(id, payload) {
  const res = await authFetch(`${ALLERGY_BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deleteAllergy(id) {
  const res = await authFetch(`${ALLERGY_BASE}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function fetchDiagnoses() {
  const res = await authFetch(DIAGNOSIS_BASE);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createDiagnosis(payload) {
  const res = await authFetch(DIAGNOSIS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function updateDiagnosis(id, payload) {
  const res = await authFetch(`${DIAGNOSIS_BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deleteDiagnosis(id) {
  const res = await authFetch(`${DIAGNOSIS_BASE}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function suggestSeverity(reactionText) {
  const res = await authFetch(`${AI_BASE}/severity-suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reactionText }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function suggestIcd(conditionText) {
  const res = await authFetch(`${AI_BASE}/icd-suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conditionText }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
