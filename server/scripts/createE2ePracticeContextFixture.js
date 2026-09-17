#!/usr/bin/env node
/**
 * E2E fixture for the practice-context isolation test (Phase 2C).
 *
 * Creates one patient connected to TWO practices, each with its own permanent
 * communication channel carrying a unique marker message:
 *
 *   Patient P ── link A ──> Practice A (Hausarzt)     "A_ONLY_MARKER"
 *            └── link B ──> Practice B (Kardiologie)  "B_ONLY_MARKER"
 *
 * The markers exist so a browser test can assert that a marker from one context
 * is absent from the other. They are TEST DATA only and carry no medical
 * content.
 *
 * Idempotent: re-running reuses the fixture instead of duplicating it. All rows
 * are marked with the E2E e-mail domain so --cleanup can remove exactly them.
 *
 * Usage (from server/):
 *   node scripts/createE2ePracticeContextFixture.js
 *   node scripts/createE2ePracticeContextFixture.js --cleanup
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PATIENT_EMAIL = "e2e-practice-context-patient@test.invalid";
const OWNER_A_EMAIL = "e2e-practice-context-owner-a@test.invalid";
const OWNER_B_EMAIL = "e2e-practice-context-owner-b@test.invalid";
const PASSWORD = "E2ePracticeContext!23";

const MARKER_A = "A_ONLY_MARKER";
/*
 * Phase 3A — a conversation long enough to page through.
 *
 * Seeded on link A2, which had no channel of its own: the A and B channels
 * carry the isolation markers, and pushing them out of the newest page would
 * silently retire those tests instead of extending them.
 */
const TL_COUNT = 62;
const TL_BODY = (i) => `TL_${String(i).padStart(4, "0")}`;
const TL_OWN_READ = "TL_OWN_READ";
const TL_OWN_SENT = "TL_OWN_SENT";
const APPT_MARKER_A = "A_APPOINTMENT_MARKER";
const APPT_MARKER_B = "B_APPOINTMENT_MARKER";
const DOC_MARKER_A = "A_DIRECT_DOCUMENT";
const DOC_MARKER_B = "B_DIRECT_DOCUMENT";
const DOC_MARKER_SHARED = "A_SHARED_TO_B";
const DOC_MARKER_PRIVATE = "A_PRIVATE_DOCUMENT";
const MED_MARKER_A = "A_MED_PLAN_MARKER";
const MED_MARKER_B = "B_MED_PLAN_MARKER";
const MED_MARKER_A2 = "A1_PLAN_MARKER";
const ERX_MARKER_A = "A_ERX_MARKER";
const ERX_MARKER_B = "B_ERX_MARKER";
const ERX_MARKER_A2 = "A1_ERX_MARKER";
const INBOX_MARKER_A = "A_INBOX_MARKER";
const INBOX_MARKER_A_DOC = "A_INBOX_DOC_MARKER";
const INBOX_MARKER_B = "B_INBOX_MARKER";
const INBOX_MARKER_A2 = "A2_INBOX_MARKER";
const INBOX_MARKER_PRACTICE_ONLY = "A_INBOX_PRACTICE_ONLY";
const TELE_MARKER_A = "A_TELE_MARKER";
const TELE_MARKER_B = "B_TELE_MARKER";
const TELE_MARKER_A2 = "A2_TELE_MARKER";
const TELE_MARKER_LINKLESS = "A_TELE_LINKLESS";
// Phase 2F.3B gave ErezeptEntry.linkId a real foreign key, so a row naming a
// link that does not exist can no longer be created at all. The invariant moved
// from "the UI never shows it" to "the database never accepts it" and is
// asserted in verifyErezeptContextIsolation.test.js.
const MARKER_B = "B_ONLY_MARKER";

const CONSENT_SCOPES = ["messages", "profile"];
const CONSENT_VERSION = "phase1-care-v1";

async function upsertUser(email, firstName, lastName) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      dateOfBirth: new Date("1980-01-01"),
      verified: true,
    },
  });
}

