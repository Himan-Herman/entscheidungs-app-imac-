import { prisma } from "../../lib/prisma.js";
import { writeAuditLog } from "../auditLogService.js";
import {
  isPracticeWebhooksEnabled,
} from "../../config/featureFlags.js";
import {
  attemptDeveloperWebhookDelivery,
  loadDeveloperWebhookDelivery,
} from "./developerWebhookDelivery.js";
import {
  attemptLegacyWebhookDelivery,
  loadLegacyWebhookEvent,
} from "./legacyWebhookDelivery.js";
import {
  computeWebhookNextRetryAt,
  DEFAULT_MAX_WEBHOOK_ATTEMPTS,
  DEVELOPER_POLL_STATUSES,
  LEGACY_POLL_STATUSES,
  STALE_WEBHOOK_PROCESSING_MS,
  WEBHOOK_DELIVERY_STATUS,
  workerBatchSize,
} from "./webhookConstants.js";


let lastRunAt = null;

function auditWebhook(action, entityType, entityId, metadata = {}) {
  writeAuditLog({
    actorRole: "system",
    action,
    entityType,
    entityId,
    metadata,
  }).catch(() => {});
}

export async function recoverStaleWebhookProcessing() {
  const cutoff = new Date(Date.now() - STALE_WEBHOOK_PROCESSING_MS);
  const [legacy, developer] = await Promise.all([
    prisma.practiceWebhookEvent.updateMany({
      where: {
        status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
        processingAt: { lt: cutoff },
      },
      data: {
        status: WEBHOOK_DELIVERY_STATUS.RETRYING,
        processingAt: null,
      },
    }),
    prisma.practiceWebhookDelivery.updateMany({
      where: {
        status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
        processingAt: { lt: cutoff },
      },
      data: {
        status: WEBHOOK_DELIVERY_STATUS.RETRYING,
        processingAt: null,
      },
    }),
  ]);
  return legacy.count + developer.count;
}

function dueRetryFilter(now) {
  return {
    OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
  };
}

async function claimLegacyEvent(eventId, now) {
  const claimed = await prisma.practiceWebhookEvent.updateMany({
    where: {
      id: eventId,
      status: { in: [...LEGACY_POLL_STATUSES] },
      ...dueRetryFilter(now),
    },
    data: {
      status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
      processingAt: now,
    },
  });
  return claimed.count === 1;
}

async function claimDeveloperDelivery(deliveryId, now) {
  const claimed = await prisma.practiceWebhookDelivery.updateMany({
    where: {
      id: deliveryId,
      status: { in: [...DEVELOPER_POLL_STATUSES] },
      ...dueRetryFilter(now),
    },
    data: {
      status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
      processingAt: now,
    },
  });
  return claimed.count === 1;
}

/**
 * @param {string} eventId
 */
