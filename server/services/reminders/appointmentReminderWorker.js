import { prisma } from "../../lib/prisma.js";
import { writeAuditLog } from "../auditLogService.js";
import { deliverAppointmentReminder } from "./appointmentReminderDelivery.js";
import {
  computeNextRetryAt,
  DEFAULT_MAX_ATTEMPTS,
  REMINDER_STATUS,
  STALE_PROCESSING_MS,
  workerBatchSize,
} from "./reminderConstants.js";


const TERMINAL_APPOINTMENT = new Set(["cancelled", "completed", "no_show"]);

/**
 * Recover reminders stuck in processing after a crash.
 */
export async function recoverStaleProcessingReminders() {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
  const result = await prisma.appointmentReminder.updateMany({
    where: {
      status: REMINDER_STATUS.PROCESSING,
      processingAt: { lt: cutoff },
    },
    data: {
      status: REMINDER_STATUS.PENDING,
      processingAt: null,
    },
  });
  return result.count;
}

/**
 * @param {Date} now
 */
function dueWhere(now) {
  return {
    OR: [
      {
        status: REMINDER_STATUS.PENDING,
        sendAt: { lte: now },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
    ],
  };
}

/**
 * @param {string} reminderId
 */
async function claimReminder(reminderId) {
  const now = new Date();
  const claimed = await prisma.appointmentReminder.updateMany({
    where: {
      id: reminderId,
      status: REMINDER_STATUS.PENDING,
      sendAt: { lte: now },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    data: {
      status: REMINDER_STATUS.PROCESSING,
      processingAt: now,
    },
  });
  return claimed.count === 1;
}

/**
 * @param {import('@prisma/client').AppointmentReminder} reminder
 */
async function shouldCancelReminder(reminder) {
  if (reminder.appointment) {
    const appt = reminder.appointment;
    if (TERMINAL_APPOINTMENT.has(appt.status)) return "appointment_inactive";
    if (reminder.sendAt > appt.startAt) return "appointment_passed";
  }
  if (reminder.followUpThread) {
    const t = reminder.followUpThread;
    if (t.isArchived || t.status === "closed" || t.status === "archived") {
      return "follow_up_closed";
    }
    if (reminder.templateKey.includes("nudge") && t.status !== "waiting_for_patient") {
      return "follow_up_already_answered";
    }
  }
  return null;
}

/**
 * @param {string} reminderId
 * @param {string} [failReason]
 */
async function markSent(reminderId) {
  const now = new Date();
  const updated = await prisma.appointmentReminder.updateMany({
    where: { id: reminderId, status: REMINDER_STATUS.PROCESSING },
    data: {
      status: REMINDER_STATUS.SENT,
      sentAt: now,
      processingAt: null,
      nextRetryAt: null,
      failedReason: null,
    },
  });
  if (updated.count !== 1) {
    return false;
  }
  writeAuditLog({
    actorRole: "system",
    action: "reminder.sent",
    entityType: "AppointmentReminder",
    entityId: reminderId,
    metadata: { sentAt: now.toISOString() },
  }).catch(() => {});
  return true;
}

/**
 * @param {import('@prisma/client').AppointmentReminder} reminder
 * @param {string} reason
 */
async function markCancelled(reminder, reason) {
  await prisma.appointmentReminder.update({
    where: { id: reminder.id },
    data: {
      status: REMINDER_STATUS.CANCELLED,
      failedReason: reason.slice(0, 120),
      processingAt: null,
    },
  });
  writeAuditLog({
    actorRole: "system",
    action: "reminder.cancelled",
    entityType: "AppointmentReminder",
    entityId: reminder.id,
    metadata: { reason },
  }).catch(() => {});
}

/**
 * @param {import('@prisma/client').AppointmentReminder} reminder
 * @param {string} reason
 */
async function markFailedOrRetry(reminder, reason) {
  const attemptCount = reminder.attemptCount + 1;
  const maxAttempts = reminder.maxAttempts || DEFAULT_MAX_ATTEMPTS;

  if (attemptCount >= maxAttempts) {
    await prisma.appointmentReminder.update({
      where: { id: reminder.id },
      data: {
        status: REMINDER_STATUS.FAILED,
        attemptCount,
        failedReason: reason.slice(0, 120),
        processingAt: null,
        nextRetryAt: null,
      },
    });
    writeAuditLog({
      actorRole: "system",
      action: "reminder.failed",
      entityType: "AppointmentReminder",
      entityId: reminder.id,
      metadata: { attemptCount, reason: reason.slice(0, 80) },
    }).catch(() => {});
    return { status: REMINDER_STATUS.FAILED };
  }

  const nextRetryAt = computeNextRetryAt(attemptCount);
  await prisma.appointmentReminder.update({
    where: { id: reminder.id },
    data: {
      status: REMINDER_STATUS.PENDING,
      attemptCount,
      failedReason: reason.slice(0, 120),
      processingAt: null,
      nextRetryAt,
    },
  });
  return { status: REMINDER_STATUS.PENDING, nextRetryAt };
}

/**
 * Process one reminder (must be claimed first).
 */
export async function processSingleReminder(reminderId) {
  const reminder = await prisma.appointmentReminder.findUnique({
    where: { id: reminderId },
    include: {
      appointment: {
        select: {
          id: true,
          practiceProfileId: true,
          practicePatientLinkId: true,
          patientUserId: true,
          status: true,
          startAt: true,
          locationType: true,
        },
      },
      followUpThread: {
        select: {
          id: true,
          patientUserId: true,
          practiceProfileId: true,
          status: true,
          isArchived: true,
        },
      },
    },
  });
  if (!reminder) {
    return { ok: false, reason: "not_found" };
  }
  if (reminder.status === REMINDER_STATUS.SENT) {
    return { ok: true, alreadySent: true };
  }
  if (reminder.status !== REMINDER_STATUS.PROCESSING) {
    return { ok: false, reason: "not_processing" };
  }

  const cancelReason = await shouldCancelReminder(reminder);
  if (cancelReason) {
    await markCancelled(reminder, cancelReason);
    return { ok: true, cancelled: true, reason: cancelReason };
  }

  try {
    const result = await deliverAppointmentReminder(reminder);
    if (result.skipped) {
      const marked = await markSent(reminder.id);
      return { ok: true, skipped: true, reason: result.reason, marked };
    }
    const marked = await markSent(reminder.id);
    if (!marked) {
      return { ok: true, alreadySent: true };
    }
    return { ok: true, sent: true, channel: result.channel };
  } catch (err) {
    const reason = String(err?.message || "delivery_failed");
    const retry = await markFailedOrRetry(reminder, reason);
    return { ok: false, error: reason, retry };
  }
}

/**
 * Run worker batch — safe for concurrent cron invocations.
 * @param {{ limit?: number }} [opts]
 */
export async function runAppointmentReminderWorker(opts = {}) {
  const limit = opts.limit ?? workerBatchSize();
  const now = new Date();

  const staleRecovered = await recoverStaleProcessingReminders();

  const due = await prisma.appointmentReminder.findMany({
    where: dueWhere(now),
    orderBy: [{ sendAt: "asc" }],
    take: limit,
    select: { id: true },
  });

  const stats = {
    scanned: due.length,
    claimed: 0,
    sent: 0,
    skipped: 0,
    cancelled: 0,
    failed: 0,
    retryScheduled: 0,
    staleRecovered,
  };

  for (const row of due) {
    const claimed = await claimReminder(row.id);
    if (!claimed) continue;
    stats.claimed += 1;

    const outcome = await processSingleReminder(row.id);
    if (outcome.cancelled) stats.cancelled += 1;
    else if (outcome.sent) stats.sent += 1;
    else if (outcome.skipped) stats.skipped += 1;
    else if (outcome.retry?.status === REMINDER_STATUS.PENDING) stats.retryScheduled += 1;
    else if (outcome.retry?.status === REMINDER_STATUS.FAILED) stats.failed += 1;
    else if (!outcome.ok) stats.failed += 1;
  }

  return stats;
}

/**
 * Queue depth metrics for health endpoint.
 */
export async function getAppointmentReminderWorkerStatus() {
  const now = new Date();
  const [pendingDue, processing, failed, sentLast24h] = await Promise.all([
    prisma.appointmentReminder.count({
      where: {
        status: REMINDER_STATUS.PENDING,
        sendAt: { lte: now },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
    }),
    prisma.appointmentReminder.count({
      where: { status: REMINDER_STATUS.PROCESSING },
    }),
    prisma.appointmentReminder.count({
      where: { status: REMINDER_STATUS.FAILED },
    }),
    prisma.appointmentReminder.count({
      where: {
        status: REMINDER_STATUS.SENT,
        sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    pendingDue,
    processing,
    failed,
    sentLast24h,
    workerBatchSize: workerBatchSize(),
    emailRemindersEnabled: process.env.ENABLE_APPOINTMENT_EMAIL_REMINDERS === "true",
  };
}
