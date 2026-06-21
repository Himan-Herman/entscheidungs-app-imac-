import { authFetch } from "../../../api/authFetch.js";

/**
 * @param {{ q?: string, specialty?: string, city?: string, bookingOnly?: boolean,
 *           languages?: string[] }} params
 * @returns {Promise<{ res: Response, data: object }>}
 */
export async function searchMedScoutXPractices({ q = "", specialty = "", city = "", bookingOnly = false, languages = [] } = {}) {
  const qs = new URLSearchParams();
  if (q.trim()) qs.set("q", q.trim());
  if (specialty.trim()) qs.set("specialty", specialty.trim());
  if (city.trim()) qs.set("city", city.trim());
  if (Array.isArray(languages) && languages.length > 0) qs.set("languages", languages.join(","));
  if (bookingOnly) qs.set("bookingOnly", "true");

  const res = await authFetch(`/api/patient/practices/directory?${qs.toString()}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
