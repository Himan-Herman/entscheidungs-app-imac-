/**
 * Background worker (Postgres outbox / Render Cron) feature flags.
 * Master: WORKER_ENABLED — when false, no processors run.
 * Per-processor: WORKER_<NAME>_ENABLED — when unset and master is true, processor runs.
 */

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "true" || raw === "1";
}

export function isWorkerEnabled() {
  return envFlag("WORKER_ENABLED", false);
}

function isProcessorEnabled(envName) {
  if (!isWorkerEnabled()) return false;
  const raw = process.env[envName];
  if (raw === undefined || raw === "") return true;
  return raw === "true" || raw === "1";
}

export function isWorkerWebhooksEnabled() {
  return isProcessorEnabled("WORKER_WEBHOOKS_ENABLED");
}

export function isWorkerRemindersEnabled() {
  return isProcessorEnabled("WORKER_REMINDERS_ENABLED");
}

export function isWorkerExportsEnabled() {
  return isProcessorEnabled("WORKER_EXPORTS_ENABLED");
}

export function isWorkerOcrEnabled() {
  return isProcessorEnabled("WORKER_OCR_ENABLED");
}

export function isWorkerTelemedicineCleanupEnabled() {
  return isProcessorEnabled("WORKER_TELEMEDICINE_CLEANUP_ENABLED");
}

/** Safe snapshot for status responses (no secrets). */
export function getWorkerFlagsSnapshot() {
  return {
    workerEnabled: isWorkerEnabled(),
    webhooks: isWorkerWebhooksEnabled(),
    reminders: isWorkerRemindersEnabled(),
    exports: isWorkerExportsEnabled(),
    ocr: isWorkerOcrEnabled(),
    telemedicineCleanup: isWorkerTelemedicineCleanupEnabled(),
  };
}
