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

/** GET / — current subscription/reminder status for this user. */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return bad(res, 401, "unauthorized", "Unauthorized.");
  if (!isWebPushConfigured()) return res.json({ ok: true, enabled: false });

  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId },
      include: { reminders: true },
    });
    const reminders = subs.flatMap((s) => s.reminders);
    return res.json({
      ok: true,
      enabled: true,
      deviceCount: subs.length,
      intakeTimes: [
        ...new Set(
          reminders
            .filter((r) => r.type === "intake" && r.timeOfDay)
            .map((r) => r.timeOfDay),
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
  if (!isWebPushConfigured()) return notConfigured(res);

  const body = req.body ?? {};
  const s = body.subscription ?? {};
  const endpoint = typeof s.endpoint === "string" ? s.endpoint : "";
  const p256dh = s.keys?.p256dh;
  const auth = s.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return bad(res, 400, "invalid_subscription", "Invalid subscription.");
  }

  const soundEnabled = body.prefs?.sound !== false;
  const vibrationEnabled = body.prefs?.vibration !== false;
  const timezone =
    typeof body.timezone === "string" && body.timezone.trim()
      ? body.timezone.trim().slice(0, MAX_TZ)
      : "Europe/Berlin";

  try {
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh, auth, soundEnabled, vibrationEnabled, timezone },
      create: {
        userId,
        endpoint,
        p256dh,
        auth,
        soundEnabled,
        vibrationEnabled,
        timezone,
      },
    });

    const rows = normalizeReminders(body.reminders, userId, sub.id);
    await prisma.pushReminder.deleteMany({ where: { subscriptionId: sub.id } });
    if (rows.length > 0) {
      await prisma.pushReminder.createMany({ data: rows });
    }

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
