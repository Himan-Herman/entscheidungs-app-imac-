/**
 * Puts the E2E patient's conversations back into an unread state.
 *
 * Reading a conversation is a real write — that is the point of the explicit
 * acknowledgement. So the first test that opens a thread leaves every later one
 * with nothing to acknowledge, and a test that checks HOW the acknowledgement
 * is made would pass by never making one. This script gives that test its
 * precondition back.
 *
 * Only the read state is touched: no message is created, moved or deleted.
 *
 *   node server/scripts/resetE2eMessageReadState.js
 */
import { prisma } from "../lib/prisma.js";

const PATIENT_EMAIL = "e2e-practice-context-patient@test.invalid";

async function main() {
  const patient = await prisma.user.findUnique({
    where: { email: PATIENT_EMAIL },
    select: { id: true },
  });
  if (!patient) {
    console.error(`[e2e-read-reset] No fixture patient ${PATIENT_EMAIL} — run the fixture first.`);
    process.exit(1);
  }

  // Only the practice's messages: the patient's own carry the state of whether
  // the PRACTICE has read them, which this script has no business rewriting.
  const { count } = await prisma.practicePatientMessage.updateMany({
    where: {
      senderType: "practice",
      readAt: { not: null },
      thread: { patientUserId: patient.id },
    },
    data: { readAt: null },
  });
  console.log(`[e2e-read-reset] ${count} message(s) set back to unread.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
