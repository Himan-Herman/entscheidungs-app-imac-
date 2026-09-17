/**
 * Phase 5C — the central header entry.
 *
 * 5C adds no table and no second status. It is a READ over the two inboxes
 * that already exist, so what these tests hold is not "does it store the right
 * thing" but "does it say the right thing, to the right person, about the
 * right tenant":
 *
 *   A  the patient badge counts unread PatientInboxItems, nothing else
 *   B  the practice badge counts new PracticeInboxItems, nothing else
 *   C  follow-ups are NEVER part of that badge
 *   D  follow-ups are only visible with reminders.read — absent, not zero
 *   E  only OPEN follow-ups count
 *   F  internal notes influence nothing at all
 *   G  the read creates no PracticeInboxItem and no PatientInboxItem
 *   H  the follow-up link leads to the existing 5B work surface
 *   I  a patient response contains no practice fields, and vice versa
 *   J  a preview carries no patientUserId and no unvalidated stored target
 *
 * Run: node --test scripts/verifyNotificationCenter5C.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import {
  getPatientNotificationSummary,
  getPracticeNotificationSummary,
} from "../services/notificationCenter/notificationCenterService.js";
// Phase 6a moved this into its own module so the inbox serializer and the
// header preview share one derivation. Same function, one home.
import { practiceInboxTargetUrl } from "../services/practiceInbox/practiceInboxTargets.js";
import { upsertPatientInboxItem } from "../services/patientInbox/patientInboxService.js";
import { upsertPracticeInboxItem } from "../services/practiceInbox/practiceInboxService.js";
import { createReminder, completeReminder } from "../services/practiceInternalWork/reminderService.js";
import { createInternalNote } from "../services/practiceInternalWork/internalNoteService.js";
import { PERMISSIONS, hasPracticePermission } from "../utils/practicePermissions.js";

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

async function buildWorld(t) {
  const stamp = Date.now() + Math.floor(Math.random() * 1000);
  const mk = (tag, first) =>
    prisma.user.create({
      data: {
        email: `nc-${tag}-${stamp}@test.invalid`,
        passwordHash: "x",
        firstName: first,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });

  const [ownerA, ownerB, patient] = await Promise.all([
    mk("oa", "Owner"), mk("ob", "Fremd"), mk("p", "Mia"),
  ]);
  const practiceA = await prisma.practiceProfile.create({
    data: { userId: ownerA.id, practiceName: "PraxisA", publicSlug: `nca-${stamp}`, isActive: true },
  });
  const practiceB = await prisma.practiceProfile.create({
    data: { userId: ownerB.id, practiceName: "PraxisB", publicSlug: `ncb-${stamp}`, isActive: true },
  });
  const link = (pid) =>
    prisma.practicePatientLink.create({
      data: { practiceProfileId: pid, patientUserId: patient.id, status: "active" },
    });
  const [a1, b1] = await Promise.all([link(practiceA.id), link(practiceB.id)]);

  t.after(() => prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.invalid` } } }));
  return { practiceA, practiceB, ownerA, ownerB, patient, a1, b1, stamp };
}

const scope = (link, owner) => ({
  linkId: link.id,
  practicePatientLinkId: link.id,
  practiceProfileId: link.practiceProfileId,
  actorUserId: owner.id,
});

const practiceNotice = (w, link, extra = {}) =>
  upsertPracticeInboxItem({
    practiceProfileId: link.practiceProfileId,
    practicePatientLinkId: link.id,
    patientUserId: w.patient.id,
    type: "message",
    title: "Neue Patientennachricht",
    sourceRefType: "thread",
    sourceRefId: `t-${Math.random().toString(36).slice(2)}`,
    ...extra,
  });

const patientNotice = (w, extra = {}) =>
  upsertPatientInboxItem({
    patientUserId: w.patient.id,
    practiceProfileId: w.practiceA.id,
    practicePatientLinkId: w.a1.id,
    type: "message",
    title: "Neue Information von Ihrer Praxis",
    sourceRefType: "patient_thread",
    sourceRefId: `p-${Math.random().toString(36).slice(2)}`,
    ...extra,
  });

const ALLOWED = { canReadReminders: true };
const DENIED = { canReadReminders: false };

/* ══════════════════════════════════════════ A/B — the badge means one thing */

test("A the patient badge counts unread patient inbox items", { skip }, async (t) => {
  const w = await buildWorld(t);
  await patientNotice(w);
  await patientNotice(w);

  const s = await getPatientNotificationSummary(w.patient.id);
  assert.equal(s.unreadInboxCount, 2);
  assert.equal(s.items.length, 2);
  assert.equal(s.inboxPath, "/patient/inbox");
});

test("B the practice badge counts new practice inbox items", { skip }, async (t) => {
  const w = await buildWorld(t);
  await practiceNotice(w, w.a1);
  await practiceNotice(w, w.a1);
  // Another practice's item must not be visible from here.
  await practiceNotice(w, w.b1);

  const a = await getPracticeNotificationSummary({
    practiceProfileId: w.practiceA.id, ...ALLOWED,
  });
  assert.equal(a.newInboxCount, 2);
  assert.equal(a.inboxPath, "/practice/inbox");

  const b = await getPracticeNotificationSummary({
    practiceProfileId: w.practiceB.id, ...ALLOWED,
  });
  assert.equal(b.newInboxCount, 1);
});

