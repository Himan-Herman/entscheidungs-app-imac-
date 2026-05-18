/**
 * PVS / FHIR / HL7 integration layer — sandbox-first; production gated by flags.
 */

import express from "express";
import { requireIntegrationsUi } from "../middleware/requireIntegrations.js";
import { integrationParseLimiter } from "../middleware/ipRateLimit.js";
import {
  createIntegrationConnection,
  createIntegrationJob,
  disableIntegrationConnection,
  getIntegrationJob,
  getIntegrationsOverview,
  listIntegrationJobs,
  patchIntegrationConnection,
  testIntegrationConnection,
} from "../services/integrations/integrationService.js";
import {
  fhirPreview,
  fhirValidate,
  hl7AckPreview,
  hl7Parse,
} from "../services/integrations/integrationPreviewService.js";
import {
  getSandboxOverview,
  runSandboxHl7Parse,
} from "../services/integrations/integrationSandboxService.js";
import {
  explainIntegrationError,
  generateMappingSummary,
} from "../services/integrations/integrationAiService.js";
import { isIntegrationsEnabled } from "../config/featureFlags.js";

const router = express.Router();
router.use(requireIntegrationsUi);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function practiceIdFromQuery(req) {
  const id = req.query?.practiceId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  const forbidden = new Set(["forbidden", "integrations_disabled", "sandbox_disabled", "fhir_disabled", "hl7_disabled"]);
  const notFound = new Set(["practice_not_found", "connection_not_found", "job_not_found", "link_not_found"]);
  const badRequest = new Set([
    "invalid_type",
    "invalid_auth_type",
    "invalid_fhir_version",
    "invalid_status",
    "integration_consent_missing",
    "production_sync_disabled",
    "auto_sync_disabled",
    "payload_too_large",
    "practicePatientLinkId_required",
  ]);
  if (msg === "ai_not_configured") return { status: 503, error: msg };
  if (forbidden.has(msg)) return { status: 403, error: msg };
  if (notFound.has(msg)) return { status: 404, error: msg };
  if (badRequest.has(msg)) return { status: 400, error: msg };
  return { status: 500, error: "request_failed" };
}

router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const overview = await getIntegrationsOverview(userId, practiceId);
    return res.json({ ok: true, ...overview });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const connection = await createIntegrationConnection(userId, practiceId, req.body || {}, {
      req,
    });
    return res.status(201).json({ ok: true, connection });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.get("/jobs", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const jobs = await listIntegrationJobs(userId, practiceId);
    return res.json({ ok: true, jobs });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.get("/jobs/:jobId", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const job = await getIntegrationJob(userId, practiceId, req.params.jobId);
    return res.json({ ok: true, job });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.get("/sandbox", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const sandbox = await getSandboxOverview(userId, practiceId);
    return res.json({ ok: true, ...sandbox });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/sandbox/hl7-parse", integrationParseLimiter, async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const result = await runSandboxHl7Parse(
      userId,
      practiceId,
      req.body?.message,
      { req },
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/fhir/preview", integrationParseLimiter, async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const preview = await fhirPreview(userId, practiceId, req.body || {}, { req });
    return res.json({ ok: true, ...preview });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/fhir/validate", integrationParseLimiter, async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const validation = await fhirValidate(userId, practiceId, req.body || {}, { req });
    return res.json({ ok: true, validation });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/hl7v2/parse", integrationParseLimiter, async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const result = await hl7Parse(userId, practiceId, req.body || {}, { req });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/hl7v2/ack-preview", integrationParseLimiter, async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const result = await hl7AckPreview(userId, practiceId, req.body || {});
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/ai-mapping-summary", integrationParseLimiter, async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const result = await generateMappingSummary(userId, practiceId, req.body || {}, { req });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/ai-error-explanation", integrationParseLimiter, async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const result = await explainIntegrationError(userId, practiceId, req.body || {}, { req });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.get("/:connectionId", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const overview = await getIntegrationsOverview(userId, practiceId);
    const connection = overview.connections.find((c) => c.id === req.params.connectionId);
    if (!connection) return res.status(404).json({ ok: false, error: "connection_not_found" });
    return res.json({ ok: true, connection });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.patch("/:connectionId", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  if (!isIntegrationsEnabled()) {
    return res.status(403).json({ ok: false, error: "integrations_disabled" });
  }
  try {
    const connection = await patchIntegrationConnection(
      userId,
      practiceId,
      req.params.connectionId,
      req.body || {},
      { req },
    );
    return res.json({ ok: true, connection });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.patch("/:connectionId/disable", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const result = await disableIntegrationConnection(
      userId,
      practiceId,
      req.params.connectionId,
      { req },
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/:connectionId/test", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const result = await testIntegrationConnection(
      userId,
      practiceId,
      req.params.connectionId,
      { req },
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/:connectionId/jobs", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const job = await createIntegrationJob(
      userId,
      practiceId,
      req.params.connectionId,
      req.body || {},
      { req },
    );
    return res.status(201).json({ ok: true, job });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