export async function processLegacyWebhookEvent(eventId) {
  const event = await loadLegacyWebhookEvent(eventId);
  if (!event) return { ok: false, reason: "not_found" };
  if (event.status === WEBHOOK_DELIVERY_STATUS.DELIVERED) {
    return { ok: true, alreadyDelivered: true };
  }
  if (event.status !== WEBHOOK_DELIVERY_STATUS.PROCESSING) {
    return { ok: false, reason: "not_processing" };
  }

  auditWebhook("webhook.delivery.started", "PracticeWebhookEvent", eventId, {
    system: "legacy",
    eventType: event.eventType,
  });

  const result = await attemptLegacyWebhookDelivery(event);
  const attempts = event.attempts + 1;

  if (result.skipped) {
    await prisma.practiceWebhookEvent.updateMany({
      where: { id: eventId, status: WEBHOOK_DELIVERY_STATUS.PROCESSING },
      data: {
        status: WEBHOOK_DELIVERY_STATUS.SKIPPED,
        attempts,
        lastError: result.reason?.slice(0, 120) || "skipped",
        processingAt: null,
        nextRetryAt: null,
      },
    });
    return { ok: true, skipped: true };
  }

  if (result.ok) {
    const updated = await prisma.practiceWebhookEvent.updateMany({
      where: { id: eventId, status: WEBHOOK_DELIVERY_STATUS.PROCESSING },
      data: {
        status: WEBHOOK_DELIVERY_STATUS.DELIVERED,
        attempts,
        deliveredAt: new Date(),
        lastError: null,
        lastStatusCode: result.statusCode ?? null,
        processingAt: null,
        nextRetryAt: null,
      },
    });
    if (updated.count === 1) {
      auditWebhook("webhook.delivery.delivered", "PracticeWebhookEvent", eventId, {
        system: "legacy",
        statusCode: result.statusCode,
      });
    }
    return { ok: true, delivered: updated.count === 1 };
  }

  if (result.terminal) {
    await prisma.practiceWebhookEvent.updateMany({
      where: { id: eventId, status: WEBHOOK_DELIVERY_STATUS.PROCESSING },
      data: {
        status: WEBHOOK_DELIVERY_STATUS.FAILED,
        attempts,
        lastError: result.errorCode?.slice(0, 120),
        lastStatusCode: result.statusCode ?? null,
        processingAt: null,
        nextRetryAt: null,
      },
    });
    auditWebhook("webhook.delivery.failed", "PracticeWebhookEvent", eventId, {
      system: "legacy",
      errorCode: result.errorCode,
    });
    return { ok: false, failed: true };
  }

  if (attempts >= DEFAULT_MAX_WEBHOOK_ATTEMPTS) {
    await prisma.practiceWebhookEvent.updateMany({
      where: { id: eventId, status: WEBHOOK_DELIVERY_STATUS.PROCESSING },
      data: {
        status: WEBHOOK_DELIVERY_STATUS.DEAD_LETTER,
        attempts,
        lastError: result.errorCode?.slice(0, 120),
        lastStatusCode: result.statusCode ?? null,
        processingAt: null,
        nextRetryAt: null,
      },
    });
    auditWebhook("webhook.delivery.dead_letter", "PracticeWebhookEvent", eventId, {
      system: "legacy",
      attemptCount: attempts,
      errorCode: result.errorCode,
    });
    return { ok: false, deadLetter: true };
  }

  const nextRetryAt = computeWebhookNextRetryAt(attempts);
  await prisma.practiceWebhookEvent.updateMany({
    where: { id: eventId, status: WEBHOOK_DELIVERY_STATUS.PROCESSING },
    data: {
      status: WEBHOOK_DELIVERY_STATUS.RETRYING,
      attempts,
      lastError: result.errorCode?.slice(0, 120),
      lastStatusCode: result.statusCode ?? null,
      processingAt: null,
      nextRetryAt,
    },
  });
  auditWebhook("webhook.delivery.retry_scheduled", "PracticeWebhookEvent", eventId, {
    system: "legacy",
    attemptCount: attempts,
    nextRetryAt: nextRetryAt.toISOString(),
  });
  return { ok: false, retrying: true, nextRetryAt };
}

/**
 * @param {string} deliveryId
 */
