/**
 * Practice webhook queue + HMAC-signed delivery.
 * Never logs payload body, secrets, or clinical text.
 */

import crypto from "crypto";
import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";
import {
  PracticeWebhookEventType,
  PRACTICE_WEBHOOK_EVENT_TYPES,
} from "../constants/practiceIntegrationWebhookEvents.js";
import { decryptWebhookSecretFromStorage } from "../utils/integrationCrypto.js";

const prisma = new PrismaClient();

export const PRACTICE_WEBHOOK_HTTP_ENABLED =
  process.env.PRACTICE_WEBHOOK_HTTP_ENABLED === "true";

const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 12000;
const BACKOFF_MS = [400, 1200, 2800];

function signBodyHmacSha256(secret, rawBody) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

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
      status: "pending",
      attempts: 0,
    },
  });
  setImmediate(() => {
    deliverPracticeWebhook(row.id).catch(() => {});
  });
  return row;
}

export async function deliverPracticeWebhook(eventId) {
  const row = await prisma.practiceWebhookEvent.findUnique({
    where: { id: eventId },
    include: {
      practiceProfile: { include: { integrationSettings: true } },
    },
  });
  if (!row) return { ok: false, reason: "not_found" };

  const settings = row.practiceProfile?.integrationSettings;
  const url = settings?.webhookUrl?.trim();
  const enc = settings?.webhookSecretEnc;

  if (!settings?.webhookEnabled || !url || !enc) {
    await prisma.practiceWebhookEvent.update({
      where: { id: eventId },
      data: {
        status: "skipped",
        lastError: "webhook_not_configured",
        deliveredAt: null,
      },
    });
    return { ok: true, skipped: true };
  }

  if (!PRACTICE_WEBHOOK_HTTP_ENABLED) {
    await prisma.practiceWebhookEvent.update({
      where: { id: eventId },
      data: {
        status: "skipped",
        lastError: "http_delivery_disabled",
      },
    });
    return { ok: true, skipped: true };
  }

  const plainSecret = decryptWebhookSecretFromStorage(enc);
  if (!plainSecret) {
    await prisma.practiceWebhookEvent.update({
      where: { id: eventId },
      data: {
        status: "failed",
        lastError: "secret_decrypt_failed",
      },
    });
    return { ok: false, reason: "decrypt" };
  }

  const envelope = buildSafeWebhookPayload(
    row.practiceProfileId,
    row.eventType,
    typeof row.payload === "object" && row.payload !== null ? row.payload : {},
  );
  const rawBody = JSON.stringify(envelope);
  const sig = signBodyHmacSha256(plainSecret, rawBody);

  let lastErr = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-MedScoutX-Signature": `sha256=${sig}`,
          "X-MedScoutX-Delivery-Id": row.id,
          "X-MedScoutX-Event": row.eventType,
        },
        body: rawBody,
        signal: ac.signal,
      });
      clearTimeout(t);
      if (res.ok) {
        await prisma.practiceWebhookEvent.update({
          where: { id: eventId },
          data: {
            status: "delivered",
            attempts: { increment: attempt + 1 },
            deliveredAt: new Date(),
            lastError: null,
          },
        });
        console.info(
          JSON.stringify({
            level: "info",
            event: "webhook_delivered",
            deliveryId: row.id,
            statusCode: res.status,
          }),
        );
        return { ok: true };
      }
      lastErr = `http_${res.status}`;
    } catch (e) {
      lastErr = e?.name === "AbortError" ? "timeout" : "network_error";
    }
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt] ?? 1000));
    }
  }

  await prisma.practiceWebhookEvent.update({
    where: { id: eventId },
    data: {
      status: "failed",
      attempts: { increment: MAX_ATTEMPTS },
      lastError: lastErr,
    },
  });
  console.info(
    JSON.stringify({
      level: "warn",
      event: "webhook_failed",
      deliveryId: row.id,
      errorCode: lastErr,
    }),
  );
  return { ok: false, reason: lastErr };
}

export { PracticeWebhookEventType };
