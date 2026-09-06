/**
 * The invitation credential, and where it is allowed to travel.
 *
 * THE ONE RULE: the token never appears in a URL the server can see.
 *
 * It lives in the URL FRAGMENT (`/patient-invitation#token=...`), which browsers
 * do not transmit. Everything downstream — preview, claim — sends it in a POST
 * body. That keeps it out of HTTP access logs, reverse-proxy logs, Referer
 * headers and tracing spans, five stores nobody guards like credential stores.
 *
 * The same reasoning applies on the client: never write it to `localStorage`
 * (it survives the tab and every later visitor to that browser profile), never
 * hand it to analytics or error reporting, and clear it once it has been spent.
 */

/** Where the practice sends the patient. Fragment, never query. */
export function buildInvitationLink(token, origin = window.location.origin) {
  return `${origin}/patient-invitation#token=${encodeURIComponent(token)}`;
}

/**
 * Read the credential out of the fragment.
 *
 * Returns the token only; a malformed fragment yields null rather than a guess.
 * @param {string} [hash]
 */
export function readTokenFromHash(hash = window.location.hash) {
  const raw = String(hash || "").replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const token = params.get("token");
  return token && token.trim() ? token.trim() : null;
}

/**
 * Remove the fragment from the address bar without adding a history entry.
 *
 * Called once the token is held in memory, so it stops being visible on screen,
 * stops being copied by a shoulder-surfing screenshot, and stops travelling into
 * a bookmark. `replaceState` rather than a navigation: a Back press must not
 * bring it back.
 */
export function clearTokenFromHash() {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

/*
 * RESUMING ACROSS LOGIN
 * ---------------------
 * Signing in navigates away, so the credential has to survive one round trip.
 * `sessionStorage` is the smallest store that can: it is per-tab and dies with
 * the tab, unlike `localStorage`, which would leave a working invitation on a
 * shared machine indefinitely. It is still cleared explicitly the moment the
 * claim succeeds or the user abandons the flow.
 */
const RESUME_KEY = "medscout_invitation_resume";

/** @param {{ token?: string|null, code?: string|null }} credential */
export function stashInvitation(credential) {
  try {
    const payload = {
      token: credential?.token || null,
      code: credential?.code || null,
      at: Date.now(),
    };
    if (!payload.token && !payload.code) return;
    window.sessionStorage.setItem(RESUME_KEY, JSON.stringify(payload));
  } catch {
    // A blocked or full storage must not break the flow: the user simply has to
    // open the link again after signing in.
  }
}

/**
 * @returns {{ token: string|null, code: string|null }|null}
 */
export function readStashedInvitation() {
  try {
    const raw = window.sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A stash older than the invitation itself can never work; drop it rather
    // than carry a dead credential around.
    if (!parsed || Date.now() - Number(parsed.at || 0) > 7 * 24 * 60 * 60 * 1000) {
      clearStashedInvitation();
      return null;
    }
    return { token: parsed.token || null, code: parsed.code || null };
  } catch {
    return null;
  }
}

export function clearStashedInvitation() {
  try {
    window.sessionStorage.removeItem(RESUME_KEY);
  } catch {
    /* nothing to clean up */
  }
}

/**
 * Where to send someone who needs to sign in first.
 *
 * The invitation page carries NO credential in this URL — the token is already
 * in sessionStorage. `next` is a bare path, so even the redirect target holds
 * nothing secret.
 */
export function loginReturnPath() {
  return "/patient-invitation";
}