async function upsertPractice(ownerUserId, practiceName, slug, specialty, city) {
  const existing = await prisma.practiceProfile.findFirst({
    where: { userId: ownerUserId, practiceName },
  });
  if (existing) {
    return prisma.practiceProfile.update({
      where: { id: existing.id },
      data: { specialty, city },
    });
  }
  return prisma.practiceProfile.create({
    data: { userId: ownerUserId, practiceName, publicSlug: slug, specialty, city },
  });
}

/**
 * The account holder's OWN relationship with a practice.
 *
 * `patientProfileId: null` is part of the lookup, not an afterthought: since the
 * fixture also builds a second link to practice A for a family profile, a search
 * by (practice, patient) alone matches two rows and findFirst may return either.
 * That is the same ambiguity Phase 2F.0 addressed in the UI — and it silently
 * moved this fixture's documents onto the wrong link until it was pinned here.
 */
async function upsertLink(practiceProfileId, patientUserId) {
  const existing = await prisma.practicePatientLink.findFirst({
    where: { practiceProfileId, patientUserId, patientProfileId: null },
  });
  if (existing) {
    return prisma.practicePatientLink.update({
      where: { id: existing.id },
      data: {
        status: "active",
        consentScopes: CONSENT_SCOPES,
        consentVersion: CONSENT_VERSION,
        consentAcceptedAt: new Date(),
      },
    });
  }
  return prisma.practicePatientLink.create({
    data: {
      practiceProfileId,
      patientUserId,
      status: "active",
      consentScopes: CONSENT_SCOPES,
      consentVersion: CONSENT_VERSION,
      consentAcceptedAt: new Date(),
    },
  });
}

/** One channel per link — the Phase 2A invariant, honoured here too. */
async function upsertChannelWithMarker(link, senderUserId, marker) {
  let channel = await prisma.practicePatientThread.findUnique({
    where: { practicePatientLinkId: link.id },
  });
  if (!channel) {
    channel = await prisma.practicePatientThread.create({
      data: {
        practicePatientLinkId: link.id,
        practiceProfileId: link.practiceProfileId,
        patientUserId: link.patientUserId,
        status: "open",
        updatedAt: new Date(),
      },
    });
  }
  const existing = await prisma.practicePatientMessage.findFirst({
    where: { threadId: channel.id, body: marker },
  });
  if (!existing) {
    await prisma.practicePatientMessage.create({
      data: {
        threadId: channel.id,
        senderType: "practice",
        senderUserId,
        body: marker,
      },
    });
  }
  return channel;
}

/**
 * A marker means "only this context may show it", so a copy of it sitting in
 * another context's channel makes every assertion built on it vacuous.
 *
 * Such copies exist: an earlier version of this fixture resolved a link without
 * its patient profile and wrote into the wrong one. The fixture is the
 * authority on its own markers, so it puts that right rather than leaving tests
 * to pass for the wrong reason. Only the misplaced marker rows are removed, and
 * what was removed is printed.
 */
async function pruneMisplacedMarkers(channelsByMarker) {
  for (const [marker, channelId] of Object.entries(channelsByMarker)) {
    const stray = await prisma.practicePatientMessage.findMany({
      where: { body: marker, threadId: { not: channelId } },
      select: { id: true, threadId: true },
    });
    if (stray.length === 0) continue;
    await prisma.practicePatientMessage.deleteMany({
      where: { id: { in: stray.map((m) => m.id) } },
    });
    for (const m of stray) {
      console.log(`[fixture] removed misplaced ${marker} from thread ${m.threadId}`);
    }
  }
}

/**
 * A conversation with more messages than one page holds.
 *
 * Timestamps are explicit and one minute apart, so the total order is the same
 * on every machine and "the newest fifty" means the same thing every run.
 * Written oldest-first; the two own messages sit at the newest end, one already
 * read by the practice and one not, so both message states are on screen
 * without the test having to send anything.
 */
