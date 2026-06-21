import { authFetch } from "./authFetch.js";

/**
 * Patient profile-image API. Always scoped server-side to the signed-in user.
 */

export async function uploadPatientAvatar(file) {
  const form = new FormData();
  form.append("avatar", file);
  const res = await authFetch("/api/account/avatar", {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function deletePatientAvatar() {
  const res = await authFetch("/api/account/avatar", { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Fetch an auth-gated avatar path as an object URL for <img> display.
 * Caller must revoke the returned URL when done.
 * @param {string} avatarPath
 * @returns {Promise<string|null>}
 */
export async function fetchAvatarBlobUrl(avatarPath) {
  if (!avatarPath || !String(avatarPath).startsWith("/api/")) return null;
  const res = await authFetch(avatarPath);
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
