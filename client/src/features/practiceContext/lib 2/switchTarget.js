/**
 * Where a practice switch lands.
 *
 * Staying on the same kind of page across a switch is what makes the switcher
 * feel like a context change rather than a navigation: from practice A's
 * messages, choosing B should open B's messages.
 *
 * That only holds for sub-pages that actually EXIST in every context. Guessing
 * would produce dead links, so the mapping is an explicit allowlist and anything
 * unknown falls back to the target practice's home. No magic.
 */
const PORTABLE_SUBPATHS = [
  "messages",
  "appointments",
  "documents",
  "medication-plans",
  "erezept",
];

/**
 * @param {string} currentPathname e.g. /patient/practice/link-a/messages
 * @param {string} targetLinkId
 * @returns {string} path in the target context
 */
export function switchTargetPath(currentPathname, targetLinkId) {
  const target = String(targetLinkId || "").trim();
  if (!target) return "/patient/practice";

  const match = String(currentPathname || "").match(
    /^\/patient\/practice\/[^/]+(?:\/(.*))?$/,
  );
  const subPath = (match?.[1] ?? "").replace(/\/+$/, "");

  if (subPath && PORTABLE_SUBPATHS.includes(subPath)) {
    return `/patient/practice/${target}/${subPath}`;
  }
  return `/patient/practice/${target}`;
}
