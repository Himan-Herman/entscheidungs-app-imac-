import { prisma } from "../../lib/prisma.js";
import { PRACTICE_DEVELOPER_WEBHOOK_EVENTS } from "../../constants/practiceDeveloperApi.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { canManageIntegrations } from "../../utils/practicePermissions.js";
import {
  generateWebhookSecret,
  isWebhookUrlAllowed,
  sendTestWebhook,
  storeWebhookSecretFields,
} from "./practiceDeveloperWebhookService.js";


function normalizeEventTypes(types) {
  const list = Array.isArray(types) ? types : [];
  return list.filter((t) => PRACTICE_DEVELOPER_WEBHOOK_EVENTS.includes(t));
}

export async function listWebhookEndpoints(actorUserId, practiceId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManageIntegrations(access.role)) throw new Error("forbidden");

  const rows = await prisma.practiceWebhookEndpoint.findMany({
    where: { practiceProfileId: practiceId },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    status: r.status,
    eventTypes: r.eventTypesJson,
    lastSuccessAt: r.lastSuccessAt,
    lastFailureAt: r.lastFailureAt,
    createdAt: r.createdAt,
    revokedAt: r.revokedAt,
  }));
}

export async function createWebhookEndpoint(actorUserId, practiceId, body) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManageIntegrations(access.role)) throw new Error("forbidden");

  const name = String(body.name || "").trim().slice(0, 120);
  const url = String(body.url || "").trim();
  if (!name || !url) throw new Error("validation_required");
  if (!isWebhookUrlAllowed(url)) throw new Error("validation_invalid_url");

  const eventTypes = normalizeEventTypes(body.eventTypes);
  if (!eventTypes.length) throw new Error("validation_required");

  const plainSecret = generateWebhookSecret();
  const secretFields = storeWebhookSecretFields(plainSecret);
  if (!secretFields.secretEnc) throw new Error("encryption_not_configured");

  const row = await prisma.practiceWebhookEndpoint.create({
    data: {
      practiceProfileId: practiceId,
      name,
      url,
      status: "active",
      secretHash: secretFields.secretHash,
      secretEnc: secretFields.secretEnc,
      eventTypesJson: eventTypes,
      createdByUserId: actorUserId,
    },
  });

  return {
    endpoint: {
      id: row.id,
      name: row.name,
      url: row.url,
      status: row.status,
      eventTypes: row.eventTypesJson,
      createdAt: row.createdAt,
    },
    signingSecret: plainSecret,
    secretShownOnce: true,
  };
}

export async function updateWebhookEndpoint(actorUserId, practiceId, endpointId, body) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManageIntegrations(access.role)) throw new Error("forbidden");

  const data = {};
  if (body.name) data.name = String(body.name).trim().slice(0, 120);
  if (body.url) {
    const url = String(body.url).trim();
    if (!isWebhookUrlAllowed(url)) throw new Error("validation_invalid_url");
    data.url = url;
  }
  if (body.status && ["active", "paused", "revoked"].includes(body.status)) {
    data.status = body.status;
    if (body.status === "revoked") data.revokedAt = new Date();
  }
  if (body.eventTypes) data.eventTypesJson = normalizeEventTypes(body.eventTypes);

  const row = await prisma.practiceWebhookEndpoint.update({
    where: { id: endpointId, practiceProfileId: practiceId },
    data,
  });

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    status: row.status,
    eventTypes: row.eventTypesJson,
  };
}

export async function listWebhookDeliveries(actorUserId, practiceId, endpointId, limit = 50) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManageIntegrations(access.role)) throw new Error("forbidden");

  const rows = await prisma.practiceWebhookDelivery.findMany({
    where: { practiceProfileId: practiceId, endpointId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });

  return rows.map((r) => ({
    id: r.id,
    eventType: r.eventType,
    status: r.status,
    attemptCount: r.attemptCount,
    lastStatusCode: r.lastStatusCode,
    lastErrorCode: r.lastErrorCode,
    deliveredAt: r.deliveredAt,
    createdAt: r.createdAt,
  }));
}

export async function testWebhookEndpoint(actorUserId, practiceId, endpointId) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManageIntegrations(access.role)) throw new Error("forbidden");

  const ep = await prisma.practiceWebhookEndpoint.findFirst({
    where: { id: endpointId, practiceProfileId: practiceId },
  });
  if (!ep) throw new Error("not_found");

  const deliveries = await sendTestWebhook(endpointId, practiceId);
  return { ok: true, deliveryCount: deliveries.length };
}