test("B a read or done item leaves the badge", { skip }, async (t) => {
  const w = await buildWorld(t);
  const item = await practiceNotice(w, w.a1);
  await prisma.practiceInboxItem.update({ where: { id: item.id }, data: { status: "read" } });

  const s = await getPracticeNotificationSummary({
    practiceProfileId: w.practiceA.id, ...ALLOWED,
  });
  assert.equal(s.newInboxCount, 0);
});

/* ═════════════════════════════════════ C/E — follow-ups are a separate metric */

test("C an open follow-up does not raise the inbox badge", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createReminder({ ...scope(w.a1, w.ownerA), title: "Rückruf", dueAt: "2026-09-01T09:00:00.000Z" });

  const s = await getPracticeNotificationSummary({
    practiceProfileId: w.practiceA.id, ...ALLOWED,
  });
  // The work exists and is reported — but as its own number.
  assert.equal(s.openReminderCount, 1);
  assert.equal(s.newInboxCount, 0);
  assert.equal(s.items.length, 0);
});

test("E only open follow-ups count", { skip }, async (t) => {
  const w = await buildWorld(t);
  const r = await createReminder({
    ...scope(w.a1, w.ownerA), title: "erledigt gleich", dueAt: "2026-09-01T09:00:00.000Z",
  });
  await completeReminder({ ...scope(w.a1, w.ownerA), reminderId: r.id });

  const s = await getPracticeNotificationSummary({
    practiceProfileId: w.practiceA.id, ...ALLOWED,
  });
  assert.equal(s.openReminderCount, 0);
});

test("C follow-ups never reach across practices", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createReminder({ ...scope(w.b1, w.ownerB), title: "B", dueAt: "2026-09-01T09:00:00.000Z" });

  const a = await getPracticeNotificationSummary({
    practiceProfileId: w.practiceA.id, ...ALLOWED,
  });
  assert.equal(a.openReminderCount, 0);
});

/* ═══════════════════════════════════════════ D — absent, not zero, when denied */

test("D without reminders.read there is no follow-up key at all", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createReminder({ ...scope(w.a1, w.ownerA), title: "Rückruf", dueAt: "2026-09-01T09:00:00.000Z" });

  const s = await getPracticeNotificationSummary({
    practiceProfileId: w.practiceA.id, ...DENIED,
  });
  // A zero would still confirm that follow-ups are kept here.
  assert.equal("openReminderCount" in s, false);
  assert.equal("remindersPath" in s, false);
  assert.equal(JSON.stringify(s).includes("Reminder"), false);
});

test("D viewer is the role without reminders.read", { skip }, () => {
  assert.equal(hasPracticePermission("viewer", PERMISSIONS.REMINDERS_READ), false);
  for (const role of ["owner", "admin", "doctor", "secretary", "assistant", "practice_manager"]) {
    assert.equal(hasPracticePermission(role, PERMISSIONS.REMINDERS_READ), true, role);
  }
});

/* ══════════════════════════════════════════════ F — internal notes are silent */

test("F an internal note produces no notification and no count", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createInternalNote({ ...scope(w.a1, w.ownerA), body: "intern, bleibt intern" });

  const s = await getPracticeNotificationSummary({
    practiceProfileId: w.practiceA.id, ...ALLOWED,
  });
  assert.equal(s.newInboxCount, 0);
  assert.equal(s.items.length, 0);
  assert.equal("internalNoteCount" in s, false);

  // ...and nothing was written into the patient's inbox either.
  const p = await getPatientNotificationSummary(w.patient.id);
  assert.equal(p.unreadInboxCount, 0);
});

/* ══════════════════════════════════════════════════ G — the read writes nothing */

test("G reading the summary creates no inbox rows", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createReminder({ ...scope(w.a1, w.ownerA), title: "Rückruf", dueAt: "2026-09-01T09:00:00.000Z" });

  const where = { practiceProfileId: w.practiceA.id };
  const before = await prisma.practiceInboxItem.count({ where });
  const patientBefore = await prisma.patientInboxItem.count({ where: { patientUserId: w.patient.id } });

  await getPracticeNotificationSummary({ practiceProfileId: w.practiceA.id, ...ALLOWED });
  await getPatientNotificationSummary(w.patient.id);

  assert.equal(await prisma.practiceInboxItem.count({ where }), before);
  assert.equal(
    await prisma.patientInboxItem.count({ where: { patientUserId: w.patient.id } }),
    patientBefore,
  );
});

/* ═══════════════════════════════════ H — the follow-up link is the 5B surface */

