/**
 * Multi-endpoint practice webhooks — HMAC-signed, metadata-only payloads.
 * Delivery is processed by the webhook worker (cron).
 */

import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { buildDeveloperWebhookPayload } from "../webhooks/developerWebhookPayload.js";
import {
  PRACTICE_DEVELOPER_WEBHOOK_EVENTS,
  PracticeDeveloperWebhookEvent,
} from "../../constants/practiceDeveloperApi.js";
import {
  decryptWebhookSecretFromStorage,
  encryptWebhookSecretForStorage,
  fingerprintWebhookSecret,
} from "../../utils/integrationCrypto.js";
import {
  generateAccessToken,
  hashAccessToken,
} from "../../utils/telemedicineTokens.js";
import { isPracticeWebhooksEnabled } from "../../config/featureFlags.js";
import {
  DEVELOPER_POLL_STATUSES,
  WEBHOOK_DELIVERY_STATUS,
} from "../webhooks/webhookConstants.js";
import { processDeveloperWebhookDelivery } from "../webhooks/webhookWorker.js";

const prisma = new PrismaClient();

export function isWebhookUrlAllowed(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.protocol === "http:") {
      const host = u.hostname.toLowerCase();
      const dev = process.env.NODE_ENV !== "production";
      if (!dev) return false;
      if (host !== "localhost" && host !== "127.0.0.1") return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function generateWebhookSecret() {
  return generateAccessToken();
}

export function storeWebhookSecretFields(plainSecret) {
  return {
    secretHash: fingerprintWebhookSecret(plainSecret),
    secretEnc: encryptWebhookSecretForStorage(plainSecret),
  };
}

export { buildDeveloperWebhookPayload } from "../webhooks/developerWebhookPayload.js";

/**
 * @param {string} practiceProfileId
 * @param {string} eventType
 * @param {object} meta
 */
export async function emitPracticeDeveloperWebhook(practiceProfileId, eventType, meta = {}) {
  if (!isPracticeWebhooksEnabled()) return [];
  if (!PRACTICE_DEVELOPER_WEBHOOK_EVENTS.includes(eventType)) return [];

  const endpoints = await prisma.practiceWebhookEndpoint.findMany({
    where: {
      practiceProfileId,
      status: "active",
    },
  });

  const deliveries = [];

  for (const ep of endpoints) {
    if (meta.endpointId && ep.id !== meta.endpointId) continue;
    const types = Array.isArray(ep.eventTypesJson) ? ep.eventTypesJson : [];
    if (
      !types.includes(eventType) &&
      eventType !== PracticeDeveloperWebhookEvent.TEST_PING
    ) {
      continue;
    }

    const eventId = crypto.randomUUID();
    const payload = buildDeveloperWebhookPayload(practiceProfileId, eventType, {
      ...meta,
      eventId,
    });

    const delivery = await prisma.practiceWebhookDelivery.create({
      data: {
        endpointId: ep.id,
        practiceProfileId,
        eventType,
        status: WEBHOOK_DELIVERY_STATUS.PENDING,
        eventId,
        payloadJson: payload,
      },
    });
    deliveries.push(delivery);
  }

  return deliveries;
}

/**
 * Process one developer delivery (single worker attempt).
 */
export async function deliverPracticeDeveloperWebhook(deliveryId) {
  const delivery = await prisma.practiceWebhookDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, status: true },
  });
  if (!delivery) return { ok: false, reason: "not_found" };

  const terminal = new Set([
    WEBHOOK_DELIVERY_STATUS.DELIVERED,
    WEBHOOK_DELIVERY_STATUS.CANCELLED,
    WEBHOOK_DELIVERY_STATUS.DEAD_LETTER,
    WEBHOOK_DELIVERY_STATUS.FAILED,
  ]);
  if (terminal.has(delivery.status)) {
    return { ok: delivery.status === WEBHOOK_DELIVERY_STATUS.DELIVERED };
  }

  const now = new Date();
  if (DEVELOPER_POLL_STATUSES.includes(delivery.status)) {
    const claimed = await prisma.practiceWebhookDelivery.updateMany({
      where: {
        id: deliveryId,
        status: { in: [...DEVELOPER_POLL_STATUSES] },
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
  } else if (delivery.status !== WEBHOOK_DELIVERY_STATUS.PROCESSING) {
    return { ok: false, reason: "invalid_status" };
  }

  return processDeveloperWebhookDelivery(deliveryId);
}

export async function sendTestWebhook(endpointId, practiceProfileId) {
  return emitPracticeDeveloperWebhook(practiceProfileId, PracticeDeveloperWebhookEvent.TEST_PING, {
    test: true,
    message: "test",
    resourceType: "webhook_endpoint",
    resourceId: endpointId,
    endpointId,
  });
}
