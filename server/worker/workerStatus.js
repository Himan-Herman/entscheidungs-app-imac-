import { getWorkerFlagsSnapshot } from "../config/workerFlags.js";
import { getBackgroundJobWorkerStatus } from "../services/backgroundJobs/backgroundJobWorker.js";
import { getAppointmentReminderWorkerStatus } from "../services/reminders/appointmentReminderWorker.js";
import { getTelemedicineCleanupStatus } from "../services/telemedicine/telemedicineCleanupService.js";
import { getWebhookWorkerStatus } from "../services/webhooks/webhookWorker.js";
import { getWorkerLastRunAt } from "./workerRunner.js";

/**
 * Aggregated queue depths for monitoring (no payloads, no PHI).
 */
export async function getWorkerStatus() {
  const [webhooks, reminders, jobs, telemedicine] = await Promise.all([
    getWebhookWorkerStatus(),
    getAppointmentReminderWorkerStatus(),
    getBackgroundJobWorkerStatus(),
    getTelemedicineCleanupStatus(),
  ]);

  const legacyPending =
    (webhooks.legacy?.pending ?? 0) + (webhooks.legacy?.retrying ?? 0);
  const devPending =
    (webhooks.developer?.pending ?? 0) + (webhooks.developer?.retrying ?? 0);

  return {
    flags: getWorkerFlagsSnapshot(),
    lastRunAt: getWorkerLastRunAt() || jobs.lastRunAt || webhooks.lastRunAt || null,
    queues: {
      webhooks: {
        pending: legacyPending + devPending,
        retrying:
          (webhooks.legacy?.retrying ?? 0) + (webhooks.developer?.retrying ?? 0),
        failed: (webhooks.legacy?.failed ?? 0) + (webhooks.developer?.failed ?? 0),
        deadLetter:
          (webhooks.legacy?.deadLetter ?? 0) + (webhooks.developer?.deadLetter ?? 0),
        processing: webhooks.developer?.processing ?? 0,
      },
      reminders: {
        pending: reminders.pendingDue ?? 0,
        processing: reminders.processing ?? 0,
        failed: reminders.failed ?? 0,
      },
      exports: {
        pending: jobs.exports?.pending ?? 0,
        processing: jobs.exports?.processing ?? 0,
        failed: jobs.exports?.failed ?? 0,
      },
      ocr: {
        pending: jobs.ocr?.pending ?? 0,
        processing: jobs.ocr?.processing ?? 0,
        failed: jobs.ocr?.failed ?? 0,
      },
      telemedicine: {
        waitingStale: telemedicine.waitingStale ?? 0,
        plannedStale: telemedicine.plannedStale ?? 0,
        revokedOpen: telemedicine.revokedOpen ?? 0,
        activeLong: telemedicine.activeLong ?? 0,
      },
    },
  };
}
