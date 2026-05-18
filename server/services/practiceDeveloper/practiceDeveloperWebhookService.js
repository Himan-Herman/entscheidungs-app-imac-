/**
 * Multi-endpoint practice webhooks — HMAC-signed, metadata-only payloads.
 */

import crypto from "crypto";
import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";
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
import {
  isPracticeWebhooksEnabled,
  isWebhookHealthDataPayloadsEnabled,
} from "../../config/featureFlags.js";

const prisma = new PrismaClient();

const MAX_ATTEMPTS = 5;
const TIMEOUT_MS = 8000;
const BACKOFF_MS = [500, 1500, 4000, 9000, 20000];

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

function pseudonymizePatientId(practiceProfileId, patientUserId) {
  if (!patientUserId || isWebhookHealthDataPayloadsEnabled()) return undefined;
  return crypto
    .createHmac("sha256", String(practiceProfileId))
    .update(String(patientUserId))
    .digest("hex")
    .slice(0, 24);
}

export function buildDeveloperWebhookPayload(practiceProfileId, eventType, meta = {}) {
  const eventId = meta.eventId || crypto.randomUUID();
  return {
    eventId,
    eventType,
    occurredAt: new Date().toISOString(),
    practiceProfileId,
    resourceType: meta.resourceType || null,
    resourceId: meta.resourceId || null,
    practicePatientLinkId: meta.practicePatientLinkId || null,
    patientRef: pseudonymizePatientId(practiceProfileId, meta.patientUserId),
    schemaVersion: 1,
    test: Boolean(meta.test),
    message: meta.message || undefined,
  };
}

function signPayload(secret, timestamp, rawBody) {
  const base = `${timestamp}.${rawBody}`;
  return crypto.createHmac("sha256", secret).update(base).digest("hex");
}

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

  const payload = buildDeveloperWebhookPayload(practiceProfileId, eventType, meta);
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

    const delivery = await prisma.practiceWebhookDelivery.create({
      data: {
        endpointId: ep.id,
        practiceProfileId,
        eventType,
        status: "pending",
        eventId: payload.eventId,
      },
    });
    deliveries.push(delivery);
    setImmediate(() => {
      deliverPracticeDeveloperWebhook(delivery.id).catch(() => {});
    });
  }

  return deliveries;
}

export async function deliverPracticeDeveloperWebhook(deliveryId) {
  const delivery = await prisma.practiceWebhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  if (!delivery?.endpoint) return { ok: false, reason: "not_found" };

  const ep = delivery.endpoint;
  if (ep.status !== "active") {
    await prisma.practiceWebhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "cancelled", lastErrorCode: "endpoint_inactive" },
    });
    return { ok: false, reason: "inactive" };
  }

  const secret = decryptWebhookSecretFromStorage(ep.secretEnc);
  if (!secret) {
    await prisma.practiceWebhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "failed", lastErrorCode: "secret_unavailable" },
    });
    return { ok: false, reason: "secret" };
  }

  const payload = buildDeveloperWebhookPayload(
    delivery.practiceProfileId,
    delivery.eventType,
    { eventId: delivery.eventId },
  );
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signPayload(secret, timestamp, rawBody);

  let lastCode = null;
  let lastErr = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
      const res = await fetch(ep.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-MedScoutX-Event-Id": delivery.eventId,
          "X-MedScoutX-Timestamp": timestamp,
          "X-MedScoutX-Signature": signature,
          "X-MedScoutX-Event": delivery.eventType,
        },
        body: rawBody,
        signal: ac.signal,
      });
      clearTimeout(t);
      lastCode = res.status;

      if (res.status >= 200 && res.status < 300) {
        await prisma.practiceWebhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: "delivered",
            attemptCount: attempt + 1,
            lastStatusCode: res.status,
            deliveredAt: new Date(),
            lastErrorCode: null,
            nextRetryAt: null,
          },
        });
        await prisma.practiceWebhookEndpoint.update({
          where: { id: ep.id },
          data: { lastSuccessAt: new Date() },
        });
        return { ok: true, statusCode: res.status };
      }

      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        await prisma.practiceWebhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: "cancelled",
            attemptCount: attempt + 1,
            lastStatusCode: res.status,
            lastErrorCode: `http_${res.status}`,
          },
        });
        await prisma.practiceWebhookEndpoint.update({
          where: { id: ep.id },
          data: { lastFailureAt: new Date() },
        });
        return { ok: false, reason: `http_${res.status}` };
      }

      lastErr = `http_${res.status}`;
    } catch (e) {
      lastErr = e?.name === "AbortError" ? "timeout" : "network_error";
    }

    const nextRetry = new Date(Date.now() + (BACKOFF_MS[attempt] ?? 10000));
    await prisma.practiceWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: attempt < MAX_ATTEMPTS - 1 ? "retrying" : "failed",
        attemptCount: attempt + 1,
        lastStatusCode: lastCode,
        lastErrorCode: lastErr,
        nextRetryAt: attempt < MAX_ATTEMPTS - 1 ? nextRetry : null,
      },
    });

    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt] ?? 1000));
    }
  }

  await prisma.practiceWebhookEndpoint.update({
    where: { id: ep.id },
    data: { lastFailureAt: new Date() },
  });

  return { ok: false, reason: lastErr };
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
