/** Build id injected at compile time (Vercel commit SHA or timestamp). */
export const APP_BUILD_ID = import.meta.env.VITE_BUILD_ID || "dev";

const STORAGE_KEY = "medscout_app_build_id";

/**
 * After a new production deploy, unregister stale service workers once so all
 * domains serve the same bundle (fixes old PWA precache on .app vs .com).
 */
export async function runPwaBuildMigration() {
  if (typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;

  const previous = localStorage.getItem(STORAGE_KEY);
  if (previous === APP_BUILD_ID) return;

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* best effort */
  }

  localStorage.setItem(STORAGE_KEY, APP_BUILD_ID);

  if (previous && previous !== APP_BUILD_ID) {
    window.location.reload();
  }
}
