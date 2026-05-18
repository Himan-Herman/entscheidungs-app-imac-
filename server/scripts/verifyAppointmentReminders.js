/**
 * Appointment reminder worker smoke tests (DB + service layer).
 * Usage: node scripts/verifyAppointmentReminders.js
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  cancelAppointmentReminders,
  scheduleAppointmentReminders,
} from "../services/reminders/appointmentReminderSchedule.js";
import {
  computeNextRetryAt,
  REMINDER_STATUS,
} from "../services/reminders/reminderConstants.js";
import {
  processSingleReminder,
  runAppointmentReminderWorker,
} from "../services/reminders/appointmentReminderWorker.js";

const prisma = new PrismaClient();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function testBackoff() {
  const t1 = computeNextRetryAt(1);
  const t2 = computeNextRetryAt(2);
  assert(t2 > t1, "backoff should increase with attemptCount");
  console.log("[verify] computeNextRetryAt ok");
}

async function testClaimIdempotency(reminderId) {
  const first = await prisma.appointmentReminder.updateMany({
    where: { id: reminderId, status: REMINDER_STATUS.PENDING },
    data: { status: REMINDER_STATUS.PROCESSING, processingAt: new Date() },
  });
  const second = await prisma.appointmentReminder.updateMany({
    where: { id: reminderId, status: REMINDER_STATUS.PENDING },
    data: { status: REMINDER_STATUS.PROCESSING, processingAt: new Date() },
  });
  assert(first.count === 1, "first claim should succeed");
  assert(second.count === 0, "second claim should not steal processing row");
  await prisma.appointmentReminder.update({
    where: { id: reminderId },
    data: { status: REMINDER_STATUS.PENDING, processingAt: null },
  });
  console.log("[verify] atomic claim ok");
}

async function testCancel(appointmentId) {
  const key = `verify:cancel:${appointmentId}:${Date.now()}`;
  const row = await prisma.appointmentReminder.create({
    data: {
      reminderKey: key,
      subjectKind: "appointment",
      appointmentId,
      type: "inbox",
      templateKey: "patient_appointment_24h_inbox",
      sendAt: new Date(Date.now() + 86_400_000),
      status: REMINDER_STATUS.PENDING,
    },
  });
  const n = await cancelAppointmentReminders(appointmentId, "verify_cancel");
  assert(n >= 1, "cancel should affect pending rows");
  const after = await prisma.appointmentReminder.findUnique({ where: { id: row.id } });
  assert(after.status === REMINDER_STATUS.CANCELLED, "reminder should be cancelled");
  console.log("[verify] cancelAppointmentReminders ok");
}

async function main() {
  await testBackoff();

  const appt = await prisma.practiceAppointment.findFirst({
    where: {
      patientUserId: { not: null },
      status: { in: ["confirmed", "scheduled"] },
      startAt: { gt: new Date(Date.now() + 48 * 60 * 60 * 1000) },
    },
    select: { id: true, startAt: true },
  });

  if (!appt) {
    console.log("[verify] skip DB tests — no future confirmed appointment in DB");
    return;
  }

  const { scheduled } = await scheduleAppointmentReminders(appt.id, appt.startAt);
  assert(scheduled > 0, "should schedule at least one reminder");
  console.log(`[verify] scheduleAppointmentReminders ok count=${scheduled}`);

  const due = await prisma.appointmentReminder.findFirst({
    where: { appointmentId: appt.id, status: REMINDER_STATUS.PENDING },
    orderBy: { sendAt: "asc" },
  });
  if (!due) {
    console.log("[verify] skip claim test — no pending reminder row");
    return;
  }

  await prisma.appointmentReminder.update({
    where: { id: due.id },
    data: { sendAt: new Date(Date.now() - 60_000) },
  });

  await testClaimIdempotency(due.id);

  const stats = await runAppointmentReminderWorker({ limit: 5 });
  console.log("[verify] worker run stats:", stats);

  const after = await prisma.appointmentReminder.findUnique({ where: { id: due.id } });
  if (after.status === REMINDER_STATUS.SENT) {
    const stats2 = await runAppointmentReminderWorker({ limit: 5 });
    const again = await prisma.appointmentReminder.findUnique({ where: { id: due.id } });
    assert(again.status === REMINDER_STATUS.SENT, "should stay sent");
    assert(stats2.sent === 0 || stats2.claimed === 0, "no duplicate send on re-run");
    console.log("[verify] idempotent worker re-run ok");
  } else {
    const outcome = await processSingleReminder(due.id);
    console.log("[verify] process outcome (may skip inbox if disabled):", outcome);
  }

  await testCancel(appt.id);
}

main()
  .catch((e) => {
    console.error("[verify] failed:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
