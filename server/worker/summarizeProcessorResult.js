/**
 * Normalize raw processor stats for cron HTTP responses (counts only, no payloads).
 * @param {string} processorId
 * @param {Record<string, unknown> | null | undefined} raw
 */
export function summarizeProcessorResult(processorId, raw) {
  if (!raw || raw.skipped === true) {
    return { processed: 0, failed: 0, skipped: true };
  }

  switch (processorId) {
    case "webhooks":
      return {
        processed: Number(raw.claimed) || 0,
        failed: (Number(raw.failed) || 0) + (Number(raw.deadLetter) || 0),
        delivered: Number(raw.delivered) || 0,
        retryScheduled: Number(raw.retryScheduled) || 0,
      };
    case "reminders":
      return {
        processed: Number(raw.claimed) || 0,
        failed: Number(raw.failed) || 0,
        sent: Number(raw.sent) || 0,
        cancelled: Number(raw.cancelled) || 0,
        retryScheduled: Number(raw.retryScheduled) || 0,
      };
    case "exports":
    case "ocr":
      return {
        processed: Number(raw.claimed) || 0,
        failed: Number(raw.failed) || 0,
        completed: Number(raw.completed) || 0,
        retryScheduled: Number(raw.retryScheduled) || 0,
      };
    case "exportCleanup":
      return {
        processed: Number(raw.expired) || 0,
        failed: 0,
      };
    case "telemedicine":
      return {
        processed:
          (Number(raw.waitingCancelled) || 0) +
          (Number(raw.plannedFailed) || 0) +
          (Number(raw.revokedCancelled) || 0) +
          (Number(raw.participantsCleaned) || 0),
        failed: Number(raw.plannedFailed) || 0,
        noted: Number(raw.activeStaleNoted) || 0,
      };
  }

  return {
    processed: Number(raw.processed) || Number(raw.claimed) || 0,
    failed: Number(raw.failed) || 0,
  };
}
