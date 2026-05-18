import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../auditLogService.js";
import {
  DEFAULT_MAX_ATTEMPTS,
  isAppointmentEmailRemindersEnabled,
  MS_15M,
  MS_1H,
  MS_24H,
  MS_48H,
  REMINDER_CHANNEL,
  REMINDER_STATUS,
  SUBJECT_KIND,
} from "./reminderConstants.js";

const prisma = new PrismaClient();

const ACTIVE_APPOINTMENT = new Set([
  "scheduled",
  "confirmed",
  "rescheduled",
  "requested",
]);

/**
 * @param {object} spec
 */
async function upsertReminder(spec) {
  const existing = await prisma.appointmentReminder.findUnique({
    where: { reminderKey: spec.reminderKey },
    select: { status: true },
  });
  if (existing?.status === REMINDER_STATUS.SENT) {
    return;
  }

  await prisma.appointmentReminder.upsert({
    where: { reminderKey: spec.reminderKey },
    create: {
      reminderKey: spec.reminderKey,
      subjectKind: spec.subjectKind,
      appointmentId: spec.appointmentId ?? null,
      followUpThreadId: spec.followUpThreadId ?? null,
      type: spec.type,
      templateKey: spec.templateKey,
      sendAt: spec.sendAt,
      status: REMINDER_STATUS.PENDING,
      attemptCount: 0,
      maxAttempts: spec.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      nextRetryAt: null,
      failedReason: null,
      sentAt: null,
      processingAt: null,
    },
    update: {
      sendAt: spec.sendAt,
      status: REMINDER_STATUS.PENDING,
      attemptCount: 0,
      nextRetryAt: null,
      failedReason: null,
      sentAt: null,
      processingAt: null,
    },
  });

  writeAuditLog({
    actorRole: "system",
    action: "reminder.created",
    entityType: "AppointmentReminder",
    entityId: spec.reminderKey,
    practiceProfileId: spec.practiceProfileId ?? null,
    patientUserId: spec.patientUserId ?? null,
    metadata: {
      templateKey: spec.templateKey,
      type: spec.type,
      subjectKind: spec.subjectKind,
      sendAt: spec.sendAt.toISOString(),
    },
  }).catch(() => {});
}

function futureSendAt(startAt, offsetMs) {
  const sendAt = new Date(startAt.getTime() - offsetMs);
  if (sendAt <= new Date()) return null;
  return sendAt;
}

/**
 * Schedule organizational reminders for a confirmed/scheduled appointment.
 * @param {string} appointmentId
 * @param {Date} startAt
 */
export async function scheduleAppointmentReminders(appointmentId, startAt) {
  const appt = await prisma.practiceAppointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      practiceProfileId: true,
      patientUserId: true,
      locationType: true,
      status: true,
    },
  });
  if (!appt || !ACTIVE_APPOINTMENT.has(appt.status)) return { scheduled: 0 };

  const specs = [];
  const base = {
    subjectKind: SUBJECT_KIND.APPOINTMENT,
    appointmentId: appt.id,
    practiceProfileId: appt.practiceProfileId,
    patientUserId: appt.patientUserId,
  };

  const send24h = futureSendAt(startAt, MS_24H);
  if (send24h) {
    specs.push({
      ...base,
      reminderKey: `appt:${appt.id}:inbox:24h`,
      type: REMINDER_CHANNEL.INBOX,
      templateKey: "patient_appointment_24h_inbox",
      sendAt: send24h,
    });
    specs.push({
      ...base,
      reminderKey: `appt:${appt.id}:system:24h`,
      type: REMINDER_CHANNEL.SYSTEM,
      templateKey: "patient_appointment_24h_system",
      sendAt: send24h,
    });
    if (isAppointmentEmailRemindersEnabled()) {
      specs.push({
        ...base,
        reminderKey: `appt:${appt.id}:email:24h`,
        type: REMINDER_CHANNEL.EMAIL,
        templateKey: "patient_appointment_24h_email",
        sendAt: send24h,
      });
    }
    specs.push({
      ...base,
      reminderKey: `appt:${appt.id}:practice:inbox:24h`,
      type: REMINDER_CHANNEL.INBOX,
      templateKey: "practice_appointment_24h_inbox",
      sendAt: send24h,
    });
  }

  if (appt.locationType === "video") {
    const send1h = futureSendAt(startAt, MS_1H);
    if (send1h) {
      specs.push({
        ...base,
        reminderKey: `appt:${appt.id}:inbox:video:1h`,
        type: REMINDER_CHANNEL.INBOX,
        templateKey: "patient_video_1h_inbox",
        sendAt: send1h,
      });
    }
    const send15m = futureSendAt(startAt, MS_15M);
    if (send15m) {
      specs.push({
        ...base,
        reminderKey: `appt:${appt.id}:inbox:video:15m`,
        type: REMINDER_CHANNEL.INBOX,
        templateKey: "patient_video_15m_inbox",
        sendAt: send15m,
      });
    }
  }

  for (const spec of specs) {
    await upsertReminder(spec);
  }

  return { scheduled: specs.length };
}

