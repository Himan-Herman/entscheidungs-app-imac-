import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/patient/exports";

export async function fetchPatientExports() {
  const res = await authFetch(BASE);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postPatientExport({ type, format, locale }) {
  const res = await authFetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, format, locale }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function downloadPatientExport(exportId) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(exportId)}/download`);
  return res;
}

export async function postPatientExportAiOrganize(exportId, locale) {
  const res = await authFetch(`${BASE}/${encodeURIComponent(exportId)}/ai-organize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
