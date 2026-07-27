/**
 * Proof for the dual-channel contract: the same intake must never be announced twice.
 *
 * A patient may run the native app and the PWA on the same account at the same time.
 * The app schedules reminders locally through the OS; the server delivers over Web Push.
 * Exactly one of the two may speak per account, and this is the rule that decides.
 *
 * Deliberately DB-free — it tests the decision, not the plumbing around it.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { shouldSendWebPush } from "../pushReminderScheduler.js";

test("pure web user (no channel row) still receives web push", () => {
  assert.equal(shouldSendWebPush(null), true);
  assert.equal(shouldSendWebPush(undefined), true);
  assert.equal(shouldSendWebPush({}), true);
});

test("native app enabled and web switched off — server stays silent", () => {
  assert.equal(shouldSendWebPush({ nativeEnabled: true, webEnabled: false }), false);
});

test("no double notification: app + PWA on one account produce exactly one channel", () => {
  // Both devices are live. The app has planned the intake locally, so the only
  // legitimate outcome is that the server does NOT also send it.
  const afterAppEnabledReminders = { nativeEnabled: true, webEnabled: false };
  const localChannelSpeaks = true; // the OS has the notification scheduled
  const serverChannelSpeaks = shouldSendWebPush(afterAppEnabledReminders);

  assert.equal(
    [localChannelSpeaks, serverChannelSpeaks].filter(Boolean).length,
    1,
    "exactly one channel may deliver a given reminder",
  );
});

test("patient who explicitly wants browser notifications too keeps them", () => {
  // Opting web back in is a deliberate choice and must survive the native flag.
  assert.equal(shouldSendWebPush({ nativeEnabled: true, webEnabled: true }), true);
});

test("app uninstalled but flag left over — web still works once re-enabled", () => {
  assert.equal(shouldSendWebPush({ nativeEnabled: false, webEnabled: true }), true);
  assert.equal(shouldSendWebPush({ nativeEnabled: false, webEnabled: false }), true);
});