/**
 * @param {string} appointmentId
 */
export async function cancelAppointmentReminders(appointmentId, reason = "appointment_cancelled") {
  const result = await prisma.appointmentReminder.updateMany({
    where: {
      appointmentId,
      status: { in: [REMINDER_STATUS.PENDING, REMINDER_STATUS.PROCESSING] },
    },
    data: {
      status: REMINDER_STATUS.CANCELLED,
      failedReason: reason.slice(0, 120),
      processingAt: null,
    },
  });

  if (result.count > 0) {
    writeAuditLog({
      actorRole: "system",
      action: "reminder.cancelled",
      entityType: "PracticeAppointment",
      entityId: appointmentId,
      metadata: { count: result.count, reason },
    }).catch(() => {});
  }

  return result.count;
}

/**
 * @param {string} appointmentId
 * @param {Date} startAt
 */
export async function rescheduleAppointmentReminders(appointmentId, startAt) {
  await cancelAppointmentReminders(appointmentId, "appointment_rescheduled");
  return scheduleAppointmentReminders(appointmentId, startAt);
}

/**
 * Patient nudge when a follow-up thread awaits patient reply.
 * @param {string} threadId
 */
export async function scheduleFollowUpPatientNudge(threadId) {
  const thread = await prisma.preVisitFollowUpThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      patientUserId: true,
      practiceProfileId: true,
      status: true,
      isArchived: true,
    },
  });
  if (!thread?.patientUserId || thread.isArchived) return { scheduled: 0 };
  if (!["waiting_for_patient", "open"].includes(thread.status)) return { scheduled: 0 };

  const sendAt = new Date(Date.now() + MS_48H);
  await upsertReminder({
    reminderKey: `followup:${thread.id}:patient:nudge`,
    subjectKind: SUBJECT_KIND.FOLLOW_UP,
    followUpThreadId: thread.id,
    practiceProfileId: thread.practiceProfileId,
    patientUserId: thread.patientUserId,
    type: REMINDER_CHANNEL.INBOX,
    templateKey: "patient_follow_up_nudge_inbox",
    sendAt,
  });

  return { scheduled: 1 };
}

/**
 * @param {string} threadId
 */
export async function cancelFollowUpReminders(threadId, reason = "follow_up_resolved") {
  const result = await prisma.appointmentReminder.updateMany({
    where: {
      followUpThreadId: threadId,
      status: { in: [REMINDER_STATUS.PENDING, REMINDER_STATUS.PROCESSING] },
    },
    data: {
      status: REMINDER_STATUS.CANCELLED,
      failedReason: reason.slice(0, 120),
      processingAt: null,
    },
  });
  return result.count;
}
