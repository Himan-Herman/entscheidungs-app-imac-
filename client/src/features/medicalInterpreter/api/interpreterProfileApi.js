import { authFetch } from "../../../api/authFetch.js";

/**
 * Loads account personal settings for interpreter setup defaults / optional snapshot.
 * Does not persist anything — caller must respect profileConsentUsed.
 *
 * @returns {Promise<{ ok: boolean, user?: object, profile?: object, error?: string }>}
 */
export async function fetchInterpreterProfileSettings() {
  try {
    const res = await authFetch("/api/account/patient-settings");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: "load_failed" };
    }
    return {
      ok: true,
      user: data.user ?? {},
      profile: data.profile ?? {},
    };
  } catch (e) {
    if (e?.message === "SESSION_EXPIRED") throw e;
    return { ok: false, error: "network" };
  }
}

/**
 * @param {{ user?: object, profile?: object }} data
 * @returns {import('../types.js').InterpreterProfileSnapshot | null}
 */
export function buildProfileSnapshotFromSettings(data) {
  const u = data?.user ?? {};
  const p = data?.profile ?? {};
  const snapshot = {
    firstName: typeof u.firstName === "string" ? u.firstName.trim() : undefined,
    lastName: typeof u.lastName === "string" ? u.lastName.trim() : undefined,
    dateOfBirth:
      u.dateOfBirth != null ? String(u.dateOfBirth).slice(0, 10) : undefined,
    email: typeof u.email === "string" ? u.email.trim() : undefined,
    phone: typeof p.phone === "string" ? p.phone.trim() : undefined,
  };
  const hasValue = Object.values(snapshot).some((v) => v);
  return hasValue ? snapshot : null;
}

/**
 * @param {{ user?: object, profile?: object }} data
 * @returns {boolean}
 */
export function hasUsableProfileSettings(data) {
  return buildProfileSnapshotFromSettings(data) != null;
}
