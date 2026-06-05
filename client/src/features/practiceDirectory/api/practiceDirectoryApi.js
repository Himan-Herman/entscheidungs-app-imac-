import { authFetch } from "../../../api/authFetch.js";

/**
 * @param {{ q?: string, specialty?: string, city?: string, bookingOnly?: boolean }} params
 * @returns {Promise<{ res: Response, data: object }>}
 */
export async function searchMedScoutXPractices({ q = "", specialty = "", city = "", bookingOnly = false } = {}) {
  const qs = new URLSearchParams();
  if (q.trim()) qs.set("q", q.trim());
  if (specialty.trim()) qs.set("specialty", specialty.trim());
  if (city.trim()) qs.set("city", city.trim());
  if (bookingOnly) qs.set("bookingOnly", "true");

  const res = await authFetch(`/api/patient/practices/directory?${qs.toString()}`);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
