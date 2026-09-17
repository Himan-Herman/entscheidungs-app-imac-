/**
 * Rebuilds the messages that the Phase 3B browser tests act on.
 *
 * Editing, withdrawing and reading are all writes, so every 3B scenario
 * consumes the state it needs. Without a reset the second run of the suite
 * would test a conversation the first run already rewrote — and would pass or
 * fail for reasons that have nothing to do with the code.
 *
 * The scratch messages are identified by their `clientRequestId`, not by their
 * text: a withdrawn message has no text left to match on. Only rows carrying
 * the `e2e-3b-` prefix in the fixture patient's own conversation are touched;
 * the markers the isolation tests rely on are never in scope.
 *
 *   node server/scripts/resetE2eMessageMutationFixture.js
 */
import { prisma } from "../lib/prisma.js";

const PATIENT_EMAIL = "e2e-practice-context-patient@test.invalid";
const PREFIX = "e2e-3b-";

/** Fixed and in the past, so the seeded order is the same on every machine. */
const BASE = new Date("2026-08-10T08:00:00.000Z").getTime();
const at = (minutes) => new Date(BASE + minutes * 60_000);

/**
 * One message per situation a 3B scenario needs. Kept small on purpose: these
 * sit in the SHORT conversation (link A), where adding history would change
 * nothing about pagination but adding a lot of it would.
 */
const SCRATCH = [
  { key: "editable", body: "EW_EDITABLE", minutes: 1, read: false },
  { key: "withdrawable", body: "EW_WITHDRAWABLE", minutes: 2, read: false },
  { key: "read", body: "EW_ALREADY_READ", minutes: 3, read: true },
];

async function main() {
  const patient = await prisma.user.findUnique({
    where: { email: PATIENT_EMAIL },
    select: { id: true },
  });
  if (!patient) {
    console.error(`[e2e-3b-reset] No fixture patient ${PATIENT_EMAIL} — run the fixture first.`);
    process.exit(1);
  }

  // The FIRST link of this patient without a family profile: the same one the
  // spec addresses as E2E_LINK_A.
  const link = await prisma.practicePatientLink.findFirst({
    where: { patientUserId: patient.id, patientProfileId: null, status: "active" },
    orderBy: { createdAt: "asc" },
  });
  if (!link) {
    console.error("[e2e-3b-reset] No active link for the fixture patient.");
    process.exit(1);
  }

  const thread = await prisma.practicePatientThread.findUnique({
    where: { practicePatientLinkId: link.id },
    select: { id: true },
  });
  if (!thread) {
    console.error("[e2e-3b-reset] The link has no conversation yet.");
    process.exit(1);
  }

  const removed = await prisma.practicePatientMessage.deleteMany({
    where: { threadId: thread.id, clientRequestId: { startsWith: PREFIX } },
  });

  // Messages the browser tests actually SENT.
  //
  // Those go through the ordinary send path, so they carry a generated
  // idempotency key and the prefix above does not find them. They are removed
  // by their marker instead — otherwise every run of the dictation scenarios
  // would leave another copy behind and the next run would find several where
  // it expects one.
  // `contains`, not `startsWith`: a dictation scenario can leave a message
  // whose text begins with a transcript and only then carries the marker, and a
  // prefix match would walk straight past it.
  const sent = await prisma.practicePatientMessage.deleteMany({
    where: { threadId: thread.id, body: { contains: "E2E_DICTATION_" } },
  });

  for (const s of SCRATCH) {
    await prisma.practicePatientMessage.create({
      data: {
        threadId: thread.id,
        senderType: "patient",
        senderUserId: patient.id,
        body: s.body,
        clientRequestId: `${PREFIX}${s.key}`,
        createdAt: at(s.minutes),
        // Set by the script rather than by driving the practice UI: the point of
        // the "already read" case is the state, not how it was reached.
        readAt: s.read ? at(s.minutes + 30) : null,
        editedAt: null,
        withdrawnAt: null,
      },
    });
  }

  console.log(
    `[e2e-3b-reset] link ${link.id}: removed ${removed.count} scratch + ${sent.count} sent, ` +
      `seeded ${SCRATCH.length}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
