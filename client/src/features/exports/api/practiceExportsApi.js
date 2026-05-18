import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/practice/exports";

export async function fetchPracticeExports(practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(`${BASE}?${q}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postPracticeExport({
  practiceId,
  type,
  format,
  locale,
  practicePatientLinkId,
}) {
  const res = await authFetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ practiceId, type, format, locale, practicePatientLinkId }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function postPracticePatientExport(linkId, { practiceId, type, format, locale }) {
  const res = await authFetch(
    `/api/practice/patients/${encodeURIComponent(linkId)}/export`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ practiceId, type, format, locale }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function downloadPracticeExport(exportId, practiceId) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(
    `${BASE}/${encodeURIComponent(exportId)}/download?${q}`,
  );
  return res;
}

export async function postPracticeExportAiOrganize(exportId, practiceId, locale) {
  const q = new URLSearchParams({ practiceId });
  const res = await authFetch(
    `${BASE}/${encodeURIComponent(exportId)}/ai-organize?${q}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
