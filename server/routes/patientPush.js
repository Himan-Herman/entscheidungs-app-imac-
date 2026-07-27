/**
 * Patient medication-reminder push API — /api/patient/push (auth required).
 *
 * Stores only a Web Push subscription + reminder times + a generic, pre-localized
 * label. No medication names or clinical content are persisted. Every DB access is
 * gated behind isWebPushConfigured() so that, when VAPID keys are absent, the
 * routes no-op cleanly and never touch the (possibly un-migrated) tables.
 */
import express from "express";
import { prisma } from "../lib/prisma.js";
import {
  getVapidPublicKey,
  isWebPushConfigured,
  sendPush,
} from "../services/push/webPushService.js";

const router = express.Router();

const MAX_REMINDERS = 16;
const MAX_LABEL = 160;
const MAX_TZ = 64;

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function bad(res, status, code, message) {
  return res.status(status).json({ ok: false, error: code, message });
}

function notConfigured(res) {
  return res.status(503).json({ ok: false, error: "not_configured" });
}

function sanitizeLabel(v) {
  return typeof v === "string" ? v.trim().slice(0, MAX_LABEL) : "";
}

function validTimeOfDay(v) {
  return typeof v === "string" && /^(\d{1,2}):(\d{2})$/.test(v.trim());
}

/** Normalize the reminders array from the client into DB rows. */
function normalizeReminders(raw, userId, subscriptionId) {
  if (!Array.isArray(raw)) return [];
  const rows = [];
  for (const r of raw.slice(0, MAX_REMINDERS)) {
    const type = r?.type === "refill" ? "refill" : "intake";
    if (type === "intake") {
      if (!validTimeOfDay(r?.timeOfDay)) continue;
      rows.push({
        userId,
        subscriptionId,
        type,
        timeOfDay: String(r.timeOfDay).trim(),
        fireAt: null,
        label: sanitizeLabel(r?.label),
        url: typeof r?.url === "string" ? r.url.slice(0, 300) : null,
        active: true,
      });
    } else {
      const t = r?.fireAt ? new Date(r.fireAt) : null;
      if (!t || Number.isNaN(t.getTime())) continue;
      rows.push({
        userId,
        subscriptionId,
        type,
        timeOfDay: null,
        fireAt: t,
        label: sanitizeLabel(r?.label),
        url: typeof r?.url === "string" ? r.url.slice(0, 300) : null,
        active: true,
      });
    }
  }
  return rows;
}

/** GET /config — always safe (no DB). Tells the client if push is available. */
router.get("/config", (req, res) => {
  return res.json({
    ok: true,
    enabled: isWebPushConfigured(),
    publicKey: getVapidPublicKey(),
  });
});

/** GET / — this user's reminders and which notification channels are active. */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return bad(res, 401, "unauthorized", "Unauthorized.");

  try {
    // Reminders are user-owned, so they are readable even when web push is not
    // configured — the native app relies on exactly this.
    const [reminders, subs, channel] = await Promise.all([
      prisma.pushReminder.findMany({ where: { userId } }),
      prisma.pushSubscription.findMany({ where: { userId } }),
      prisma.pushChannelState.findUnique({ where: { userId } }),
    ]);

    return res.json({
      ok: true,
      // "enabled" keeps its old meaning for the existing web UI: can we deliver web push?
      enabled: isWebPushConfigured(),
      deviceCount: subs.length,
      channels: {
        webConfigured: isWebPushConfigured(),
        webSubscribed: subs.length > 0,
        webEnabled: channel?.webEnabled !== false,
        nativeEnabled: channel?.nativeEnabled === true,
      },
      intakeTimes: [
        ...new Set(
          reminders.filter((r) => r.type === "intake" && r.timeOfDay).map((r) => r.timeOfDay),
        ),
      ].sort(),
      hasRefill: reminders.some((r) => r.type === "refill" && r.active),
    });
  } catch (err) {
    console.error("[patient/push] status", err?.message ?? err);
    return bad(res, 500, "server_error", "Server error.");
  }
});

/**
 * PUT / — upsert this device's subscription and replace its reminders.
 * Body: { subscription:{endpoint,keys:{p256dh,auth}}, prefs:{sound,vibration},
 *         timezone, reminders:[...] }
 */
