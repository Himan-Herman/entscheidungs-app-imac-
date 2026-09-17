/**
 * Navigating to a destination the app did not write itself.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Almost every `navigate()` in this app is handed a literal or a template the
 * component built. Two are not: an inbox notice and a header notification each
 * carry a destination that came out of the database, through the API, and into
 * the router. Those two are the only places where a stored value decides where
 * the browser goes.
 *
 * React Router advisories through 7.17.0 include several open-redirect variants
 * in `<Link>` and `useNavigate`, and 7.18.2 fixes them. This check is not a
 * substitute for that upgrade — it is the belt beside it. A destination that
 * leaves this origin is not something the router should have to defend against
 * in the first place.
 *
 * ── The same question the server asks ───────────────────────────────────────
 * The server already derives these destinations and refuses anything that is
 * not same-origin (`safeInternalPath`, patientInboxTargets.js). This asks the
 * identical question in the identical way — resolve against the real origin,
 * require it to be unchanged — so the two cannot disagree. It is defence
 * against a stale deploy or a route this module has not seen, not a second
 * routing policy.
 *
 * ── Why the parser and not a character check ────────────────────────────────
 * "starts with / and not //" is the obvious rule and it is wrong: the browser
 * normalises a backslash to a slash before resolving, so `/\evil.example`
 * becomes `//evil.example` and leaves the origin. Measured, not assumed. The
 * URL parser here is the same one the browser uses to follow the link, so it
 * cannot drift from what the browser will actually do.
 */

/** Used when there is no `window` — server-side rendering, tests, workers. */
const FALLBACK_ORIGIN = "https://medscoutx.invalid";

function currentOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return FALLBACK_ORIGIN;
}

/**
 * The destination, if it stays inside this app. Otherwise `null`.
 *
 * @param {unknown} target a stored or server-derived path
 * @returns {string | null} the value unchanged, or null when it is not internal
 */
export function safeInternalPath(target) {
  if (typeof target !== "string") return null;
  const value = target.trim();
  // A path, not a URL. Anything else — `https:`, `javascript:`, `data:`,
  // `//host` — fails here before the parser is even asked.
  if (!value.startsWith("/")) return null;

  const origin = currentOrigin();
  let resolved;
  try {
    resolved = new URL(value, origin);
  } catch {
    return null;
  }
  if (resolved.origin !== origin) return null;

  // Returned as written: the router receives exactly the stored path, which
  // has now been shown to stay here.
  return value;
}

/**
 * Navigates only if the destination is internal.
 *
 * Refusing silently is deliberate. There is no useful thing to tell someone
 * whose notification points off-site — they did not write it and cannot fix
 * it — and an error dialogue would be a worse experience than a link that does
 * nothing. The developer console gets one line so the bad row can be found.
 *
 * @param {(to: string) => void} navigate the router's navigate function
 * @param {unknown} target
 * @returns {boolean} whether the navigation happened
 */
export function navigateInternal(navigate, target) {
  const path = safeInternalPath(target);
  if (!path) {
    if (target) {
      // The value itself is logged: it is a route, not medical content, and
      // without it the row cannot be found.
      console.warn("[navigation] refused a destination outside this app:", target);
    }
    return false;
  }
  navigate(path);
  return true;
}
