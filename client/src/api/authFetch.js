import { getAuthHeaders } from "./authHeaders";

/**
 * Wie fetch, setzt Authorization aus dem gespeicherten JWT und leitet bei abgelaufenem
 * Token zur Login-Seite weiter (gleicher Origin wie die App).
 *
 * TODO(medscoutx-auth): Move session to HttpOnly cookies via a same-site BFF; then remove
 * medscout_token from localStorage and rely on cookie credentials.
 */
export async function authFetch(input, init = {}) {
  const headers = new Headers(init.headers ?? undefined);
  const auth = getAuthHeaders();
  if (auth.Authorization) {
    headers.set("Authorization", auth.Authorization);
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    let body = {};
    try {
      body = await res.clone().json();
    } catch {
      /* ignore */
    }
    if (body.code === "TOKEN_EXPIRED" || body.code === "TOKEN_INVALID") {
      localStorage.removeItem("medscout_token");
      localStorage.removeItem("medscout_user_id");
      window.location.assign("/login?reason=session_expired");
      throw new Error("SESSION_EXPIRED");
    }
  }

  return res;
}
