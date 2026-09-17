/**
 * Practice-internal notes and reminders: they belong to ONE care link, and the
 * patient never sees them.
 *
 * The privacy property here is structural, not a filter: no patient route and
 * no export names these tables. Several tests below assert exactly that, by
 * reading the source rather than by trusting a response — a filter can be
 * removed by accident, an absent import cannot.
 *
 * Run: node --test scripts/verifyPracticeInternalWork.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import {
  createInternalNote,
  listInternalNotes,
  updateOwnInternalNote,
} from "../services/practiceInternalWork/internalNoteService.js";
import {
  completeReminder,
  createReminder,
  listReminders,
  resolveAssignee,
} from "../services/practiceInternalWork/reminderService.js";
import {
  INTERNAL_WORK_ERRORS,
  assertUsableDueAt,
  assertUsableNoteBody,
  assertUsableReminderTitle,
} from "../services/practiceInternalWork/internalWorkPolicy.js";
import { PERMISSIONS, PRACTICE_ROLES, hasPracticePermission } from "../utils/practicePermissions.js";
import {
  checkPracticeDeletionBlockers,
  checkPracticePatientLinkDeletionBlockers,
} from "../services/dataLifecycle/contextualPatientDataDeletionGuard.js";

/** Source with comments stripped — these files DESCRIBE what they never do. */
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

let dbAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch {
  dbAvailable = false;
}
const skip = !dbAvailable && "no database reachable";

/* ─────────────────────────────────────────────────────────── the §7 fixture */

/**
 * Practice A with TWO links to the same patient (A1, A2), plus practice B with
 * its own link to the same patient, plus a second patient in practice A.
 */