async function upsertLongTimeline(link, practiceUserId) {
  let channel = await prisma.practicePatientThread.findUnique({
    where: { practicePatientLinkId: link.id },
  });
  if (!channel) {
    channel = await prisma.practicePatientThread.create({
      data: {
        practicePatientLinkId: link.id,
        practiceProfileId: link.practiceProfileId,
        patientUserId: link.patientUserId,
        status: "open",
        updatedAt: new Date(),
      },
    });
  }

  const already = await prisma.practicePatientMessage.count({ where: { threadId: channel.id } });
  if (already >= TL_COUNT + 2) return channel;

  // Anchored in the past so the seeded run never overtakes the wall clock.
  const base = new Date("2026-08-01T08:00:00.000Z").getTime();
  const at = (i) => new Date(base + i * 60_000);

  for (let i = 1; i <= TL_COUNT; i += 1) {
    const body = TL_BODY(i);
    const existing = await prisma.practicePatientMessage.findFirst({
      where: { threadId: channel.id, body },
    });
    if (existing) continue;
    await prisma.practicePatientMessage.create({
      data: {
        threadId: channel.id,
        senderType: "practice",
        senderUserId: practiceUserId,
        body,
        createdAt: at(i),
      },
    });
  }

  // The patient's own two, newest of all.
  const own = [
    { body: TL_OWN_READ, readAt: at(TL_COUNT + 10) },
    { body: TL_OWN_SENT, readAt: null },
  ];
  for (const [n, o] of own.entries()) {
    const existing = await prisma.practicePatientMessage.findFirst({
      where: { threadId: channel.id, body: o.body },
    });
    if (existing) continue;
    await prisma.practicePatientMessage.create({
      data: {
        threadId: channel.id,
        senderType: "patient",
        senderUserId: link.patientUserId,
        body: o.body,
        createdAt: at(TL_COUNT + 1 + n),
        readAt: o.readAt,
      },
    });
  }
  return channel;
}

/** One appointment per relationship, each with a marker only that context may show. */
async function upsertAppointmentWithMarker(link, title, dayOffset) {
  const existing = await prisma.practiceAppointment.findFirst({
    where: { practicePatientLinkId: link.id, title },
  });
  if (existing) return existing;

  const startAt = new Date(Date.now() + dayOffset * 24 * 3600 * 1000);
  const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
  return prisma.practiceAppointment.create({
    data: {
      practiceProfileId: link.practiceProfileId,
      practicePatientLinkId: link.id,
      patientUserId: link.patientUserId,
      title,
      status: "scheduled",
      startAt,
      endAt,
      locationType: "practice",
    },
  });
}

/**
 * A document released to the patient inside ONE link.
 *
 * `PracticeDocumentShare` is what makes a document visible to the patient at
 * all; without it the row is still a practice draft. The file row carries no
 * real bytes — the E2E scenarios assert visibility and refusal, and a download
 * that reaches storage is covered by the server suite instead.
 */
