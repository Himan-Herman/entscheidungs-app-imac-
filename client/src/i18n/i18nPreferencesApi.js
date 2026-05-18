import { authFetch } from "../api/authFetch.js";

export async function fetchUiLanguagePreference() {
  const token = localStorage.getItem("medscout_token");
  if (!token) return { res: null, data: { ok: true, locale: null } };
  const res = await authFetch("/api/i18n/preferences");
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function patchUiLanguagePreference(locale) {
  const res = await authFetch("/api/i18n/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