export async function processDeveloperWebhookDelivery(deliveryId) {
  const delivery = await loadDeveloperWebhookDelivery(deliveryId);
  if (!delivery?.endpoint) return { ok: false, reason: "not_found" };
  if (delivery.status === WEBHOOK_DELIVERY_STATUS.DELIVERED) {
    return { ok: true, alreadyDelivered: true };
  }
  if (delivery.status !== WEBHOOK_DELIVERY_STATUS.PROCESSING) {
    return { ok: false, reason: "not_processing" };
  }

  auditWebhook("webhook.delivery.started", "PracticeWebhookDelivery", deliveryId, {
    system: "developer",
    eventType: delivery.eventType,
    endpointId: delivery.endpointId,
  });

  const result = await attemptDeveloperWebhookDelivery(delivery);
  const maxAttempts = delivery.maxAttempts || DEFAULT_MAX_WEBHOOK_ATTEMPTS;
  const attemptCount = delivery.attemptCount + 1;

  if (result.skipped) {
    await prisma.practiceWebhookDelivery.updateMany({
      where: { id: deliveryId, status: WEBHOOK_DELIVERY_STATUS.PROCESSING },
      data: {
        status: WEBHOOK_DELIVERY_STATUS.CANCELLED,
        attemptCount,
        lastErrorCode: result.reason?.slice(0, 80),
        processingAt: null,
        nextRetryAt: null,
      },
    });
    return { ok: true, skipped: true };
  }

  if (result.cancel) {
    await prisma.practiceWebhookDelivery.updateMany({
      where: { id: deliveryId, status: WEBHOOK_DELIVERY_STATUS.PROCESSING },
      data: {
        status: WEBHOOK_DELIVERY_STATUS.CANCELLED,
        attemptCount,
        lastStatusCode: result.statusCode ?? null,
        lastErrorCode: result.errorCode?.slice(0, 80),
        processingAt: null,
        nextRetryAt: null,
      },
    });
    await prisma.practiceWebhookEndpoint.update({
      where: { id: delivery.endpointId },
      data: { lastFailureAt: new Date() },
    });
    auditWebhook("webhook.delivery.failed", "PracticeWebhookDelivery", deliveryId, {
      system: "developer",
      errorCode: result.errorCode,
    });
    return { ok: false, cancelled: true };
  }

  if (result.ok) {
    const updated = await prisma.practiceWebhookDelivery.updateMany({
      where: { id: deliveryId, status: WEBHOOK_DELIVERY_STATUS.PROCESSING },
      data: {
        status: WEBHOOK_DELIVERY_STATUS.DELIVERED,
        attemptCount,
        lastStatusCode: result.statusCode ?? null,
        lastErrorCode: null,
        deliveredAt: new Date(),
        processingAt: null,
        nextRetryAt: null,
      },
    });
    if (updated.count === 1) {
      await prisma.practiceWebhookEndpoint.update({
        where: { id: delivery.endpointId },
        data: { lastSuccessAt: new Date() },
      });
      auditWebhook("webhook.delivery.delivered", "PracticeWebhookDelivery", deliveryId, {
        system: "developer",
        statusCode: result.statusCode,
      });
    }
    return { ok: true, delivered: updated.count === 1 };
  }

  if (result.terminal) {
    await prisma.practiceWebhookDelivery.updateMany({
      where: { id: deliveryId, status: WEBHOOK_DELIVERY_STATUS.PROCESSING },
      data: {
        status: WEBHOOK_DELIVERY_STATUS.FAILED,
        attemptCount,
        lastStatusCode: result.statusCode ?? null,
        lastErrorCode: result.errorCode?.slice(0, 80),
        processingAt: null,
        nextRetryAt: null,
      },
    });
    auditWebhook("webhook.delivery.failed", "PracticeWebhookDelivery", deliveryId, {
      system: "developer",
      errorCode: result.errorCode,
    });
    return { ok: false, failed: true };
  }

  if (attemptCount >= maxAttempts) {
    await prisma.practiceWebhookDelivery.updateMany({
      where: { id: deliveryId, status: WEBHOOK_DELIVERY_STATUS.PROCESSING },
      data: {
        status: WEBHOOK_DELIVERY_STATUS.DEAD_LETTER,
        attemptCount,
        lastStatusCode: result.statusCode ?? null,
        lastErrorCode: result.errorCode?.slice(0, 80),
        processingAt: null,
        nextRetryAt: null,
      },
    });
    await prisma.practiceWebhookEndpoint.update({
      where: { id: delivery.endpointId },
      data: { lastFailureAt: new Date() },
    });
    auditWebhook("webhook.delivery.dead_letter", "PracticeWebhookDelivery", deliveryId, {
      system: "developer",
      attemptCount,
      errorCode: result.errorCode,
    });
    return { ok: false, deadLetter: true };
  }

  const nextRetryAt = computeWebhookNextRetryAt(attemptCount);
  await prisma.practiceWebhookDelivery.updateMany({
    where: { id: deliveryId, status: WEBHOOK_DELIVERY_STATUS.PROCESSING },
    data: {
      status: WEBHOOK_DELIVERY_STATUS.RETRYING,
      attemptCount,
      lastStatusCode: result.statusCode ?? null,
      lastErrorCode: result.errorCode?.slice(0, 80),
      processingAt: null,
      nextRetryAt,
    },
  });
  auditWebhook("webhook.delivery.retry_scheduled", "PracticeWebhookDelivery", deliveryId, {
    system: "developer",
    attemptCount,
    nextRetryAt: nextRetryAt.toISOString(),
  });
  return { ok: false, retrying: true, nextRetryAt };
}

/**
 * @param {{ limit?: number }} [opts]
 */
