import { INTERPRETER_STORE_PREFIX } from "../constants.js";
import { clearAllLocalCloudSyncFlags } from "./interpreterCloudLocalFlags.js";
import {
  clearInterpreterInviteContext,
  consumeEphemeralInviteToken,
} from "./interpreterInviteContext.js";
import { getInterpreterStorageKey } from "../store/interpreterSessionStore.js";

/** Fired on logout in this tab (storage events do not fire in the same document). */
export const INTERPRETER_AUTH_CLEARED_EVENT = "medscout-interpreter-auth-cleared";

/**
 * Current authenticated user id from localStorage (MedScoutX patient login).
 */
export function getAuthenticatedUserId() {
  try {
    const id = localStorage.getItem("medscout_user_id");
    return typeof id === "string" && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Ensures interpreter local store key matches logged-in user.
 * @returns {{ ok: true } | { ok: false, reason: 'no_user' | 'anonymous_store' }}
 */
export function validateInterpreterAccountScope() {
  const authUserId = getAuthenticatedUserId();
  if (!authUserId) {
    return { ok: false, reason: "no_user" };
  }
  const storeKey = getInterpreterStorageKey();
  const expectedSuffix = `_${authUserId}`;
  if (!storeKey.endsWith(expectedSuffix)) {
    return { ok: false, reason: "anonymous_store" };
  }
  if (storeKey.includes(`${INTERPRETER_STORE_PREFIX}_anonymous`)) {
    return { ok: false, reason: "anonymous_store" };
  }
  return { ok: true };
}

/**
 * Call after login when user id may have changed — cloud UI should reload.
 * @param {() => void} onUserChange
 */
/**
 * Run after logout — clears cloud sync markers; local conversation text stays on device.
 */
export function runInterpreterLogoutCleanup() {
  try {
    clearAllLocalCloudSyncFlags();
    clearInterpreterInviteContext();
    consumeEphemeralInviteToken();
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(INTERPRETER_AUTH_CLEARED_EVENT));
  }
}

export function watchInterpreterAccountUser(onUserChange) {
  if (typeof window === "undefined") return () => {};

  let last = getAuthenticatedUserId();

  const onStorage = (e) => {
    if (e.key === "medscout_user_id") {
      const next = getAuthenticatedUserId();
      if (next !== last) {
        last = next;
        onUserChange();
      }
    }
  };

  const onAuthCleared = () => {
    last = null;
    onUserChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(INTERPRETER_AUTH_CLEARED_EVENT, onAuthCleared);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(INTERPRETER_AUTH_CLEARED_EVENT, onAuthCleared);
  };
}
