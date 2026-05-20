import { authFetch } from "../../../api/authFetch.js";
import { MEDA_API_CHAT, MEDA_API_STATUS } from "../constants.js";

/**
 * @param {string} language
 */
export async function fetchMedaStatus(language) {
  const res = await authFetch(
    `${MEDA_API_STATUS}?patientLanguage=${language === "en" ? "en" : "de"}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, enabled: false, quota: null };
  return data;
}

/**
 * @param {{ message: string, history: { role: string, content: string }[], language: string }} params
 */
export async function sendMedaMessage({ message, history, language }) {
  const res = await authFetch(MEDA_API_CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history,
      patientLanguage: language === "en" ? "en" : "de",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || "meda_failed");
    err.code = data.error;
    err.status = res.status;
    err.quota = data.quota;
    throw err;
  }
  return data;
}