export async function runWebhookWorker(opts = {}) {
  const limit = opts.limit ?? workerBatchSize();
  const now = new Date();
  const staleRecovered = await recoverStaleWebhookProcessing();

  const stats = {
    legacyScanned: 0,
    developerScanned: 0,
    claimed: 0,
    delivered: 0,
    retryScheduled: 0,
    failed: 0,
    deadLetter: 0,
    skipped: 0,
    cancelled: 0,
    staleRecovered,
  };

  const legacyDue = await prisma.practiceWebhookEvent.findMany({
    where: {
      status: { in: [...LEGACY_POLL_STATUSES] },
      ...dueRetryFilter(now),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const devLimit = isPracticeWebhooksEnabled()
    ? limit
    : 0;
  const developerDue = devLimit
    ? await prisma.practiceWebhookDelivery.findMany({
        where: {
          status: { in: [...DEVELOPER_POLL_STATUSES] },
          ...dueRetryFilter(now),
        },
        orderBy: { createdAt: "asc" },
        take: devLimit,
        select: { id: true },
      })
    : [];

  stats.legacyScanned = legacyDue.length;
  stats.developerScanned = developerDue.length;

  for (const row of legacyDue) {
    if (!(await claimLegacyEvent(row.id, now))) continue;
    stats.claimed += 1;
    const outcome = await processLegacyWebhookEvent(row.id);
    if (outcome.delivered) stats.delivered += 1;
    else if (outcome.skipped) stats.skipped += 1;
    else if (outcome.retrying) stats.retryScheduled += 1;
    else if (outcome.deadLetter) stats.deadLetter += 1;
    else if (outcome.failed) stats.failed += 1;
  }

  for (const row of developerDue) {
    if (!(await claimDeveloperDelivery(row.id, now))) continue;
    stats.claimed += 1;
    const outcome = await processDeveloperWebhookDelivery(row.id);
    if (outcome.delivered) stats.delivered += 1;
    else if (outcome.skipped || outcome.alreadyDelivered) stats.skipped += 1;
    else if (outcome.retrying) stats.retryScheduled += 1;
    else if (outcome.deadLetter) stats.deadLetter += 1;
    else if (outcome.failed || outcome.cancelled) stats.failed += 1;
    if (outcome.cancelled) stats.cancelled += 1;
  }

  lastRunAt = new Date();
  return stats;
}

export async function getWebhookWorkerStatus() {
  const now = new Date();
  const dueFilter = dueRetryFilter(now);

  const [
    legacyPending,
    legacyRetrying,
    legacyFailed,
    legacyDeadLetter,
    developerPending,
    developerRetrying,
    developerFailed,
    developerDeadLetter,
    developerProcessing,
  ] = await Promise.all([
    prisma.practiceWebhookEvent.count({
      where: { status: WEBHOOK_DELIVERY_STATUS.PENDING, ...dueFilter },
    }),
    prisma.practiceWebhookEvent.count({
      where: { status: WEBHOOK_DELIVERY_STATUS.RETRYING, ...dueFilter },
    }),
    prisma.practiceWebhookEvent.count({
      where: { status: WEBHOOK_DELIVERY_STATUS.FAILED },
    }),
    prisma.practiceWebhookEvent.count({
      where: { status: WEBHOOK_DELIVERY_STATUS.DEAD_LETTER },
    }),
    prisma.practiceWebhookDelivery.count({
      where: { status: WEBHOOK_DELIVERY_STATUS.PENDING, ...dueFilter },
    }),
    prisma.practiceWebhookDelivery.count({
      where: { status: WEBHOOK_DELIVERY_STATUS.RETRYING, ...dueFilter },
    }),
    prisma.practiceWebhookDelivery.count({
      where: { status: WEBHOOK_DELIVERY_STATUS.FAILED },
    }),
    prisma.practiceWebhookDelivery.count({
      where: { status: WEBHOOK_DELIVERY_STATUS.DEAD_LETTER },
    }),
    prisma.practiceWebhookDelivery.count({
      where: { status: WEBHOOK_DELIVERY_STATUS.PROCESSING },
    }),
  ]);

  return {
    legacy: {
      pending: legacyPending,
      retrying: legacyRetrying,
      failed: legacyFailed,
      deadLetter: legacyDeadLetter,
    },
    developer: {
      pending: developerPending,
      retrying: developerRetrying,
      failed: developerFailed,
      deadLetter: developerDeadLetter,
      processing: developerProcessing,
    },
    lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
    webhooksEnabled: isPracticeWebhooksEnabled(),
    batchSize: workerBatchSize(),
  };
}
