/**
 * Marks ONE of the fixture patient's messages as read by the practice.
 *
 * Stands in for the recipient. The browser tests hold only the patient's
 * credentials, and the scenario that matters — the practice reading a message
 * while the sender has the editor open — is about the resulting STATE, not
 * about which screen produced it. Driving a second logged-in session to get
 * there would make the test slower and no more truthful.
 *
 * Only the fixture patient's own messages are in scope, and only `readAt` is
 * written.
 *
 *   node server/scripts/markE2eMessageRead.js EW_EDITABLE
 */
import { prisma } from "../lib/prisma.js";

const PATIENT_EMAIL = "e2e-practice-context-patient@test.invalid";

async function main() {
  const marker = process.argv[2];
  if (!marker) {
    console.error("[e2e-mark-read] Pass the message body marker as the first argument.");
    process.exit(1);
  }

  const patient = await prisma.user.findUnique({
    where: { email: PATIENT_EMAIL },
    select: { id: true },
  });
  if (!patient) {
    console.error(`[e2e-mark-read] No fixture patient ${PATIENT_EMAIL}.`);
    process.exit(1);
  }

  const { count } = await prisma.practicePatientMessage.updateMany({
    where: {
      senderType: "patient",
      senderUserId: patient.id,
      body: marker,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  console.log(`[e2e-mark-read] ${marker}: ${count} message(s) marked read.`);
  if (count === 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
