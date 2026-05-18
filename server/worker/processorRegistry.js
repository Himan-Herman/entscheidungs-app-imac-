import {
  isWorkerExportsEnabled,
  isWorkerOcrEnabled,
  isWorkerRemindersEnabled,
  isWorkerTelemedicineCleanupEnabled,
  isWorkerWebhooksEnabled,
} from "../config/workerFlags.js";
import {
  processExportJobs,
  processOcrJobs,
  recoverStaleBackgroundJobs,
} from "../services/backgroundJobs/backgroundJobWorker.js";
import { cleanupExpiredExports } from "../services/export/exportJobService.js";
import { runAppointmentReminderWorker } from "../services/reminders/appointmentReminderWorker.js";
import { processTelemedicineCleanup } from "../services/telemedicine/telemedicineCleanupService.js";
import { runWebhookWorker } from "../services/webhooks/webhookWorker.js";

/**
 * @typedef {object} WorkerProcessorDef
 * @property {string} id
 * @property {() => boolean} isEnabled
 * @property {(opts: { limit?: number }) => Promise<Record<string, unknown>>} run
 */

/** @type {WorkerProcessorDef[]} */
export const WORKER_PROCESSORS = [
  {
    id: "webhooks",
    isEnabled: isWorkerWebhooksEnabled,
    run: (opts) => runWebhookWorker(opts),
  },
  {
    id: "reminders",
    isEnabled: isWorkerRemindersEnabled,
    run: (opts) => runAppointmentReminderWorker(opts),
  },
  {
    id: "exports",
    isEnabled: isWorkerExportsEnabled,
    run: async (opts) => {
      const stale = await recoverStaleBackgroundJobs();
      const stats = await processExportJobs(opts);
      return { ...stats, staleRecovered: stale.exportRecovered };
    },
  },
  {
    id: "ocr",
    isEnabled: isWorkerOcrEnabled,
    run: (opts) => processOcrJobs(opts),
  },
  {
    id: "exportCleanup",
    isEnabled: isWorkerExportsEnabled,
    run: async () => cleanupExpiredExports(),
  },
  {
    id: "telemedicine",
    isEnabled: isWorkerTelemedicineCleanupEnabled,
    run: (opts) => processTelemedicineCleanup(opts),
  },
];

/**
 * @param {string} processorId
 * @returns {WorkerProcessorDef | undefined}
 */
export function getWorkerProcessor(processorId) {
  return WORKER_PROCESSORS.find((p) => p.id === processorId);
}
