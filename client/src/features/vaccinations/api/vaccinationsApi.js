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
  // "file", not "document": the server reads the part named `file`, and while
  // this said "document" every upload arrived with no file attached at all.
  // The call site swallowed the resulting 400, so the patient saw a saved entry
  // and never learned that their certificate had not gone anywhere.
  form.append("file", file);
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

/**
 * The stored certificate for one entry.
 *
 * Returns the raw response so the caller can decide between opening it and
 * downloading it; the server sends it as an attachment either way.
 */
export async function fetchVaccinationDocument(id) {
  return authFetch(`${BASE}/${encodeURIComponent(id)}/document`);
}
