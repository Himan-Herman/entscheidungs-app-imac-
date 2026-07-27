/** Local (on-device) medication reminders — scheduling, re-planning, cancellation. */
import test from "node:test";
import assert from "node:assert/strict";

const N = await import("../nativeReminders.js");
const {
  scheduleNativeReminders, cancelNativeReminders, requestNativeReminderPermission,
  checkNativeReminderPermission, pendingNativeReminderCount, isNativeRemindersSupported,
  __setNotificationPluginForTests, INTAKE_ID_BASE, MAX_NATIVE_REMINDERS,
} = N;

const asNative = () => { globalThis.window = { Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" } }; };
const asWeb = () => { delete globalThis.window; };
const COPY = { title: "Medikamenten-Erinnerung", body: "Zeit fuer Ihre Einnahme." };

function fakeOs(initialPermission = "granted") {
  const pending = new Map();
  return {
    pending,
    plugin: {
      requestPermissions: async () => ({ display: initialPermission }),
      checkPermissions: async () => ({ display: initialPermission }),
      schedule: async ({ notifications }) => { for (const n of notifications) pending.set(n.id, n); },
      getPending: async () => ({ notifications: [...pending.values()] }),
      cancel: async ({ notifications }) => { for (const n of notifications) pending.delete(n.id); },
    },
  };
}

test("only meaningful inside the native shell", () => {
  asWeb();  assert.equal(isNativeRemindersSupported(), false);
  asNative(); assert.equal(isNativeRemindersSupported(), true);
});

test("schedules one daily notification per time, as a wall-clock rule", async () => {
  asNative();
  const os = fakeOs(); __setNotificationPluginForTests(os.plugin);
  const r = await scheduleNativeReminders(["08:00", "20:30"], COPY);
  assert.equal(r.scheduled, 2);
  const planned = [...os.pending.values()];
  assert.deepEqual(planned.map((n) => n.schedule.on), [{ hour: 8, minute: 0 }, { hour: 20, minute: 30 }]);
  assert.ok(planned.every((n) => !("at" in n.schedule)), "must not pin absolute timestamps");
});

test("re-planning replaces, never stacks — no double notifications", async () => {
  asNative();
  const os = fakeOs(); __setNotificationPluginForTests(os.plugin);
  await scheduleNativeReminders(["08:00", "20:00"], COPY);
  await scheduleNativeReminders(["08:00", "20:00"], COPY);
  assert.equal(os.pending.size, 2, "identical re-plan must not double the schedule");
  await scheduleNativeReminders(["09:15"], COPY);
  assert.equal(os.pending.size, 1, "old times must be gone");
  assert.deepEqual([...os.pending.values()][0].schedule.on, { hour: 9, minute: 15 });
});

test("ids are stable and confined to our own range", async () => {
  asNative();
  const os = fakeOs(); __setNotificationPluginForTests(os.plugin);
  await scheduleNativeReminders(["08:00", "12:00"], COPY);
  const ids = [...os.pending.keys()];
  assert.deepEqual(ids, [INTAKE_ID_BASE, INTAKE_ID_BASE + 1]);
  assert.ok(ids.every((id) => id >= INTAKE_ID_BASE && id < INTAKE_ID_BASE + MAX_NATIVE_REMINDERS));
});

test("deactivating cancels everything we scheduled", async () => {
  asNative();
  const os = fakeOs(); __setNotificationPluginForTests(os.plugin);
  await scheduleNativeReminders(["08:00", "20:00"], COPY);
  await cancelNativeReminders();
  assert.equal(os.pending.size, 0);
  assert.equal(await pendingNativeReminderCount(), 0);
});

test("foreign notifications are never cancelled", async () => {
  asNative();
  const os = fakeOs(); __setNotificationPluginForTests(os.plugin);
  os.pending.set(7, { id: 7, title: "someone elses" });
  await scheduleNativeReminders(["08:00"], COPY);
  await cancelNativeReminders();
  assert.deepEqual([...os.pending.keys()], [7], "another features notification must survive");
});

test("duplicate and malformed times are dropped", async () => {
  asNative();
  const os = fakeOs(); __setNotificationPluginForTests(os.plugin);
  const r = await scheduleNativeReminders(["08:00", "08:00", "25:00", "8:0", "", null, "20:00"], COPY);
  assert.equal(r.scheduled, 2, "only 08:00 and 20:00 are valid and unique");
  assert.equal(r.skipped, 1, "the repeated 08:00 is reported as skipped");
});

test("empty list schedules nothing but still clears the old plan", async () => {
  asNative();
  const os = fakeOs(); __setNotificationPluginForTests(os.plugin);
  await scheduleNativeReminders(["08:00"], COPY);
  const r = await scheduleNativeReminders([], COPY);
  assert.equal(r.scheduled, 0);
  assert.equal(os.pending.size, 0);
});

test("permission is only ever granted by the OS, never assumed", async () => {
  asNative();
  __setNotificationPluginForTests(fakeOs("denied").plugin);
  assert.equal(await requestNativeReminderPermission(), false);
  assert.equal(await checkNativeReminderPermission(), "denied");
  __setNotificationPluginForTests(fakeOs("granted").plugin);
  assert.equal(await requestNativeReminderPermission(), true);
});

test("a missing or throwing plugin never crashes the page", async () => {
  asNative();
  __setNotificationPluginForTests(undefined);
  assert.deepEqual(await scheduleNativeReminders(["08:00"], COPY), { scheduled: 0, skipped: 0 });
  assert.equal(await requestNativeReminderPermission(), false);
  assert.equal(await pendingNativeReminderCount(), 0);
  await cancelNativeReminders();
  __setNotificationPluginForTests({
    schedule: async () => { throw new Error("boom"); },
    getPending: async () => { throw new Error("boom"); },
    cancel: async () => {},
  });
  assert.equal((await scheduleNativeReminders(["08:00"], COPY)).scheduled, 0);
});

test("no medication detail is put on the lock screen", async () => {
  asNative();
  const os = fakeOs(); __setNotificationPluginForTests(os.plugin);
  await scheduleNativeReminders(["08:00"], COPY);
  const n = [...os.pending.values()][0];
  const text = `${n.title} ${n.body}`.toLowerCase();
  for (const leak of ["mg", "tablette", "dosis", "ibuprofen"]) {
    assert.equal(text.includes(leak), false, `"${leak}" must not appear`);
  }
});