async function buildWorld(t) {
  const stamp = Date.now() + Math.floor(Math.random() * 1000);
  const mk = async (tag) =>
    prisma.user.create({
      data: {
        email: `iw-${tag}-${stamp}@test.invalid`,
        passwordHash: "x",
        firstName: tag,
        lastName: "Test",
        dateOfBirth: new Date("1980-01-01"),
        verified: true,
      },
    });

  const [ownerA, ownerB, patient1, patient2, staffA] = await Promise.all([
    mk("ownerA"), mk("ownerB"), mk("p1"), mk("p2"), mk("staffA"),
  ]);

  const practiceA = await prisma.practiceProfile.create({
    data: { userId: ownerA.id, practiceName: "PraxisA", publicSlug: `pa-${stamp}`, isActive: true },
  });
  const practiceB = await prisma.practiceProfile.create({
    data: { userId: ownerB.id, practiceName: "PraxisB", publicSlug: `pb-${stamp}`, isActive: true },
  });
  await prisma.practiceMember.create({
    data: { practiceProfileId: practiceA.id, userId: staffA.id, role: "assistant", status: "active" },
  });

  // A second relationship with the SAME practice is not a duplicate row: the
  // schema's unique is (practice, patient, patientProfile), so the product
  // models it as a second patient profile — e.g. a child the account manages.
  // The fixture uses the same shape the E2E fixture does.
  const relative = await prisma.patientProfile.create({
    data: { userId: patient1.id, displayName: "Angehoerige", relationLabel: "child" },
  });

  const link = (practiceId, patientId, patientProfileId = null) =>
    prisma.practicePatientLink.create({
      data: { practiceProfileId: practiceId, patientUserId: patientId, patientProfileId, status: "active" },
    });

  const [a1, a2, b1, aP2] = await Promise.all([
    link(practiceA.id, patient1.id),
    link(practiceA.id, patient1.id, relative.id), // same practice, same person, SECOND relationship
    link(practiceB.id, patient1.id),
    link(practiceA.id, patient2.id),
  ]);

  t.after(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.invalid` } } });
  });

  return { practiceA, practiceB, ownerA, ownerB, staffA, patient1, patient2, a1, a2, b1, aP2 };
}

const noteScope = (w, link, actor) => ({
  linkId: link.id,
  practiceProfileId: link.practiceProfileId,
  actorUserId: actor.id,
});

/* ════════════════════════════════════════════ §7 same practice, other link */

test("a note belongs to ONE link, not to the practice and not to the patient", { skip }, async (t) => {
  const w = await buildWorld(t);

  const n1 = await createInternalNote({ ...noteScope(w, w.a1, w.ownerA), body: "N1 — Rückruf offen" });
  const n2 = await createInternalNote({ ...noteScope(w, w.a2, w.ownerA), body: "N2 — Befund anfordern" });

  const inA1 = await listInternalNotes(noteScope(w, w.a1, w.ownerA));
  const inA2 = await listInternalNotes(noteScope(w, w.a2, w.ownerA));

  assert.deepEqual(inA1.map((n) => n.id), [n1.id], "A1 sees only its own note");
  assert.deepEqual(inA2.map((n) => n.id), [n2.id], "A2 sees only its own note");
  // Same practice, same patient, two relationships — and no leakage either way.
  assert.ok(!JSON.stringify(inA1).includes("Befund anfordern"));
  assert.ok(!JSON.stringify(inA2).includes("Rückruf offen"));
});

test("a reminder belongs to ONE link too", { skip }, async (t) => {
  const w = await buildWorld(t);
  const r1 = await createReminder({
    ...noteScope(w, w.a1, w.ownerA), title: "R1", dueAt: "2026-09-01T09:00:00.000Z",
  });
  await createReminder({
    ...noteScope(w, w.a2, w.ownerA), title: "R2", dueAt: "2026-09-01T09:00:00.000Z",
  });
  const inA1 = await listReminders({ linkId: w.a1.id, practiceProfileId: w.practiceA.id });
  assert.deepEqual(inA1.map((r) => r.id), [r1.id]);
});

/* ══════════════════════════════════════════════════ §8/§9 cross practice/patient */

test("another practice cannot list, read or edit our notes", { skip }, async (t) => {
  const w = await buildWorld(t);
  const mine = await createInternalNote({ ...noteScope(w, w.a1, w.ownerA), body: "nur für Praxis A" });

  // Practice B asking with ITS practice id and OUR link id gets nothing.
  const asB = await listInternalNotes({
    linkId: w.a1.id, practiceProfileId: w.practiceB.id, actorUserId: w.ownerB.id,
  });
  assert.deepEqual(asB, []);

  // ...and cannot edit it even knowing the exact note id.
  await assert.rejects(
    updateOwnInternalNote({
      noteId: mine.id, linkId: w.a1.id, practiceProfileId: w.practiceB.id,
      actorUserId: w.ownerB.id, body: "übernommen",
    }),
    new RegExp(INTERNAL_WORK_ERRORS.NOT_FOUND),
  );

  // The note is untouched.
  const still = await listInternalNotes(noteScope(w, w.a1, w.ownerA));
  assert.equal(still[0].body, "nur für Praxis A");
});

test("a note for one patient never appears on another patient of the same practice", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createInternalNote({ ...noteScope(w, w.a1, w.ownerA), body: "zu Patient 1" });
  const otherPatient = await listInternalNotes(noteScope(w, w.aP2, w.ownerA));
  assert.deepEqual(otherPatient, []);
});

test("a foreign note id is not found rather than refused", { skip }, async (t) => {
  const w = await buildWorld(t);
  const foreign = await createInternalNote({ ...noteScope(w, w.a2, w.ownerA), body: "A2" });
  await assert.rejects(
    updateOwnInternalNote({
      noteId: foreign.id, linkId: w.a1.id, practiceProfileId: w.practiceA.id,
      actorUserId: w.ownerA.id, body: "x",
    }),
    new RegExp(INTERNAL_WORK_ERRORS.NOT_FOUND),
  );
});

test("completing a reminder is bounded by its link", { skip }, async (t) => {
  const w = await buildWorld(t);
  const r = await createReminder({
    ...noteScope(w, w.a2, w.ownerA), title: "gehört zu A2", dueAt: "2026-09-01T09:00:00.000Z",
  });
  // Right practice, WRONG link.
  await assert.rejects(
    completeReminder({
      reminderId: r.id, linkId: w.a1.id, practiceProfileId: w.practiceA.id, actorUserId: w.ownerA.id,
    }),
    new RegExp(INTERNAL_WORK_ERRORS.NOT_FOUND),
  );
  // Foreign practice.
  await assert.rejects(
    completeReminder({
      reminderId: r.id, linkId: w.a2.id, practiceProfileId: w.practiceB.id, actorUserId: w.ownerB.id,
    }),
    new RegExp(INTERNAL_WORK_ERRORS.NOT_FOUND),
  );
  // Own scope works, and twice is a conflict rather than a silent rewrite.
  const done = await completeReminder({
    reminderId: r.id, linkId: w.a2.id, practiceProfileId: w.practiceA.id, actorUserId: w.ownerA.id,
  });
  assert.ok(done.completedAt);
  await assert.rejects(
    completeReminder({
      reminderId: r.id, linkId: w.a2.id, practiceProfileId: w.practiceA.id, actorUserId: w.ownerA.id,
    }),
    new RegExp(INTERNAL_WORK_ERRORS.ALREADY_COMPLETED),
  );
});

/* ═══════════════════════════════════════════════════ authorship and editing */

test("only the author may edit their own note", { skip }, async (t) => {
  const w = await buildWorld(t);
  const note = await createInternalNote({ ...noteScope(w, w.a1, w.ownerA), body: "vom Inhaber" });

  // A colleague of the SAME practice with the same permission still cannot.
  await assert.rejects(
    updateOwnInternalNote({
      noteId: note.id, linkId: w.a1.id, practiceProfileId: w.practiceA.id,
      actorUserId: w.staffA.id, body: "fremd geändert",
    }),
    new RegExp(INTERNAL_WORK_ERRORS.NOT_FOUND),
  );

  const edited = await updateOwnInternalNote({
    noteId: note.id, linkId: w.a1.id, practiceProfileId: w.practiceA.id,
    actorUserId: w.ownerA.id, body: "vom Inhaber, korrigiert",
  });
  assert.equal(edited.body, "vom Inhaber, korrigiert");
  assert.ok(edited.editedAt, "an edit is marked as such");
});

test("the list says who wrote a note, by name, and never by user id", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createInternalNote({ ...noteScope(w, w.a1, w.staffA), body: "von der Assistenz" });
  const [note] = await listInternalNotes(noteScope(w, w.a1, w.ownerA));

  assert.equal(note.authorName, "staffA Test");
  const dumped = JSON.stringify(note);
  assert.ok(!dumped.includes(w.staffA.id), "no raw user id reaches the client");
  assert.ok(!dumped.includes(w.practiceA.id), "no tenant id either");
  assert.ok(!dumped.includes(w.a1.id), "and no link id");
  assert.equal(note.canEdit, false, "the owner may not edit the assistant's note");
});

/* ══════════════════════════════════════════════════════════ §26 assignment */

test("a reminder may only be assigned inside the same practice", { skip }, async (t) => {
  const w = await buildWorld(t);

  const ok = await createReminder({
    ...noteScope(w, w.a1, w.ownerA), title: "an die Assistenz",
    dueAt: "2026-09-01T09:00:00.000Z", assignedToUserId: w.staffA.id,
  });
  assert.equal(ok.assignedToName, "staffA Test");

  // Another practice's owner is not assignable...
  await assert.rejects(
    createReminder({
      ...noteScope(w, w.a1, w.ownerA), title: "fremd",
      dueAt: "2026-09-01T09:00:00.000Z", assignedToUserId: w.ownerB.id,
    }),
    new RegExp(INTERNAL_WORK_ERRORS.ASSIGNEE_NOT_IN_PRACTICE),
  );
  // ...and neither is the patient.
  await assert.rejects(
    resolveAssignee(w.patient1.id, w.practiceA.id),
    new RegExp(INTERNAL_WORK_ERRORS.ASSIGNEE_NOT_IN_PRACTICE),
  );
});

/* ══════════════════════════════════════════════════════════════ §45 payload */

test("payload rules", () => {
  assert.throws(() => assertUsableNoteBody("   "), /body_required/);
  assert.throws(() => assertUsableNoteBody("x".repeat(4001)), /body_too_long/);
  assert.throws(() => assertUsableReminderTitle(""), /title_required/);
  assert.throws(() => assertUsableDueAt("übermorgen"), /due_at_invalid/);
  assert.throws(() => assertUsableDueAt(null), /due_at_required/);
  assert.throws(() => assertUsableDueAt("2999-01-01"), /due_at_out_of_range/);
  // A date in the past is deliberately allowed: catching up on Tuesday about
  // Monday is ordinary work and no existing rule forbids it.
  assert.ok(assertUsableDueAt("2020-01-01") instanceof Date);
});

/* ═══════════════════════════════════ §5/§16/§28/§36/§37 the patient boundary */

test("no patient-facing source file names the internal tables", async () => {
  const patientSurfaces = [
    "routes/patientThreads.js",
    "routes/patientErezept.js",
    "routes/account.js",
    "services/communication/practicePatientThreadService.js",
    "services/export/exportJobService.js",
  ];
  for (const file of patientSurfaces) {
    let src;
    try {
      src = code(await readFile(new URL(`../${file}`, import.meta.url), "utf8"));
    } catch {
      continue; // a surface that does not exist cannot leak
    }
    for (const table of ["practicePatientInternalNote", "practicePatientReminder",
                         "InternalNote", "PatientReminder"]) {
      assert.ok(
        !src.includes(table),
        `${file} must not reach the practice-internal tables (${table})`,
      );
    }
  }
});

test("no route outside /api/practice touches the internal services", async () => {
  const dir = new URL("../routes/", import.meta.url);
  const offenders = [];
  for (const name of await readdir(dir)) {
    if (!name.endsWith(".js") || name === "practiceInternalWork.js") continue;
    const src = code(await readFile(new URL(name, dir), "utf8"));
    if (/practiceInternalWork\/(internalNoteService|reminderService)/.test(src)) {
      offenders.push(name);
    }
  }
  assert.deepEqual(offenders, [], `these routes import the internal services: ${offenders}`);
});

test("creating a note or a reminder writes nothing else", { skip }, async (t) => {
  const w = await buildWorld(t);

  const before = {
    patientInbox: await prisma.patientInboxItem.count({ where: { patientUserId: w.patient1.id } }),
    practiceInbox: await prisma.practiceInboxItem.count({ where: { practiceProfileId: w.practiceA.id } }),
    threads: await prisma.practicePatientThread.count({ where: { practicePatientLinkId: w.a1.id } }),
    // Scoped to THIS link: a global count would drift whenever another test
    // in the suite writes a message, which says nothing about internal work.
    messages: await prisma.practicePatientMessage.count({
      where: { thread: { practicePatientLinkId: w.a1.id } },
    }),
  };

  await createInternalNote({ ...noteScope(w, w.a1, w.ownerA), body: "keine Nachricht" });
  const r = await createReminder({
    ...noteScope(w, w.a1, w.ownerA), title: "morgen anrufen", dueAt: "2026-09-01T09:00:00.000Z",
  });
  await completeReminder({
    reminderId: r.id, linkId: w.a1.id, practiceProfileId: w.practiceA.id, actorUserId: w.ownerA.id,
  });

  const after = {
    patientInbox: await prisma.patientInboxItem.count({ where: { patientUserId: w.patient1.id } }),
    practiceInbox: await prisma.practiceInboxItem.count({ where: { practiceProfileId: w.practiceA.id } }),
    threads: await prisma.practicePatientThread.count({ where: { practicePatientLinkId: w.a1.id } }),
    // Scoped to THIS link: a global count would drift whenever another test
    // in the suite writes a message, which says nothing about internal work.
    messages: await prisma.practicePatientMessage.count({
      where: { thread: { practicePatientLinkId: w.a1.id } },
    }),
  };

  assert.deepEqual(after, before, "internal work must not create inbox items, threads or messages");
});

/* ═══════════════════════════════════════════════ §14/§15 no provider contact */

test("no translation or speech provider is reachable from internal work", async () => {
  for (const file of [
    "../services/practiceInternalWork/internalNoteService.js",
    "../services/practiceInternalWork/reminderService.js",
    "../services/practiceInternalWork/internalWorkPolicy.js",
    "../routes/practiceInternalWork.js",
  ]) {
    const src = code(await readFile(new URL(file, import.meta.url), "utf8"));
    for (const forbidden = ["messageTranslation", "messageSpeech", "symptomVoice",
                            "preVisitVoice", "speechOutput", "openaiClient",
                            "OPENAI_API_KEY", "fetch("][Symbol.iterator]();;) {
      const { value, done } = forbidden.next();
      if (done) break;
      assert.ok(!src.includes(value), `${file} must not reach ${value}`);
    }
  }
});

/* ═════════════════════════════════════════════════════════ §10 the matrix */

test("the permission matrix is explicit, and viewer holds none of it", () => {
  const expected = {
    owner: true, admin: true, doctor: true, secretary: true,
    assistant: true, practice_manager: true, viewer: false,
  };
  for (const role of PRACTICE_ROLES) {
    for (const perm of [
      PERMISSIONS.INTERNAL_NOTES_READ, PERMISSIONS.INTERNAL_NOTES_WRITE,
      PERMISSIONS.REMINDERS_READ, PERMISSIONS.REMINDERS_WRITE,
    ]) {
      assert.equal(
        hasPracticePermission(role, perm), expected[role],
        `${role} / ${perm}`,
      );
    }
  }
  // And the new permissions are their own, not aliases of messaging or inbox.
  assert.notEqual(PERMISSIONS.INTERNAL_NOTES_WRITE, PERMISSIONS.MESSAGES_SEND);
  assert.notEqual(PERMISSIONS.REMINDERS_WRITE, PERMISSIONS.INBOX_MANAGE);
});

test("the route requires the internal permissions, not messaging ones", async () => {
  const src = code(await readFile(new URL("../routes/practiceInternalWork.js", import.meta.url), "utf8"));
  assert.ok(src.includes("PERMISSIONS.INTERNAL_NOTES_READ"));
  assert.ok(src.includes("PERMISSIONS.INTERNAL_NOTES_WRITE"));
  assert.ok(src.includes("PERMISSIONS.REMINDERS_READ"));
  assert.ok(src.includes("PERMISSIONS.REMINDERS_WRITE"));
  assert.ok(!src.includes("PERMISSIONS.MESSAGES_SEND"), "messaging permission must not stand in");
  assert.ok(!src.includes("PERMISSIONS.INBOX_MANAGE"), "inbox permission must not stand in");
  // The link guard, not a hand-rolled membership check.
  assert.ok(src.includes("requirePracticePatientLinkAccess"));
  assert.ok(!/req\.params\.linkId/.test(src.replace(/req\.params\.noteId|req\.params\.reminderId/g, "")),
    "handlers must use the server-derived linkId");
});

/* ══════════════════════════════════════════════ lifecycle: a chosen semantics

   Under the current MedScoutX lifecycle classification these two models are
   practice-internal relational working objects. They therefore follow the
   existing PracticePatientAssignment pattern — ON DELETE CASCADE, and outside
   the clinical deletion guard, which covers patient-owned clinical records and
   practice-issued clinical artifacts.

   This is a technical classification. It carries no statement about retention
   obligations or about what anyone may request by any other route.

   The tests below exist so the classification is a decision on record rather
   than an accident: if someone later moves these models to RESTRICT and adds
   them to the guard, these two tests fail and force the choice to be made
   deliberately.                                                              */

test("the clinical deletion guard deliberately does not cover internal work", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createInternalNote({ ...noteScope(w, w.a1, w.ownerA), body: "Arbeitsnotiz" });
  await createReminder({
    ...noteScope(w, w.a1, w.ownerA), title: "Wiedervorlage", dueAt: "2026-09-01T09:00:00.000Z",
  });

  // The guard protects clinical records. An internal note is not one, so it
  // must not start blocking practice or link deletion.
  const onPractice = await checkPracticeDeletionBlockers(w.practiceA.id);
  const onLink = await checkPracticePatientLinkDeletionBlockers(w.a1.id);

  assert.equal(onPractice.blocked, false);
  assert.equal(onLink.blocked, false);
  assert.ok(!onPractice.categories.includes("internal_notes"));
  assert.ok(!onLink.categories.includes("reminders"));
});

test("deleting the care link takes its internal work with it, by design", { skip }, async (t) => {
  const w = await buildWorld(t);
  await createInternalNote({ ...noteScope(w, w.a2, w.ownerA), body: "gehört zu A2" });
  await createReminder({
    ...noteScope(w, w.a2, w.ownerA), title: "A2", dueAt: "2026-09-01T09:00:00.000Z",
  });

  const scoped = { practicePatientLinkId: w.a2.id };
  assert.equal(await prisma.practicePatientInternalNote.count({ where: scoped }), 1);
  assert.equal(await prisma.practicePatientReminder.count({ where: scoped }), 1);

  // No route hard-deletes a care link — links are revoked or archived by
  // status. This exercises the database rule directly, so the chosen cascade
  // is recorded rather than assumed.
  await prisma.practicePatientLink.delete({ where: { id: w.a2.id } });

  assert.equal(await prisma.practicePatientInternalNote.count({ where: scoped }), 0);
  assert.equal(await prisma.practicePatientReminder.count({ where: scoped }), 0);

  // The OTHER relationship of the same practice is untouched.
  const survivors = await listInternalNotes(noteScope(w, w.a1, w.ownerA));
  assert.deepEqual(survivors, []);
  assert.ok(await prisma.practicePatientLink.findUnique({ where: { id: w.a1.id } }));
});

/* ═════════════════════════════════════════════════════════════ §35 logging */

test("nothing logs a note body or a reminder title", async () => {
  const src = await readFile(new URL("../routes/practiceInternalWork.js", import.meta.url), "utf8");
  const calls = [...code(src).matchAll(/console\.(error|warn|log|info)\(([^;]*)\);/g)];
  assert.ok(calls.length > 0, "the route should log failures at all");
  for (const [, , args] of calls) {
    for (const forbidden of ["body", "title", "note.", "reminder.", "patientUserId"]) {
      assert.ok(!args.includes(forbidden), `must not log ${forbidden}: ${args.trim()}`);
    }
  }
});
