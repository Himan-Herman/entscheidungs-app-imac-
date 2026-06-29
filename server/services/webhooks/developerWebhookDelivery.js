import { prisma } from "../../lib/prisma.js";
import { isPracticeWebhooksEnabled } from "../../config/featureFlags.js";
import { decryptWebhookSecretFromStorage } from "../../utils/integrationCrypto.js";
import { buildDeveloperWebhookPayload } from "./developerWebhookPayload.js";
import { postWebhookOnce } from "./webhookHttp.js";
import { classifyWebhookHttpResult } from "./webhookConstants.js";
import { signDeveloperWebhook } from "./webhookSigning.js";


/**
 * @param {import('@prisma/client').PracticeWebhookDelivery & { endpoint?: object | null }} delivery
 */
export function resolveDeveloperPayload(delivery) {
  if (
    delivery.payloadJson &&
    typeof delivery.payloadJson === "object" &&
    delivery.payloadJson !== null
  ) {
    return delivery.payloadJson;
  }
  return buildDeveloperWebhookPayload(
    delivery.practiceProfileId,
    delivery.eventType,
    { eventId: delivery.eventId },
  );
}

/**
 * One HTTP attempt for developer webhook delivery.
 * @param {import('@prisma/client').PracticeWebhookDelivery & { endpoint: object }} delivery
 */
export async function attemptDeveloperWebhookDelivery(delivery) {
  if (!isPracticeWebhooksEnabled()) {
    return {
      ok: true,
      skipped: true,
      reason: "webhooks_disabled",
      retryable: false,
    };
  }

  const ep = delivery.endpoint;
  if (!ep || ep.status !== "active") {
    return {
      ok: false,
      skipped: false,
      retryable: false,
      terminal: true,
      errorCode: "endpoint_inactive",
      cancel: true,
    };
  }

  const secret = decryptWebhookSecretFromStorage(ep.secretEnc);
  if (!secret) {
    return {
      ok: false,
      skipped: false,
      retryable: false,
      terminal: true,
      errorCode: "secret_unavailable",
    };
  }

  const payload = resolveDeveloperPayload(delivery);
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signDeveloperWebhook(secret, timestamp, rawBody);

  const { statusCode, networkError } = await postWebhookOnce({
    url: ep.url,
    headers: {
      "X-MedScoutX-Event-Id": delivery.eventId,
      "X-MedScoutX-Timestamp": timestamp,
      "X-MedScoutX-Signature": signature,
      "X-MedScoutX-Event": delivery.eventType,
    },
    body: rawBody,
  });

  const classified = classifyWebhookHttpResult(statusCode, networkError);
  if (classified.success) {
    console.info(
      JSON.stringify({
        level: "info",
        event: "developer_webhook_http_ok",
        deliveryId: delivery.id,
        endpointId: ep.id,
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

  if (classified.terminal) {
    return {
      ok: false,
      skipped: false,
      statusCode,
      retryable: false,
      terminal: true,
      errorCode: classified.errorCode,
      cancel: statusCode != null && statusCode >= 400 && statusCode < 500,
    };
  }

  return {
    ok: false,
    skipped: false,
    statusCode,
    retryable: classified.retryable,
    terminal: false,
    errorCode: classified.errorCode,
  };
}

/**
 * @param {string} deliveryId
 */
export async function loadDeveloperWebhookDelivery(deliveryId) {
  return prisma.practiceWebhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
}
