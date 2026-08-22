/**
 * "Last used practice" — a sorting nudge, never a context.
 *
 * Phase 2B established that the URL is the only source of context truth. This
 * value exists so the chooser can put the practice you were just in near the
 * top; it must never decide which practice is active, or two tabs would fight
 * over one slot.
 *
 * sessionStorage, not localStorage, on purpose: it is per tab, so tab A
 * remembering the GP cannot influence tab B sitting in cardiology, and a shared
 * device does not carry the hint into the next person's session.
 */
const KEY = "medscout_last_used_practice_link";

export function readLastUsedPracticeLinkId() {
  try {
    return sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function rememberLastUsedPracticeLinkId(linkId) {
  try {
    if (linkId) sessionStorage.setItem(KEY, linkId);
  } catch {
    /* private mode or storage disabled — the hint is optional by design */
  }
}