test("H the follow-up link points at the existing work overview", { skip }, async (t) => {
  const w = await buildWorld(t);
  const s = await getPracticeNotificationSummary({
    practiceProfileId: w.practiceA.id, ...ALLOWED,
  });
  assert.equal(
    s.remindersPath,
    `/practice/patients?practiceId=${encodeURIComponent(w.practiceA.id)}&filter=reminders`,
  );
});

/* ══════════════════════════════════════════════════ I — the two sides never meet */

test("I a patient summary carries no practice fields", { skip }, async (t) => {
  const w = await buildWorld(t);
  await practiceNotice(w, w.a1);
  await createReminder({ ...scope(w.a1, w.ownerA), title: "Rückruf", dueAt: "2026-09-01T09:00:00.000Z" });

  const s = await getPatientNotificationSummary(w.patient.id);
  assert.equal(s.unreadInboxCount, 0);
  assert.equal("newInboxCount" in s, false);
  assert.equal("openReminderCount" in s, false);
  assert.equal("remindersPath" in s, false);
  assert.equal(s.inboxPath, "/patient/inbox");
});

test("I a practice summary carries no patient-side count", { skip }, async (t) => {
  const w = await buildWorld(t);
  await patientNotice(w);

  const s = await getPracticeNotificationSummary({
    practiceProfileId: w.practiceA.id, ...ALLOWED,
  });
  assert.equal("unreadInboxCount" in s, false);
  assert.equal(s.newInboxCount, 0);
});

/* ═══════════════════════════════════════════════ J — the preview is minimal */

test("J a preview item carries no patientUserId and no body", { skip }, async (t) => {
  const w = await buildWorld(t);
  await practiceNotice(w, w.a1, { summary: "Bitte um Rückruf wegen Befund" });
  await patientNotice(w, { summary: "Ihre Praxis hat etwas hinterlegt" });

  const p = await getPracticeNotificationSummary({
    practiceProfileId: w.practiceA.id, ...ALLOWED,
  });
  const item = p.items[0];
  assert.ok(item);
  assert.equal("patientUserId" in item, false);
  assert.equal("summary" in item, false);
  assert.equal("sourceRefId" in item, false);
  assert.equal(JSON.stringify(p).includes(w.patient.id), false);

  const q = await getPatientNotificationSummary(w.patient.id);
  assert.equal("patientUserId" in q.items[0], false);
  assert.equal("summary" in q.items[0], false);
});

test("J the summary itself never emits a stored external target", { skip }, async (t) => {
  const w = await buildWorld(t);
  // A row whose stored destination points off-site — however it got there.
  await practiceNotice(w, w.a1, { targetUrl: "https://evil.example/steal" });

  const s = await getPracticeNotificationSummary({
    practiceProfileId: w.practiceA.id, ...ALLOWED,
  });
  assert.equal(JSON.stringify(s).includes("evil.example"), false);
  assert.equal(
    s.items[0].targetUrl,
    `/practice/patients/${w.a1.id}/messages?practiceId=${w.practiceA.id}`,
  );
});

test("J the patient summary never emits a stored external target", { skip }, async (t) => {
  const w = await buildWorld(t);
  await patientNotice(w, { targetUrl: "https://evil.example/steal", sourceRefType: "system" });

  const s = await getPatientNotificationSummary(w.patient.id);
  assert.equal(JSON.stringify(s).includes("evil.example"), false);
  assert.equal(s.items[0].targetUrl, null);
});

test("J a stored external target is never handed through", { skip }, () => {
  // No link: the stored value is all there is, so it must be validated.
  assert.equal(practiceInboxTargetUrl({ targetUrl: "https://evil.example/x" }), null);
  assert.equal(practiceInboxTargetUrl({ targetUrl: "//evil.example/x" }), null);
  assert.equal(practiceInboxTargetUrl({ targetUrl: "/practice/inbox" }), "/practice/inbox");
});

test("J a link-scoped target is derived from the row's own link", { skip }, () => {
  const url = practiceInboxTargetUrl({
    practicePatientLinkId: "link-1",
    practiceProfileId: "prax-1",
    sourceRefType: "thread",
    // A stale or tampered stored value must not decide where this leads.
    targetUrl: "/practice/patients/SOMEONE-ELSE/messages",
  });
  assert.equal(url, "/practice/patients/link-1/messages?practiceId=prax-1");
});

test("J an unknown link-scoped kind still stays inside its own link", { skip }, () => {
  const url = practiceInboxTargetUrl({
    practicePatientLinkId: "link-1",
    practiceProfileId: "prax-1",
    sourceRefType: "something_new",
    targetUrl: "https://evil.example/x",
  });
  assert.equal(url, "/practice/patients/link-1?practiceId=prax-1");
});

/* ══════════════════════════════════════════════════ preview stays a preview */

test("the preview is capped and the inbox page keeps the paging", { skip }, async (t) => {
  const w = await buildWorld(t);
  for (let i = 0; i < 8; i += 1) await practiceNotice(w, w.a1);

  const s = await getPracticeNotificationSummary({
    practiceProfileId: w.practiceA.id, ...ALLOWED,
  });
  assert.equal(s.newInboxCount, 8);
  assert.equal(s.items.length, 5);
});
