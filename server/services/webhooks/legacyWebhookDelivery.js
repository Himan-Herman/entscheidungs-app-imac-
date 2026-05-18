import { PrismaClient } from "@prisma/client";
import { decryptWebhookSecretFromStorage } from "../../utils/integrationCrypto.js";
import {
  buildSafeWebhookPayload,
  PRACTICE_WEBHOOK_HTTP_ENABLED,
} from "../practiceWebhookService.js";
import { postWebhookOnce } from "./webhookHttp.js";
import { classifyWebhookHttpResult } from "./webhookConstants.js";
import { signLegacyWebhookBody } from "./webhookSigning.js";

const prisma = new PrismaClient();

/**
 * One delivery attempt for a legacy PracticeWebhookEvent (no DB status mutation).
 * @param {import('@prisma/client').PracticeWebhookEvent & { practiceProfile?: object }} event
 */
export async function attemptLegacyWebhookDelivery(event) {
  const settings = event.practiceProfile?.integrationSettings;
  const url = settings?.webhookUrl?.trim();
  const enc = settings?.webhookSecretEnc;

  if (!settings?.webhookEnabled || !url || !enc) {
    return {
      ok: true,
      skipped: true,
      reason: "webhook_not_configured",
      retryable: false,
    };
  }

  if (!PRACTICE_WEBHOOK_HTTP_ENABLED) {
    return {
      ok: true,
      skipped: true,
      reason: "http_delivery_disabled",
      retryable: false,
    };
  }

  const plainSecret = decryptWebhookSecretFromStorage(enc);
  if (!plainSecret) {
    return {
      ok: false,
      skipped: false,
      retryable: false,
      terminal: true,
      errorCode: "secret_decrypt_failed",
    };
  }

  const envelope = buildSafeWebhookPayload(
    event.practiceProfileId,
    event.eventType,
    typeof event.payload === "object" && event.payload !== null ? event.payload : {},
  );
  const rawBody = JSON.stringify(envelope);
  const signature = signLegacyWebhookBody(plainSecret, rawBody);

  const { statusCode, networkError } = await postWebhookOnce({
    url,
    headers: {
      "X-MedScoutX-Signature": signature,
      "X-MedScoutX-Delivery-Id": event.id,
      "X-MedScoutX-Event": event.eventType,
      "X-MedScoutX-Event-Id": event.id,
      "X-MedScoutX-Timestamp": String(Math.floor(Date.now() / 1000)),
    },
    body: rawBody,
  });

  const classified = classifyWebhookHttpResult(statusCode, networkError);
  if (classified.success) {
    console.info(
      JSON.stringify({
        level: "info",
        event: "legacy_webhook_http_ok",
        deliveryId: event.id,
        statusCode,
      }),
    );
    return {
      ok: true,
      skipped: false,
      statusCode,
      retryable: false,
    };
  }

  return {
    ok: false,
    skipped: false,
    statusCode,
    retryable: classified.retryable,
    terminal: classified.terminal,
    errorCode: classified.errorCode,
  };
}

/**
 * Load event with practice integration settings.
 * @param {string} eventId
 */
export async function loadLegacyWebhookEvent(eventId) {
  return prisma.practiceWebhookEvent.findUnique({
    where: { id: eventId },
    include: {
      practiceProfile: { include: { integrationSettings: true } },
    },
  });
}
