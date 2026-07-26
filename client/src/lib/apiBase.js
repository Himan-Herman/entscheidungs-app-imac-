/**
 * Single source of truth for how an API path becomes a real URL.
 *
 * Why this exists: in the browser the app is served from the same origin as the API,
 * so relative paths like "/api/patient/vitals" just work. Inside the native app
 * (Capacitor) the web layer is served from capacitor://localhost or http://localhost,
 * so a relative path would resolve against the app bundle and the request would fail.
 *
 * Design goal: ZERO change for the web build. On web we return the path untouched
 * (relative, exactly as before — dev proxy and same-origin production keep working).
 * Only inside the native shell do we prepend the absolute API base.
 */

/**
 * Absolute API origin used by the native app (and by apiFetch everywhere).
 * Optional chaining keeps the module importable outside Vite (unit tests, tooling),
 * where `import.meta.env` does not exist.
 */
export const API_BASE =
  import.meta.env?.VITE_API_BASE_URL || "https://api.medscout.app";

/**
 * True only when running inside the Capacitor native shell.
 * The Capacitor runtime injects `window.Capacitor`; no import is needed, so the
 * plain web bundle stays free of native dependencies.
 */
export function isNativeApp() {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.Capacitor?.isNativePlatform === "function" &&
      window.Capacitor.isNativePlatform() === true
    );
  } catch {
    return false;
  }
}

/**
 * Resolve an API path for the current runtime.
 * - already absolute (http/https)  → returned unchanged
 * - non-string (e.g. a Request)    → returned unchanged
 * - web                            → returned unchanged (relative, as before)
 * - native shell                   → prefixed with the absolute API base
 *
 * @param {unknown} path
 * @returns {unknown}
 */
export function resolveApiUrl(path) {
  if (typeof path !== "string") return path;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return path;
  if (!isNativeApp()) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Drop-in replacement for global fetch that resolves relative API paths.
 * Use for direct fetch calls that bypass authFetch/apiFetch.
 */
export function appFetch(input, init) {
  return fetch(resolveApiUrl(input), init);
}

/**
 * Remove any service worker + cache left behind by a previous web visit.
 * Only meaningful inside the native shell, where the store update — not a
 * service worker — is what delivers new assets. Never throws.
 */
export async function unregisterServiceWorkers() {
  try {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
    }
  } catch {
    /* best effort — never block app start */
  }
}
