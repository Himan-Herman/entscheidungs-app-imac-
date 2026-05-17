import { authFetch } from "../../../api/authFetch.js";

/**
 * @returns {Promise<{ ok: boolean, configured: boolean, demoMode: boolean, provider: string }>}
 */
export async function fetchPlacesStatus() {
  const res = await authFetch("/api/places/status");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, configured: false, demoMode: false, provider: "google" };
  }
  return data;
}

/**
 * @param {import('../types.js').PracticeFinderSearchParams} params
 */
export async function searchPlaces(params) {
  const res = await authFetch("/api/places/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "search_failed");
    err.code = data.error || "search_failed";
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * @param {string} placeId
 * @param {string} language
 */
export async function fetchPlaceDetails(placeId, language) {
  const res = await authFetch("/api/places/details", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId, language }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "details_failed");
    err.code = data.error || "details_failed";
    err.status = res.status;
    throw err;
  }
  return data;
}
