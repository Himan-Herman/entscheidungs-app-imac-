const STORAGE_KEY = "medscoutx_user_mode";

export const USER_MODES = {
  PATIENT: "patient",
  PRACTICE: "practice",
};

export function readUserMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === USER_MODES.PRACTICE) return USER_MODES.PRACTICE;
    return USER_MODES.PATIENT;
  } catch {
    return USER_MODES.PATIENT;
  }
}

export function writeUserMode(mode) {
  const next =
    mode === USER_MODES.PRACTICE ? USER_MODES.PRACTICE : USER_MODES.PATIENT;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent("medscoutx_user_mode_changed", { detail: next }),
    );
  } catch {
    /* ignore */
  }
}

export const PENDING_MODE_KEY = "medscoutx_pending_mode";
