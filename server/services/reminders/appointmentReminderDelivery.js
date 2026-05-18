import { PrismaClient } from "@prisma/client";
import { isPatientInboxEnabled, isPracticeInboxEnabled } from "../../config/featureFlags.js";
import { notifyPatientInbox } from "../patientInbox/patientInboxNotify.js";
import { upsertPracticeInboxItem } from "../practiceInbox/practiceInboxService.js";
import { deliverOrganizationalReminderEmail } from "../emailQueueService.js";
import { reminderCopyForTemplate } from "./reminderCopy.js";
import { REMINDER_CHANNEL } from "./reminderConstants.js";

const prisma = new PrismaClient();

/**
 * @param {import('@prisma/client').AppointmentReminder & { appointment?: object | null, followUpThread?: object | null }} reminder
 */
export async function deliverAppointmentReminder(reminder) {
  const locale = await resolveLocale(reminder);
  const copy = reminderCopyForTemplate(reminder.templateKey, locale);

  if (reminder.templateKey.startsWith("practice_")) {
    return deliverPracticeReminder(reminder, copy);
  }

  if (reminder.type === REMINDER_CHANNEL.EMAIL) {
    return deliverEmailReminder(reminder, copy, locale);
  }

  if (
    reminder.type === REMINDER_CHANNEL.INBOX ||
    reminder.type === REMINDER_CHANNEL.SYSTEM
  ) {
    return deliverPatientInboxReminder(reminder, copy);
  }

  throw new Error("unknown_channel");
}

async function resolveLocale(reminder) {
  let userId = null;
  if (reminder.appointment?.patientUserId) {
    userId = reminder.appointment.patientUserId;
  } else if (reminder.followUpThread?.patientUserId) {
    userId = reminder.followUpThread.patientUserId;
  }
  if (!userId) return "de";
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  const lang = user?.profile?.preferredPatientLanguage;
  return String(lang || "de").toLowerCase().startsWith("en") ? "en" : "de";
}

/**
 * @param {import('@prisma/client').AppointmentReminder} reminder
 * @param {{ title: string, summary: string }} copy
 */
async function deliverPatientInboxReminder(reminder, copy) {
  if (!isPatientInboxEnabled()) {
    return { ok: true, skipped: true, reason: "patient_inbox_disabled" };
  }

  const appt = reminder.appointment;
  const thread = reminder.followUpThread;
  const patientUserId = appt?.patientUserId || thread?.patientUserId;
  if (!patientUserId) {
    return { ok: false, reason: "no_patient" };
  }

  const practiceProfileId = appt?.practiceProfileId || thread?.practiceProfileId;
  const linkId = appt?.practicePatientLinkId;
  const targetUrl = appt
    ? `/patient/appointments?appointmentId=${appt.id}`
    : `/pre-visit/follow-ups`;

  await notifyPatientInbox({
    patientUserId,
    practiceProfileId: practiceProfileId || undefined,
    practicePatientLinkId: linkId || undefined,
    type: "system",
    title: copy.title,
    summary: copy.summary,
    targetUrl,
    sourceRefType: "appointment_reminder",
    sourceRefId: reminder.id,
  });

  return { ok: true, channel: "patient_inbox" };
}

/**
 * @param {import('@prisma/client').AppointmentReminder} reminder
 * @param {{ title: string, summary: string }} copy
 */
async function deliverPracticeReminder(reminder, copy) {
  if (!isPracticeInboxEnabled()) {
    return { ok: true, skipped: true, reason: "practice_inbox_disabled" };
  }

  const appt = reminder.appointment;
  if (!appt?.practiceProfileId) {
    return { ok: false, reason: "no_practice" };
  }

  await upsertPracticeInboxItem({
    practiceProfileId: appt.practiceProfileId,
    practicePatientLinkId: appt.practicePatientLinkId || undefined,
    patientUserId: appt.patientUserId || undefined,
    type: "system",
    title: copy.title,
    summary: copy.summary,
    sourceRefType: "appointment_reminder",
    sourceRefId: reminder.id,
    targetUrl: `/practice/calendar?practiceId=${appt.practiceProfileId}&appointmentId=${appt.id}`,
  });

  return { ok: true, channel: "practice_inbox" };
}

/**
 * @param {import('@prisma/client').AppointmentReminder} reminder
 * @param {{ title: string, summary: string }} copy
 * @param {string} locale
 */
async function deliverEmailReminder(reminder, copy, locale) {
  const appt = reminder.appointment;
  const patientUserId = appt?.patientUserId;
  if (!patientUserId) {
    return { ok: true, skipped: true, reason: "no_patient_email" };
  }

  const user = await prisma.user.findUnique({
    where: { id: patientUserId },
    select: { email: true },
  });
  if (!user?.email) {
    return { ok: true, skipped: true, reason: "no_email_on_file" };
  }

  const sent = await deliverOrganizationalReminderEmail({
    to: user.email,
    subject: copy.title,
    text: copy.summary,
    locale,
  });

  if (!sent.ok) {
    throw new Error(sent.reason || "email_failed");
  }

  return { ok: true, channel: "email" };
}