router.put("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return bad(res, 401, "unauthorized", "Unauthorized.");

  const body = req.body ?? {};
  const s = body.subscription ?? {};
  const endpoint = typeof s.endpoint === "string" ? s.endpoint : "";
  const p256dh = s.keys?.p256dh;
  const auth = s.keys?.auth;

  // A subscription is now OPTIONAL: the native app stores the same reminder times
  // and schedules them on the device. A half-filled subscription is still rejected.
  const hasSubscription = Boolean(endpoint || p256dh || auth);
  if (hasSubscription && !(endpoint && p256dh && auth)) {
    return bad(res, 400, "invalid_subscription", "Invalid subscription.");
  }
  if (hasSubscription && !isWebPushConfigured()) return notConfigured(res);

  // Which channel is the caller? The native app says so explicitly and never sends
  // a subscription; anything else is treated as a browser.
  const isNativeClient = body.channel === "native";

  const soundEnabled = body.prefs?.sound !== false;
  const vibrationEnabled = body.prefs?.vibration !== false;
  const timezone =
    typeof body.timezone === "string" && body.timezone.trim()
      ? body.timezone.trim().slice(0, MAX_TZ)
      : "Europe/Berlin";

  try {
    if (hasSubscription) {
      await prisma.pushSubscription.upsert({
        where: { endpoint },
        update: { userId, p256dh, auth, soundEnabled, vibrationEnabled, timezone },
        create: { userId, endpoint, p256dh, auth, soundEnabled, vibrationEnabled, timezone },
      });
    }

    // Reminders are replaced per USER, not per subscription — otherwise a patient
    // could never remove reminders created without one.
    const rows = normalizeReminders(body.reminders, userId, null).map((r) => ({
      ...r,
      timezone,
    }));
    await prisma.pushReminder.deleteMany({ where: { userId } });
    if (rows.length > 0) {
      await prisma.pushReminder.createMany({ data: rows });
    }

    // Channel bookkeeping. The native app taking over switches web push off so the
    // same reminder cannot arrive twice; the patient can turn it back on.
    await prisma.pushChannelState.upsert({
      where: { userId },
      update: isNativeClient
        ? { nativeEnabled: true, webEnabled: false, nativeSeenAt: new Date() }
        : { webEnabled: true },
      create: isNativeClient
        ? { userId, nativeEnabled: true, webEnabled: false, nativeSeenAt: new Date() }
        : { userId, nativeEnabled: false, webEnabled: true },
    });

    return res.json({ ok: true, reminderCount: rows.length });
  } catch (err) {
    console.error("[patient/push] put", err?.message ?? err);
    return bad(res, 500, "server_error", "Server error.");
  }
});

/** POST /test — send an immediate test notification to this user's devices. */
router.post("/test", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return bad(res, 401, "unauthorized", "Unauthorized.");
  if (!isWebPushConfigured()) return notConfigured(res);

  const label = sanitizeLabel(req.body?.label) || "Test";
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) {
      return bad(res, 404, "no_subscription", "No subscription on file.");
    }
    let delivered = 0;
    for (const sub of subs) {
      const result = await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          title: "MedScoutX",
          body: label,
          tag: "medscoutx-test",
          url: "/patient/medication-plans",
          silent: !sub.soundEnabled,
          vibrate: sub.vibrationEnabled,
        },
      );
      if (result.gone) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      } else if (result.ok) {
        delivered += 1;
      }
    }
    return res.json({ ok: true, delivered });
  } catch (err) {
    console.error("[patient/push] test", err?.message ?? err);
    return bad(res, 500, "server_error", "Server error.");
  }
});

/** DELETE / — remove this user's subscription(s). Body may include { endpoint }. */
router.delete("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return bad(res, 401, "unauthorized", "Unauthorized.");
  if (!isWebPushConfigured()) return res.json({ ok: true });

  const endpoint =
    typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
  try {
    await prisma.pushSubscription.deleteMany({
      where: endpoint ? { userId, endpoint } : { userId },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[patient/push] delete", err?.message ?? err);
    return bad(res, 500, "server_error", "Server error.");
  }
});

export default router;
