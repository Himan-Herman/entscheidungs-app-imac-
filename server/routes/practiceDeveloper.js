import express from "express";
import { requirePracticeDeveloperFeature } from "../middleware/requirePracticeDeveloper.js";
import { getPracticeAccess } from "../utils/practiceAccess.js";
import { canManageIntegrations } from "../utils/practicePermissions.js";
import { writeAuditLog } from "../services/auditLogService.js";
import {
  createApiClient,
  listApiClients,
  revokeApiClient,
} from "../services/practiceDeveloper/practiceApiClientService.js";
import {
  createWebhookEndpoint,
  listWebhookDeliveries,
  listWebhookEndpoints,
  testWebhookEndpoint,
  updateWebhookEndpoint,
} from "../services/practiceDeveloper/practiceWebhookEndpointService.js";
import { API_SCOPES, PRACTICE_DEVELOPER_WEBHOOK_EVENTS } from "../constants/practiceDeveloperApi.js";
import {
  developerAiTestPayload,
  developerAiWebhookExplanation,
} from "../services/practiceDeveloper/practiceDeveloperAiService.js";

const router = express.Router();
router.use(requirePracticeDeveloperFeature);

function pid(req) {
  return String(req.query?.practiceId || req.body?.practiceId || "").trim();
}

async function requireManage(req, res) {
  const userId = req.user?.userId;
  const practiceId = pid(req);
  if (!userId) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return null;
  }
  if (!practiceId) {
    res.status(400).json({ ok: false, error: "validation_required" });
    return null;
  }
  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canManageIntegrations(access.role)) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return null;
  }
  return { userId, practiceId, access };
}

router.get("/meta", async (req, res) => {
  return res.json({
    ok: true,
    scopes: API_SCOPES,
    webhookEvents: PRACTICE_DEVELOPER_WEBHOOK_EVENTS,
  });
});

router.get("/api-clients", async (req, res) => {
  const ctx = await requireManage(req, res);
  if (!ctx) return;
  try {
    const clients = await listApiClients(ctx.userId, ctx.practiceId);
    return res.json({ ok: true, clients });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "request_failed" });
  }
});

router.post("/api-clients", async (req, res) => {
  const ctx = await requireManage(req, res);
  if (!ctx) return;
  try {
    const result = await createApiClient(ctx.userId, ctx.practiceId, req.body || {});
    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_api_client_created",
      entityType: "practice_api_client",
      entityId: result.client.id,
      practiceProfileId: ctx.practiceId,
      metadata: { name: result.client.name },
    });
    return res.status(201).json({ ok: true, ...result });
  } catch (e) {
    if (e.message === "forbidden") return res.status(403).json({ ok: false, error: "forbidden" });
    return res.status(400).json({ ok: false, error: e.message || "request_failed" });
  }
});

router.patch("/api-clients/:clientId/revoke", async (req, res) => {
  const ctx = await requireManage(req, res);
  if (!ctx) return;
  try {
    const client = await revokeApiClient(ctx.userId, ctx.practiceId, req.params.clientId);
    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_api_token_revoked",
      entityType: "practice_api_client",
      entityId: client.id,
      practiceProfileId: ctx.practiceId,
    });
    return res.json({ ok: true, client });
  } catch (e) {
    return res.status(403).json({ ok: false, error: e.message || "forbidden" });
  }
});

router.get("/webhook-endpoints", async (req, res) => {
  const ctx = await requireManage(req, res);
  if (!ctx) return;
  try {
    const endpoints = await listWebhookEndpoints(ctx.userId, ctx.practiceId);
    return res.json({ ok: true, endpoints });
  } catch {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
});

router.post("/webhook-endpoints", async (req, res) => {
  const ctx = await requireManage(req, res);
  if (!ctx) return;
  try {
    const result = await createWebhookEndpoint(ctx.userId, ctx.practiceId, req.body || {});
    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_webhook_endpoint_created",
      entityType: "practice_webhook_endpoint",
      entityId: result.endpoint.id,
      practiceProfileId: ctx.practiceId,
    });
    return res.status(201).json({ ok: true, ...result });
  } catch (e) {
    const status =
      e.message === "encryption_not_configured"
        ? 503
        : e.message === "validation_invalid_url"
          ? 400
          : 500;
    return res.status(status).json({ ok: false, error: e.message || "request_failed" });
  }
});

router.patch("/webhook-endpoints/:endpointId", async (req, res) => {
  const ctx = await requireManage(req, res);
  if (!ctx) return;
  try {
    const endpoint = await updateWebhookEndpoint(
      ctx.userId,
      ctx.practiceId,
      req.params.endpointId,
      req.body || {},
    );
    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_webhook_endpoint_updated",
      entityType: "practice_webhook_endpoint",
      entityId: endpoint.id,
      practiceProfileId: ctx.practiceId,
      metadata: { status: endpoint.status },
    });
    return res.json({ ok: true, endpoint });
  } catch {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
});

router.post("/webhook-endpoints/:endpointId/test", async (req, res) => {
  const ctx = await requireManage(req, res);
  if (!ctx) return;
  try {
    const result = await testWebhookEndpoint(
      ctx.userId,
      ctx.practiceId,
      req.params.endpointId,
    );
    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_webhook_test_sent",
      entityType: "practice_webhook_endpoint",
      entityId: req.params.endpointId,
      practiceProfileId: ctx.practiceId,
    });
    return res.json({ ok: true, ...result });
  } catch {
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

router.get("/webhook-endpoints/:endpointId/deliveries", async (req, res) => {
  const ctx = await requireManage(req, res);
  if (!ctx) return;
  try {
    const deliveries = await listWebhookDeliveries(
      ctx.userId,
      ctx.practiceId,
      req.params.endpointId,
    );
    return res.json({ ok: true, deliveries });
  } catch {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
});

router.post("/ai-webhook-explanation", async (req, res) => {
  const ctx = await requireManage(req, res);
  if (!ctx) return;
  try {
    const result = await developerAiWebhookExplanation(req.body || {}, {
      locale: req.body?.locale,
    });
    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_developer_ai_note",
      practiceProfileId: ctx.practiceId,
    });
    return res.json({ ok: true, ...result });
  } catch {
    return res.status(503).json({ ok: false, error: "ai_not_configured" });
  }
});

router.post("/ai-test-payload", async (req, res) => {
  const ctx = await requireManage(req, res);
  if (!ctx) return;
  try {
    const result = await developerAiTestPayload(req.body || {});
    return res.json({ ok: true, ...result });
  } catch {
    return res.status(503).json({ ok: false, error: "ai_not_configured" });
  }
});

export default router;