async function upsertDocumentWithMarker(link, title) {
  // Same reasoning as the medication markers.
  const strays = await prisma.practiceDocument.findMany({
    where: { title, practicePatientLinkId: { not: link.id } },
    select: { id: true },
  });
  if (strays.length) {
    const ids = strays.map((d) => d.id);
    // Grants use onDelete: Restrict, so they go first.
    await prisma.practiceDocumentShareGrant.deleteMany({ where: { documentId: { in: ids } } });
    await prisma.practiceDocument.deleteMany({ where: { id: { in: ids } } });
  }

  const existing = await prisma.practiceDocument.findFirst({
    where: { practicePatientLinkId: link.id, title },
    include: { files: true },
  });
  if (existing) return existing;

  const doc = await prisma.practiceDocument.create({
    data: {
      practiceProfileId: link.practiceProfileId,
      practicePatientLinkId: link.id,
      patientUserId: link.patientUserId,
      title,
      type: "report",
      status: "shared",
      sharedAt: new Date(),
    },
  });
  await prisma.practiceDocumentFile.create({
    data: {
      documentId: doc.id,
      originalFileName: `${title}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1024,
      storageKey: `e2e/${doc.id}`,
    },
  });
  await prisma.practiceDocumentShare.create({
    data: {
      documentId: doc.id,
      patientUserId: link.patientUserId,
      status: "active",
      sharedAt: new Date(),
    },
  });
  return doc;
}

/** The patient releases one of practice A's documents INTO practice B. */
async function upsertGrant(document, sourceLink, targetLink) {
  // A partial unique index allows only ONE active grant per
  // (documentId, targetPracticePatientLinkId); revoked rows accumulate beside
  // it. So the question is not "does a grant exist" but "is one active" —
  // reviving an old revoked row while another is active violates that index.
  const active = await prisma.practiceDocumentShareGrant.findFirst({
    where: {
      documentId: document.id,
      targetPracticePatientLinkId: targetLink.id,
      status: "active",
    },
  });
  if (active) return active;
  return prisma.practiceDocumentShareGrant.create({
    data: {
      documentId: document.id,
      patientUserId: sourceLink.patientUserId,
      sourcePracticeProfileId: sourceLink.practiceProfileId,
      sourcePracticePatientLinkId: sourceLink.id,
      targetPracticeProfileId: targetLink.practiceProfileId,
      targetPracticePatientLinkId: targetLink.id,
      status: "active",
      grantedByUserId: sourceLink.patientUserId,
      grantedAt: new Date(),
    },
  });
}

/**
 * A published medication plan with one item, bound to exactly one link.
 *
 * The drug name repeats the marker so a browser assertion can tell the plans
 * apart by content, not only by title — a page that rendered the right heading
 * over the wrong medication would otherwise pass.
 */
async function upsertMedicationPlanWithMarker(link, title) {
  // A marker belongs to exactly ONE link. Rows carrying it anywhere else are
  // leftovers from an interrupted run, and they would make an isolation test
  // fail for a reason that has nothing to do with the code — so the fixture
  // removes them rather than leaving a false alarm lying around. Marker titles
  // are fixture-only, so nothing real is touched.
  await prisma.medicationPlan.deleteMany({
    where: { title, practicePatientLinkId: { not: link.id } },
  });

  const existing = await prisma.medicationPlan.findFirst({
    where: { practicePatientLinkId: link.id, title },
  });
  if (existing) return existing;

  const plan = await prisma.medicationPlan.create({
    data: {
      practicePatientLinkId: link.id,
      practiceProfileId: link.practiceProfileId,
      patientUserId: link.patientUserId,
      title,
      status: "published",
      publishedAt: new Date(),
    },
  });
  await prisma.medicationPlanItem.create({
    data: {
      medicationPlanId: plan.id,
      medicationName: `${title}_DRUG`,
      dosage: "1-0-1",
      frequency: "taeglich",
      sortOrder: 0,
    },
  });
  return plan;
}

/**
 * A SECOND link between the same patient and practice A.
 *
 * Permitted because the uniqueness key is
 * (practiceProfileId, patientUserId, patientProfileId). It exists so the
 * browser can be pointed at the one case where "scoped by practice" and
 * "scoped by link" disagree.
 */
async function upsertSecondLinkToPracticeA(practiceA, patient) {
  let profile = await prisma.patientProfile.findFirst({
    where: { userId: patient.id, displayName: "E2E Angehoerige" },
  });
  if (!profile) {
    profile = await prisma.patientProfile.create({
      data: {
        userId: patient.id,
        displayName: "E2E Angehoerige",
        relationLabel: "child",
      },
    });
  }
  const existing = await prisma.practicePatientLink.findFirst({
    where: {
      practiceProfileId: practiceA.id,
      patientUserId: patient.id,
      patientProfileId: profile.id,
    },
  });
  if (existing) return existing;
  return prisma.practicePatientLink.create({
    data: {
      practiceProfileId: practiceA.id,
      patientUserId: patient.id,
      patientProfileId: profile.id,
      status: "active",
      consentScopes: ["medication"],
      consentAcceptedAt: new Date(),
    },
  });
}

/**
 * An e-prescription bound to one link.
 *
 * `ErezeptEntry.linkId` has no foreign key, which is exactly why the fixture
 * can — and does — plant one pointing at nothing: the browser has to prove that
 * such a row surfaces in no context at all.
 */
async function upsertErezeptWithMarker(linkId, patientUserId, issuedByUserId, name) {
  // Same reasoning as the medication markers above.
  await prisma.erezeptEntry.deleteMany({
    where: { medicationName: name, linkId: { not: linkId } },
  });

  const existing = await prisma.erezeptEntry.findFirst({
    where: { medicationName: name, patientUserId },
  });
  if (existing) {
    // Reset rather than keep: a patient status change is a one-way transition,
    // so a browser test that exercises it would only work on the very first
    // run. A fixture establishes a known state; it does not merely ensure a row
    // exists somewhere in some state.
    return prisma.erezeptEntry.update({
      where: { id: existing.id },
      data: {
        linkId,
        status: "issued",
        redeemedAt: null,
        validUntil: new Date(Date.now() + 28 * 24 * 3600 * 1000),
      },
    });
  }

  return prisma.erezeptEntry.create({
    data: {
      patientUserId,
      issuedByUserId,
      linkId,
      medicationName: name,
      tokenCode: `ERZ-${name}`,
      status: "issued",
      validUntil: new Date(Date.now() + 28 * 24 * 3600 * 1000),
    },
  });
}

/**
 * One inbox notice.
 *
 * `practicePatientLinkId` is nullable in the model, so the fixture also plants
 * a notice that names a practice but NO relationship — the case no context may
 * claim. Titles are neutral by design; the inbox never carries a message body,
 * a dosage or a document's contents.
 */
async function upsertInboxItemWithMarker(opts) {
  const marker = opts.title;
  // A marker belongs to exactly one relationship; leftovers elsewhere would
  // make an isolation test fail for a reason unrelated to the code.
  await prisma.patientInboxItem.deleteMany({
    where: { title: marker, NOT: { practicePatientLinkId: opts.linkId ?? null } },
  });

  const existing = await prisma.patientInboxItem.findFirst({ where: { title: marker } });
  if (existing) {
    return prisma.patientInboxItem.update({
      where: { id: existing.id },
      data: {
        status: "unread",
        readAt: null,
        archivedAt: null,
        lastActivityAt: new Date(),
        practicePatientLinkId: opts.linkId ?? null,
        summary: marker,
      },
    });
  }

  return prisma.patientInboxItem.create({
    data: {
      patientUserId: opts.patientUserId,
      practiceProfileId: opts.practiceProfileId,
      practicePatientLinkId: opts.linkId ?? null,
      type: opts.type ?? "message",
      title: marker,
      titleKey: opts.type ?? "message",
      // The page renders the neutral catalogue title for a known titleKey, so
      // `title` never reaches the screen. The marker goes into `summary`, which
      // IS rendered — otherwise a browser assertion on it would pass or fail for
      // reasons unrelated to what is on the page.
      summary: marker,
      status: "unread",
      sourceRefType: opts.sourceRefType ?? "patient_thread",
      sourceRefId: `e2e-${marker}`,
      dedupeKey: `e2e-inbox:${marker}`,
      lastActivityAt: new Date(),
    },
  });
}

/**
 * One video consultation.
 *
 * `practicePatientLinkId` is nullable by design, so the fixture also plants a
 * session that names the practice and this patient but NO relationship — the
 * legitimate case that must stay outside every context.
 *
 * `providerRoomId` carries a recognisable secret so a browser test can prove it
 * never appears in a list: for the sandbox provider the meeting URL is derived
 * from it alone.
 */
async function upsertTelemedicineWithMarker(opts) {
  const marker = opts.title;
  await prisma.telemedicineSession.deleteMany({
    where: { title: marker, NOT: { practicePatientLinkId: opts.linkId ?? null } },
  });

  const existing = await prisma.telemedicineSession.findFirst({ where: { title: marker } });
  if (existing) {
    return prisma.telemedicineSession.update({
      where: { id: existing.id },
      data: {
        practicePatientLinkId: opts.linkId ?? null,
        status: "planned",
        consentAcceptedAt: null,
        linkRevokedAt: null,
        scheduledStartAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
  }

  return prisma.telemedicineSession.create({
    data: {
      practiceProfileId: opts.practiceProfileId,
      practicePatientLinkId: opts.linkId ?? null,
      patientUserId: opts.patientUserId,
      providerType: "sandbox",
      status: "planned",
      title: marker,
      scheduledStartAt: new Date(Date.now() + 24 * 3600 * 1000),
      joinUrlHash: `jh-${marker}`,
      hostUrlHash: `hh-${marker}`,
      providerRoomId: `msx-roomsecret-${marker}`,
      consentVersion: "1",
    },
  });
}

async function cleanup() {
  const emails = [PATIENT_EMAIL, OWNER_A_EMAIL, OWNER_B_EMAIL];
  const users = await prisma.user.findMany({ where: { email: { in: emails } } });
  if (!users.length) {
    console.log("Nothing to clean up.");
    return;
  }
  const ids = users.map((u) => u.id);
  // Share grants use onDelete: Restrict, so they cannot ride the cascade.
  await prisma.practiceDocumentShareGrant.deleteMany({ where: { patientUserId: { in: ids } } });
  // Cascades remove practices, links, threads, messages and documents.
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`Removed ${users.length} fixture user(s) and their data.`);
}

async function main() {
  if (process.argv.includes("--cleanup")) return cleanup();

  const patient = await upsertUser(PATIENT_EMAIL, "Ella", "Testpatientin");
  const ownerA = await upsertUser(OWNER_A_EMAIL, "Owner", "Hausarzt");
  const ownerB = await upsertUser(OWNER_B_EMAIL, "Owner", "Kardiologie");

  const practiceA = await upsertPractice(ownerA.id, "Hausarztpraxis Henkel", "e2e-hausarzt", "Allgemeinmedizin", "Düsseldorf");
  const practiceB = await upsertPractice(ownerB.id, "Kardiologie Benrath", "e2e-kardiologie", "Kardiologie", "Düsseldorf");

  const linkA = await upsertLink(practiceA.id, patient.id);
  const linkB = await upsertLink(practiceB.id, patient.id);

  const channelA = await upsertChannelWithMarker(linkA, ownerA.id, MARKER_A);
  // Re-runs start from an unread state so badges and read-acknowledge are
  // exercised rather than skipped by leftovers from a previous run.
  await prisma.practicePatientMessage.updateMany({
    where: { senderType: "practice", thread: { patientUserId: patient.id } },
    data: { readAt: null },
  });
  const channelB = await upsertChannelWithMarker(linkB, ownerB.id, MARKER_B);
  await pruneMisplacedMarkers({ [MARKER_A]: channelA.id, [MARKER_B]: channelB.id });

  await upsertAppointmentWithMarker(linkA, APPT_MARKER_A, 7);
  await upsertAppointmentWithMarker(linkB, APPT_MARKER_B, 9);

  await upsertDocumentWithMarker(linkA, DOC_MARKER_A);
  await upsertDocumentWithMarker(linkB, DOC_MARKER_B);
  // Released into B by the patient — the SHARED class.
  const shared = await upsertDocumentWithMarker(linkA, DOC_MARKER_SHARED);
  await upsertGrant(shared, linkA, linkB);
  // Never released anywhere: the document that must stay in A alone.
  await upsertDocumentWithMarker(linkA, DOC_MARKER_PRIVATE);

  await upsertMedicationPlanWithMarker(linkA, MED_MARKER_A);
  await upsertMedicationPlanWithMarker(linkB, MED_MARKER_B);
  const linkA2 = await upsertSecondLinkToPracticeA(practiceA, patient);
  await upsertMedicationPlanWithMarker(linkA2, MED_MARKER_A2);
  await upsertLongTimeline(linkA2, ownerA.id);

  await upsertErezeptWithMarker(linkA.id, patient.id, ownerA.id, ERX_MARKER_A);
  await upsertErezeptWithMarker(linkB.id, patient.id, ownerB.id, ERX_MARKER_B);
  await upsertErezeptWithMarker(linkA2.id, patient.id, ownerA.id, ERX_MARKER_A2);

  // Two different real kinds in A, so the tests do not only exercise one path.
  await upsertInboxItemWithMarker({ patientUserId: patient.id, practiceProfileId: practiceA.id, linkId: linkA.id, title: INBOX_MARKER_A });
  await upsertInboxItemWithMarker({ patientUserId: patient.id, practiceProfileId: practiceA.id, linkId: linkA.id, title: INBOX_MARKER_A_DOC, type: "document", sourceRefType: "practice_document" });
  await upsertInboxItemWithMarker({ patientUserId: patient.id, practiceProfileId: practiceB.id, linkId: linkB.id, title: INBOX_MARKER_B });
  await upsertInboxItemWithMarker({ patientUserId: patient.id, practiceProfileId: practiceA.id, linkId: linkA2.id, title: INBOX_MARKER_A2 });
  // Practice A, but no relationship: must belong to no context.
  await upsertInboxItemWithMarker({ patientUserId: patient.id, practiceProfileId: practiceA.id, linkId: null, title: INBOX_MARKER_PRACTICE_ONLY, type: "system", sourceRefType: "appointment" });

  await upsertTelemedicineWithMarker({ practiceProfileId: practiceA.id, linkId: linkA.id, patientUserId: patient.id, title: TELE_MARKER_A });
  await upsertTelemedicineWithMarker({ practiceProfileId: practiceB.id, linkId: linkB.id, patientUserId: patient.id, title: TELE_MARKER_B });
  await upsertTelemedicineWithMarker({ practiceProfileId: practiceA.id, linkId: linkA2.id, patientUserId: patient.id, title: TELE_MARKER_A2 });
  // Legitimate and linkless: reachable globally, in no practice context.
  await upsertTelemedicineWithMarker({ practiceProfileId: practiceA.id, linkId: null, patientUserId: patient.id, title: TELE_MARKER_LINKLESS });

  console.log("Practice-context E2E fixture ready.\n");
  console.log("Add to .env.e2e:");
  console.log(`  E2E_PATIENT_EMAIL=${PATIENT_EMAIL}`);
  console.log(`  E2E_PATIENT_PASSWORD=${PASSWORD}`);
  console.log(`  E2E_LINK_A=${linkA.id}`);
  console.log(`  E2E_LINK_B=${linkB.id}`);
  console.log(`  E2E_LINK_A2=${linkA2.id}`);
  console.log("");
  console.log(`  Practice A: ${practiceA.practiceName}  marker ${MARKER_A}`);
  console.log(`  Practice B: ${practiceB.practiceName}  marker ${MARKER_B}`);
  console.log(`  Appointments: ${APPT_MARKER_A} (A) / ${APPT_MARKER_B} (B)`);
  console.log(`  Documents:    ${DOC_MARKER_A} (A) / ${DOC_MARKER_B} (B)`);
  console.log(`                ${DOC_MARKER_SHARED} (A, granted into B)`);
  console.log(`                ${DOC_MARKER_PRIVATE} (A only, never granted)`);
  console.log(`  Medication:   ${MED_MARKER_A} (A) / ${MED_MARKER_B} (B)`);
  console.log(`                ${MED_MARKER_A2} (A2 — same practice as A, different link)`);
  console.log(`  eRezept:      ${ERX_MARKER_A} (A) / ${ERX_MARKER_B} (B) / ${ERX_MARKER_A2} (A2)`);
  console.log(`  Inbox:        ${INBOX_MARKER_A} + ${INBOX_MARKER_A_DOC} (A) / ${INBOX_MARKER_B} (B) / ${INBOX_MARKER_A2} (A2)`);
  console.log(`                ${INBOX_MARKER_PRACTICE_ONLY} (practice A, no link — belongs to no context)`);
  console.log(`  Timeline:     ${TL_COUNT} practice messages + ${TL_OWN_READ} / ${TL_OWN_SENT} on A2`);
  console.log(`  Telemedicine: ${TELE_MARKER_A} (A) / ${TELE_MARKER_B} (B) / ${TELE_MARKER_A2} (A2)`);
  console.log(`                ${TELE_MARKER_LINKLESS} (no link — legitimate, global only)`);
}

main()
  .catch((e) => {
    console.error(e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
