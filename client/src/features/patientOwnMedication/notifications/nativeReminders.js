/**
 * Medication reminders on the device (iOS/Android) via @capacitor/local-notifications.
 *
 * Scheduled entirely on the phone — no server, no APNs/FCM, no certificates. The same
 * reminder times the web channel stores are simply re-planned locally, so a patient
 * using only the app still gets reminded.
 *
 * Deliberately dumb: it fires a neutral reminder. No medication names, no dosages,
 * no clinical wording — a lock screen is not a private place.
 *
 * The plugin is loaded lazily so the web bundle never pulls in native code.
 */

import { isNativeApp } from "../../../lib/apiBase.js";

/**
 * Notification id space reserved for intake reminders. Ids must be STABLE so a
 * re-plan replaces the previous schedule instead of stacking a second one.
 */
export const INTAKE_ID_BASE = 41000;
/** Hard cap; the API also limits how many pending notifications iOS keeps (64). */
export const MAX_NATIVE_REMINDERS = 32;

let pluginPromise = null;

async function loadPlugin() {
  if (!pluginPromise) {
    pluginPromise = import("@capacitor/local-notifications")
      .then((m) => m.LocalNotifications ?? m.default ?? null)
      .catch(() => null);
  }
  return pluginPromise;
}

/** Test seam. Pass null to restore real loading. */
export function __setNotificationPluginForTests(stub) {
  pluginPromise = stub === null ? null : Promise.resolve(stub);
}

/** Local notifications are only meaningful inside the native shell. */
export function isNativeRemindersSupported() {
  return isNativeApp();
}

/**
 * Deterministic id for a reminder time, so the same "08:00" always maps to the same
 * notification and re-planning cannot create duplicates.
 * @param {string} timeOfDay "HH:MM"
 * @param {number} index position in the user's list
 */
export function reminderIdFor(timeOfDay, index) {
  return INTAKE_ID_BASE + index;
}

/**
 * Ask the OS for permission. MUST be called from a deliberate user action — never on
 * app start. Returns true only when the patient actually granted it.
 */
export async function requestNativeReminderPermission() {
  try {
    const plugin = await loadPlugin();
    if (!plugin?.requestPermissions) return false;
    const res = await plugin.requestPermissions();
    return res?.display === "granted";
  } catch {
    return false;
  }
}

/** Current permission state without prompting (handles a later revocation). */
export async function checkNativeReminderPermission() {
  try {
    const plugin = await loadPlugin();
    if (!plugin?.checkPermissions) return "unknown";
    const res = await plugin.checkPermissions();
    return res?.display || "unknown";
  } catch {
    return "unknown";
  }
}

/** Remove every reminder this module scheduled. Used before re-planning and on disable. */
export async function cancelNativeReminders() {
  try {
    const plugin = await loadPlugin();
    if (!plugin?.getPending || !plugin?.cancel) return;
    const pending = await plugin.getPending();
    const ours = (pending?.notifications || []).filter(
      (n) => Number(n.id) >= INTAKE_ID_BASE && Number(n.id) < INTAKE_ID_BASE + MAX_NATIVE_REMINDERS,
    );
    if (ours.length > 0) {
      await plugin.cancel({ notifications: ours.map((n) => ({ id: Number(n.id) })) });
    }
  } catch {
    /* best effort — a failed cancel must not block re-planning */
  }
}

/**
 * Plan the given daily intake times on the device.
 *
 * Always cancels first, so calling this after every change is safe and idempotent —
 * the same time can never end up scheduled twice.
 *
 * Timezone: `on: { hour, minute }` is a wall-clock rule evaluated by the OS in the
 * device's current zone, so travelling and daylight-saving changes are handled by the
 * platform rather than by us computing timestamps that would silently drift.
 *
 * @param {string[]} times e.g. ["08:00","20:00"]
 * @param {{title:string, body:string}} copy already localised, non-clinical
 * @returns {Promise<{scheduled:number, skipped:number}>}
 */
export async function scheduleNativeReminders(times, copy) {
  const plugin = await loadPlugin();
  if (!plugin?.schedule) return { scheduled: 0, skipped: 0 };

  await cancelNativeReminders();

  const valid = (Array.isArray(times) ? times : [])
    .map((t) => String(t || "").trim())
    .filter((t) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(t));
  const unique = [...new Set(valid)].slice(0, MAX_NATIVE_REMINDERS);
  const skipped = valid.length - unique.length;

  if (unique.length === 0) return { scheduled: 0, skipped };

  const notifications = unique.map((t, i) => {
    const [hour, minute] = t.split(":").map(Number);
    return {
      id: reminderIdFor(t, i),
      title: copy?.title || "Erinnerung",
      body: copy?.body || "",
      schedule: { on: { hour, minute }, allowWhileIdle: true },
    };
  });

  try {
    await plugin.schedule({ notifications });
    return { scheduled: notifications.length, skipped };
  } catch {
    return { scheduled: 0, skipped };
  }
}

/** What is currently planned on this device — used to show honest status in the UI. */
export async function pendingNativeReminderCount() {
  try {
    const plugin = await loadPlugin();
    if (!plugin?.getPending) return 0;
    const pending = await plugin.getPending();
    return (pending?.notifications || []).filter(
      (n) => Number(n.id) >= INTAKE_ID_BASE && Number(n.id) < INTAKE_ID_BASE + MAX_NATIVE_REMINDERS,
    ).length;
  } catch {
    return 0;
  }
}
