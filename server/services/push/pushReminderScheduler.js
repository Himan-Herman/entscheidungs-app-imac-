/**
 * Medication-reminder dispatcher.
 *
 * Runs on a guarded in-process interval (same pattern as the interpreter session
 * purge). Every tick it finds due reminders and sends a push. Fully isolated:
 * wrapped in try/catch so it can never affect other server work, and it never
 * starts unless Web Push is configured.
 *
 * Delivery windows use the subscription timezone. A `lastSentOn` date guard makes
 * sends idempotent within a day, so overlapping ticks / restarts don't duplicate.
 */
import { prisma } from "../../lib/prisma.js";
import { isWebPushConfigured, sendPush } from "./webPushService.js";

const TICK_MS = 60_000;
// How many minutes after the scheduled time we still send (covers tick drift /
// brief downtime) before giving up for the day.
const INTAKE_WINDOW_MIN = 10;

let timer = null;

/** { ymd: "YYYY-MM-DD", minutes: number } for `date` in `timeZone`. */
/**
 * Decides whether the SERVER may deliver this account's reminder over Web Push.
 *
 * The one place the dual-channel contract lives. A patient may legitimately run the
 * native app and the PWA at the same time; without this rule both would fire and the
 * same intake would be announced twice. The native app schedules locally and sets
 * `nativeEnabled` + `webEnabled:false`, which silences the server for that account.
 *
 * A patient who deliberately wants browser notifications too keeps `webEnabled:true`,
 * and an account with no channel row at all (pure web user) keeps working unchanged.
 *
 * @param {{nativeEnabled?:boolean, webEnabled?:boolean}|null|undefined} channel
 * @returns {boolean} true when web push delivery is allowed
 */
export function shouldSendWebPush(channel) {
  if (channel?.nativeEnabled && channel?.webEnabled === false) return false;
  return true;
}

function zonedParts(date, timeZone) {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(date).map((p) => [p.type, p.value]),
    );
    const ymd = `${parts.year}-${parts.month}-${parts.day}`;
    let hour = parseInt(parts.hour, 10);
    if (hour === 24) hour = 0; // some engines emit "24" at midnight
    const minutes = hour * 60 + parseInt(parts.minute, 10);
    return { ymd, minutes };
  } catch {
    // Fallback to UTC if the timezone string is invalid.
    const ymd = date.toISOString().slice(0, 10);
    const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
    return { ymd, minutes };
  }
}

function parseHhMm(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function buildPayload(reminder) {
  const sub = reminder.subscription;
  return {
    title: "MedScoutX",
    body: reminder.label || "",
    tag: `medscoutx-${reminder.type}-${reminder.id}`,
    url: reminder.url || "/patient/medication-plans",
    silent: sub ? !sub.soundEnabled : false,
    vibrate: sub ? sub.vibrationEnabled : true,
  };
}

/**
 * Send all reminders that are due at `now`. Exported for tests and for optional
 * wiring into an external cron. Never throws.
 * @returns {Promise<{ sent: number, removed: number, checked: number }>}
 */
export async function dispatchDueReminders(now = new Date()) {
  if (!isWebPushConfigured()) return { sent: 0, removed: 0, checked: 0, skippedNative: 0 };

  let reminders = [];
  try {
    // Reminders belong to the USER, not to a subscription. Everything needed to decide
    // delivery — the user's channel state and all their web subscriptions — is loaded
    // with them, so one reminder can reach several browsers of the same person.
    reminders = await prisma.pushReminder.findMany({
      where: { active: true },
      include: {
        user: {
          select: {
            pushChannelState: true,
            pushSubscriptions: true,
          },
        },
      },
    });
  } catch (err) {
    console.error("[push-scheduler] load failed:", err?.message ?? err);
    return { sent: 0, removed: 0, checked: 0, skippedNative: 0 };
  }

  let sent = 0;
  let removed = 0;
  let skippedNative = 0;

  for (const reminder of reminders) {
    const channel = reminder.user?.pushChannelState;
    const subs = reminder.user?.pushSubscriptions || [];

    if (!shouldSendWebPush(channel)) {
      skippedNative += 1;
      continue;
    }
    if (subs.length === 0) continue;   // nothing to deliver to — not an error

    // The reminder's own timezone wins; fall back to a subscription's, then Berlin.
    const tz = reminder.timezone || subs[0]?.timezone || "Europe/Berlin";
    const { ymd, minutes } = zonedParts(now, tz);

    let due = false;
    if (reminder.type === "intake") {
      const target = parseHhMm(reminder.timeOfDay);
      if (
        target !== null &&
        reminder.lastSentOn !== ymd &&
        minutes >= target &&
        minutes <= target + INTAKE_WINDOW_MIN
      ) {
        due = true;
      }
    } else if (reminder.type === "refill") {
      if (
        reminder.fireAt &&
        new Date(reminder.fireAt).getTime() <= now.getTime() &&
        reminder.lastSentOn !== ymd
      ) {
        due = true;
      }
    }
    if (!due) continue;

    // Deliver to every browser this patient registered; a dead one is pruned, and a
    // single failure must not stop the others.
    let anyDelivered = false;
    for (const sub of subs) {
      const result = await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        buildPayload(reminder),
      );
      if (result.gone) {
        // Expired at the push service. Reminders survive this now (FK is SET NULL).
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        removed += 1;
      } else if (result.ok) {
        anyDelivered = true;
      }
    }

    if (!anyDelivered) continue;

    try {
      await prisma.pushReminder.update({
        where: { id: reminder.id },
        data: reminder.type === "refill" ? { lastSentOn: ymd, active: false } : { lastSentOn: ymd },
      });
      sent += 1;
    } catch (err) {
      console.error("[push-scheduler] update failed:", err?.message ?? err);
    }
  }

  return { sent, removed, checked: reminders.length, skippedNative };
}

/** Start the guarded interval. No-op if push is not configured or already started. */
export function startPushReminderScheduler() {
  if (!isWebPushConfigured() || timer) return;
  timer = setInterval(() => {
    dispatchDueReminders(new Date()).catch((err) =>
      console.error("[push-scheduler] tick failed:", err?.message ?? err),
    );
  }, TICK_MS);
  timer.unref?.();
  console.log("🔔 Medication push-reminder scheduler started.");
}
