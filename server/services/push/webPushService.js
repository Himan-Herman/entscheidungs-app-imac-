/**
 * Web Push transport (VAPID) for medication reminders.
 *
 * Graceful degradation: if VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are absent, the
 * feature is simply "not configured" — callers must check isWebPushConfigured()
 * and the routes/scheduler no-op. This mirrors the RESEND email pattern so the
 * server boots and runs unchanged when push is not set up.
 *
 * Privacy: this module only relays whatever payload it is given. Callers keep the
 * payload generic (no medication names, no clinical wording).
 */
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
/**
 * Contact point sent to the push services (FCM, Mozilla, Apple) in the JWT `sub`
 * claim — it is how they reach us if this sender causes problems. It must be a
 * mailbox that is actually read; a dead address defeats the purpose.
 */
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:contact@medscoutx.com";

let configured = false;
try {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  } else {
    console.warn(
      "⚠️  Web Push not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY missing) — medication reminders disabled.",
    );
  }
} catch (err) {
  configured = false;
  console.error("[web-push] VAPID init failed:", err?.message ?? err);
}

export function isWebPushConfigured() {
  return configured;
}

export function getVapidPublicKey() {
  return configured ? VAPID_PUBLIC_KEY : "";
}

/**
 * Send one push. Returns { ok: true } on success, or { ok: false, gone: true }
 * when the subscription is expired/invalid (404/410) so the caller can delete it.
 * Other errors return { ok: false, gone: false, error }.
 *
 * @param {{ endpoint: string, p256dh: string, auth: string }} sub
 * @param {object} payload  serialised as JSON and delivered to the service worker
 */
export async function sendPush(sub, payload) {
  if (!configured) return { ok: false, gone: false, error: "not_configured" };
  if (!sub?.endpoint || !sub?.p256dh || !sub?.auth) {
    return { ok: false, gone: false, error: "invalid_subscription" };
  }
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload || {}),
      { TTL: 3600 },
    );
    return { ok: true };
  } catch (err) {
    const status = err?.statusCode;
    if (status === 404 || status === 410) {
      return { ok: false, gone: true };
    }
    return { ok: false, gone: false, error: err?.message ?? "send_failed" };
  }
}
