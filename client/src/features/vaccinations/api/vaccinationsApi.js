import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/patient/vaccinations";

export async function fetchVaccinations() {
  const res = await authFetch(BASE);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function createVaccination(payload) {
  const res = await authFetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function updateVaccination(id, payload) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deleteVaccination(id) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function uploadVaccinationDocument(id, file) {
  const form = new FormData();
  form.append("document", file);
  const res = await authFetch(`${BASE}/${encodeURIComponent(id)}/document`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deleteVaccinationDocument(id) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(id)}/document`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
