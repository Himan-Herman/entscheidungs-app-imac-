/**
 * Practice webhook queue + HMAC-signed delivery.
 * Never logs payload body, secrets, or clinical text.
 *
 * Delivery is processed by the webhook worker (cron). No inline HTTP retries.
 */

import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import {
  PracticeWebhookEventType,
  PRACTICE_WEBHOOK_EVENT_TYPES,
} from "../constants/practiceIntegrationWebhookEvents.js";
import {
  processLegacyWebhookEvent,
} from "./webhooks/webhookWorker.js";
import { LEGACY_POLL_STATUSES, WEBHOOK_DELIVERY_STATUS } from "./webhooks/webhookConstants.js";


export const PRACTICE_WEBHOOK_HTTP_ENABLED =
  process.env.PRACTICE_WEBHOOK_HTTP_ENABLED === "true";

/**
 * Safe envelope — ids / timestamps / language only by contract.
 */
export function buildSafeWebhookPayload(practiceProfileId, eventType, data = {}) {
  return {
    practiceProfileId,
    event: eventType,
    emittedAt: new Date().toISOString(),
    schemaVersion: 1,
    data: {
      ...data,
    },
  };
}

export function signBodyHmacSha256(secret, rawBody) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

export async function enqueuePracticeWebhook({
  practiceProfileId,
  eventType,
  payload = {},
}) {
  if (!PRACTICE_WEBHOOK_EVENT_TYPES.includes(eventType)) {
    throw new Error("invalid_event_type");
  }
  const row = await prisma.practiceWebhookEvent.create({
    data: {
      practiceProfileId,
      eventType,
      payload,
      status: WEBHOOK_DELIVERY_STATUS.PENDING,
      attempts: 0,
    },
  });
  return row;
}

/**
 * Process one legacy webhook event (single worker attempt). Prefer cron worker for production.
 */
export async function deliverPracticeWebhook(eventId) {
  const event = await prisma.practiceWebhookEvent.findUnique({
    where: { id: eventId },
    select: { id: true, status: true },
  });
  if (!event) return { ok: false, reason: "not_found" };

  const terminal = new Set([
    WEBHOOK_DELIVERY_STATUS.DELIVERED,
    WEBHOOK_DELIVERY_STATUS.SKIPPED,
    WEBHOOK_DELIVERY_STATUS.DEAD_LETTER,
    WEBHOOK_DELIVERY_STATUS.FAILED,
  ]);
  if (terminal.has(event.status)) {
    return { ok: event.status === WEBHOOK_DELIVERY_STATUS.DELIVERED };
  }

  const now = new Date();
  if (LEGACY_POLL_STATUSES.includes(event.status)) {
    const claimed = await prisma.practiceWebhookEvent.updateMany({
      where: {
        id: eventId,
        status: { in: [...LEGACY_POLL_STATUSES] },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      data: {
        status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
        processingAt: now,
      },
    });
    if (claimed.count !== 1) {
      return { ok: false, reason: "not_claimed" };
    }
  } else if (event.status !== WEBHOOK_DELIVERY_STATUS.PROCESSING) {
    return { ok: false, reason: "invalid_status" };
  }

  return processLegacyWebhookEvent(eventId);
}

export { PracticeWebhookEventType };
