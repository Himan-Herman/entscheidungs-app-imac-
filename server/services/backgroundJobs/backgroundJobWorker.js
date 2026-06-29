import { prisma } from "../../lib/prisma.js";
import { isDocumentOcrUiEnabled } from "../../config/featureFlags.js";
import {
  cleanupExpiredExports,
  processExportJob,
} from "../export/exportJobService.js";
import { processDocumentOcrJob } from "../practiceDocument/documentOcrService.js";
import {
  computeJobNextRetryAt,
  DEFAULT_MAX_JOB_ATTEMPTS,
  EXPORT_POLL_STATUSES,
  jobWorkerBatchSize,
  JOB_STATUS,
  OCR_JOB_TIMEOUT_MS,
  OCR_POLL_STATUSES,
  STALE_JOB_PROCESSING_MS,
} from "./jobConstants.js";


let lastRunAt = null;

function dueRetryFilter(now) {
  return {
    OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
  };
}

export async function recoverStaleBackgroundJobs() {
  const cutoff = new Date(Date.now() - STALE_JOB_PROCESSING_MS);
  const ocrTimeoutCutoff = new Date(Date.now() - OCR_JOB_TIMEOUT_MS);

  const [exports, ocrTimedOut, ocrRecovered] = await Promise.all([
    prisma.exportJob.updateMany({
      where: {
        status: JOB_STATUS.PROCESSING,
        processingAt: { lt: cutoff },
      },
      data: {
        status: JOB_STATUS.PENDING,
        processingAt: null,
      },
    }),
    prisma.documentOcrJob.updateMany({
      where: {
        status: { in: [JOB_STATUS.PROCESSING, "running"] },
        processingAt: { lt: ocrTimeoutCutoff },
      },
      data: {
        status: JOB_STATUS.FAILED,
        failedAt: new Date(),
        errorCode: "ocr_timeout",
        processingAt: null,
      },
    }),
    prisma.documentOcrJob.updateMany({
      where: {
        status: { in: [JOB_STATUS.PROCESSING, "running"] },
        processingAt: { lt: cutoff },
      },
      data: {
        status: JOB_STATUS.PENDING,
        processingAt: null,
      },
    }),
  ]);

  return {
    exportRecovered: exports.count,
    ocrTimedOut: ocrTimedOut.count,
    ocrRecovered: ocrRecovered.count,
  };
}

async function claimExportJob(jobId, now) {
  const claimed = await prisma.exportJob.updateMany({
    where: {
      id: jobId,
      status: { in: [...EXPORT_POLL_STATUSES] },
      ...dueRetryFilter(now),
    },
    data: {
      status: JOB_STATUS.PROCESSING,
      processingAt: now,
    },
  });
  return claimed.count === 1;
}

async function claimOcrJob(jobId, now) {
  const claimed = await prisma.documentOcrJob.updateMany({
    where: {
      id: jobId,
      status: { in: [...OCR_POLL_STATUSES] },
      ...dueRetryFilter(now),
    },
    data: {
      status: JOB_STATUS.PROCESSING,
      processingAt: now,
      startedAt: now,
    },
  });
  return claimed.count === 1;
}

/**
 * @param {{ limit?: number }} [opts]
 */
export async function processExportJobs(opts = {}) {
  const limit = opts.limit ?? jobWorkerBatchSize();
  const now = new Date();

  const due = await prisma.exportJob.findMany({
    where: {
      status: { in: [...EXPORT_POLL_STATUSES] },
      ...dueRetryFilter(now),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const stats = { scanned: due.length, claimed: 0, completed: 0, failed: 0, retryScheduled: 0 };

  for (const row of due) {
    if (!(await claimExportJob(row.id, now))) continue;
    stats.claimed += 1;
    const outcome = await processExportJob(row.id);
    if (outcome.completed) stats.completed += 1;
    else if (outcome.failed) stats.failed += 1;
    else if (outcome.retrying) stats.retryScheduled += 1;
  }

  return stats;
}

/**
 * @param {{ limit?: number }} [opts]
 */
export async function processOcrJobs(opts = {}) {
  if (!isDocumentOcrUiEnabled()) {
    return { scanned: 0, claimed: 0, completed: 0, failed: 0, retryScheduled: 0, skipped: true };
  }

  const limit = opts.limit ?? jobWorkerBatchSize();
  const now = new Date();

  const due = await prisma.documentOcrJob.findMany({
    where: {
      status: { in: [...OCR_POLL_STATUSES] },
      ...dueRetryFilter(now),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const stats = { scanned: due.length, claimed: 0, completed: 0, failed: 0, retryScheduled: 0 };

  for (const row of due) {
    if (!(await claimOcrJob(row.id, now))) continue;
    stats.claimed += 1;
    const outcome = await processDocumentOcrJob(row.id);
    if (outcome.completed) stats.completed += 1;
    else if (outcome.failed) stats.failed += 1;
    else if (outcome.retrying) stats.retryScheduled += 1;
  }

  return stats;
}

/**
 * @param {{ limit?: number }} [opts]
 */
export async function runBackgroundJobWorker(opts = {}) {
  const stale = await recoverStaleBackgroundJobs();
  const exports = await processExportJobs(opts);
  const ocr = await processOcrJobs(opts);
  const cleanup = await cleanupExpiredExports();
  lastRunAt = new Date();

  return {
    stale,
    exports,
    ocr,
    cleanup,
    lastRunAt: lastRunAt.toISOString(),
  };
}

export async function getBackgroundJobWorkerStatus() {
  const now = new Date();
  const due = dueRetryFilter(now);

  const [
    exportPending,
    exportProcessing,
    exportFailed,
    ocrPending,
    ocrProcessing,
    ocrFailed,
  ] = await Promise.all([
    prisma.exportJob.count({
      where: { status: JOB_STATUS.PENDING, ...due },
    }),
    prisma.exportJob.count({
      where: { status: JOB_STATUS.PROCESSING },
    }),
    prisma.exportJob.count({
      where: { status: JOB_STATUS.FAILED },
    }),
    prisma.documentOcrJob.count({
      where: { status: { in: [JOB_STATUS.PENDING, "running"] }, ...due },
    }),
    prisma.documentOcrJob.count({
      where: { status: { in: [JOB_STATUS.PROCESSING, "running"] } },
    }),
    prisma.documentOcrJob.count({
      where: { status: JOB_STATUS.FAILED },
    }),
  ]);

  return {
    exports: {
      pending: exportPending,
      processing: exportProcessing,
      failed: exportFailed,
    },
    ocr: {
      pending: ocrPending,
      processing: ocrProcessing,
      failed: ocrFailed,
    },
    lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
    batchSize: jobWorkerBatchSize(),
  };
}
