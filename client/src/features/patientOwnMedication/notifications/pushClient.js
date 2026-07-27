import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/patient/push";

import { isNativeApp } from "../../../lib/apiBase.js";

/**
 * Web Push is deliberately OFF inside the native shell.
 *
 * Two reasons: iOS exposes the Push API only to Safari home-screen web apps, never to a
 * WKWebView, so it could not work anyway; and a user running both the PWA and the app
 * would otherwise be notified twice for the same reminder. The app schedules locally
 * instead — see nativeReminders.js.
 */
export function isPushSupported() {
  if (isNativeApp()) return false;
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iOS delivers Web Push only from a PWA installed to the home screen. */
export function isIosNeedsInstall() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;
  return isIos && !standalone;
}

export function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
  } catch {
    return "Europe/Berlin";
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** GET /config → { enabled, publicKey } (safe even when push is off). */
export async function fetchPushConfig() {
  try {
    const res = await authFetch(`${BASE}/config`);
    const data = await res.json().catch(() => ({}));
    return { enabled: !!data.enabled, publicKey: data.publicKey || "" };
  } catch {
    return { enabled: false, publicKey: "" };
  }
}

/** GET / → current server-side status for this user. */
export async function fetchPushStatus() {
  const res = await authFetch(BASE);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Ask for notification permission. Returns the resulting permission string. */
export async function ensurePermission() {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/**
 * Subscribe this device (if needed) and sync the reminder set to the server.
 * @param {{ publicKey: string, reminders: Array, prefs: object }} args
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function subscribeAndSync({ publicKey, reminders, prefs }) {
  if (!isPushSupported()) return { ok: false, error: "unsupported" };
  if (!publicKey) return { ok: false, error: "not_configured" };

  const permission = await ensurePermission();
  if (permission !== "granted") return { ok: false, error: "permission_denied" };

  let registration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch {
    return { ok: false, error: "sw_unavailable" };
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    } catch {
      return { ok: false, error: "subscribe_failed" };
    }
  }

  try {
    const res = await authFetch(BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        prefs,
        timezone: getTimezone(),
        reminders,
      }),
    });
    if (!res.ok) return { ok: false, error: "sync_failed" };
    return { ok: true };
  } catch (e) {
    if (e?.message === "SESSION_EXPIRED") return { ok: false, error: "session" };
    return { ok: false, error: "sync_failed" };
  }
}

/** Re-sync reminders for the already-subscribed device (no permission prompt). */
export async function syncReminders({ reminders, prefs }) {
  if (!isPushSupported()) return { ok: false, error: "unsupported" };
  let registration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch {
    return { ok: false, error: "sw_unavailable" };
  }
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { ok: false, error: "no_subscription" };
  try {
    const res = await authFetch(BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        prefs,
        timezone: getTimezone(),
        reminders,
      }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false, error: "sync_failed" };
  }
}

/** Unsubscribe this device and remove it server-side. */
export async function disablePush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    const endpoint = subscription?.endpoint || "";
    if (subscription) await subscription.unsubscribe().catch(() => {});
    await authFetch(BASE, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    }).catch(() => {});
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Fire an immediate test notification. */
export async function sendTestPush(label) {
  const res = await authFetch(`${BASE}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
