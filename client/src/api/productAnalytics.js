import { authFetch } from "./authFetch.js";

export function detectDeviceType() {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth || 0;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

/**
 * Fire-and-forget authenticated analytics beacon (no medical content).
 */
export async function sendPracticeAnalyticsEvent(payload) {
  try {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem("medscout_token")) return;
    await authFetch("/api/practice/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore */
  }
}
