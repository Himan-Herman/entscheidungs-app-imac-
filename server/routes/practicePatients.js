/**
 * Practice ↔ patient care relationships (Phase 1 — PR-1/2).
 * Routes mounted at /api/practice/patients
 * Requires CARE_RELATIONSHIP_ENABLED=true.
 */

import express from "express";
import { requireCareRelationshipFeature } from "../middleware/requireCareRelationship.js";
import {
  getPracticeAccess,
  canReadPracticePatientLinks,
  canWritePracticePatientLinks,
} from "../utils/practiceAccess.js";
import {
  createPracticePatientLink,
  getPracticePatientLink,
  updatePracticePatientLinkStatus,
  LINK_STATUSES,
} from "../services/careRelationship/practicePatientLinkService.js";
import {
  getPracticePatientRecord,
  getPracticePatientActivity,
  listPreVisitsForPracticePatient,
} from "../services/careRelationship/practicePatientRecordService.js";
import {
  searchPracticePatients,
  searchPracticePatientRecord,
  anonymizeSearchQueryForAudit,
} from "../services/careRelationship/practicePatientSearchService.js";
import { generatePracticePatientSearchAiSuggestion } from "../services/careRelationship/practicePatientSearchAiService.js";
import { createAndRunExportJob } from "../services/export/exportJobService.js";
import { listPracticeLinkConsents } from "../services/consent/consentRecordService.js";
import { practiceExportLimiter } from "../middleware/ipRateLimit.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { generatePracticeLinkActivityAiSummary } from "../services/activity/activityFeedAiService.js";
import { logAccessDenied } from "../services/activity/activityFeedAiService.js";
import practicePatientThreadsRouter from "./practicePatientThreads.js";
import practiceMedicationPlansRouter from "./practiceMedicationPlans.js";
import practiceDocumentsRouter from "./practiceDocuments.js";
import practicePatientProfileRouter from "./practicePatientProfile.js";

const router = express.Router();

router.use(requireCareRelationshipFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required" || msg === "practiceId_required") {
    return { status: 400, error: msg };
  }
  if (msg === "validation_invalid_status" || msg === "validation_invalid_consent_version") {
    return { status: 400, error: msg };
  }
  if (msg === "validation_consent_scopes_required") {
    return { status: 400, error: msg };
  }
  if (msg === "link_not_active") {
    return { status: 409, error: msg };
  }
  if (msg === "consent_required") {
    return { status: 403, error: msg };
  }
  if (msg === "link_already_exists") {
    return { status: 409, error: msg };
  }
  if (
    msg === "link_not_found" ||
    msg === "practice_not_found" ||
    msg === "patient_user_not_found" ||
    msg === "patient_profile_not_found"
  ) {
    return { status: 404, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

/** POST /api/practice/patients/search/ai-filter-suggestion */
router.post("/search/ai-filter-suggestion", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const result = await generatePracticePatientSearchAiSuggestion({
      locale: req.body?.locale || req.query.locale,
      q: req.body?.q,
      activeFilters: req.body?.filters,
    });

    await writeAuditLog({
      req,
      userId,
      actorRole: access.role,
      action: "practice_patient_search_ai_suggestion",
      entityType: "practice_patient_search",
      entityId: practiceId,
      practiceProfileId: practiceId,
      metadata: {
        queryHint: anonymizeSearchQueryForAudit(req.body?.q),
        suggestedKeys: Object.keys(result.suggested || {}),
      },
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[practice/patients/search/ai]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** GET /api/practice/patients?practiceId=&q=&status=&... */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const status = String(req.query.status || "").trim();
  if (status && !LINK_STATUSES.has(status)) {
    return res.status(400).json({ ok: false, error: "validation_invalid_status" });
  }

  try {
    const result = await searchPracticePatients(practiceId, req.query);

    const hasSearchOrFilter = Boolean(
      req.query.q ||
        req.query.status ||
        req.query.profileShared != null ||
        req.query.hasUnreadMessages != null ||
        req.query.hasDocuments != null ||
        req.query.hasMedicationPlan != null ||
        req.query.hasOpenDataRequest != null,
    );

    if (hasSearchOrFilter) {
      await writeAuditLog({
        req,
        userId,
        actorRole: access.role,
        action: "practice_patient_search_executed",
        entityType: "practice_patient_search",
        entityId: practiceId,
        practiceProfileId: practiceId,
        metadata: {
          queryHint: anonymizeSearchQueryForAudit(req.query.q),
          resultCount: result.total,
          filtersApplied: result.filters,
        },
      });
    } else {
      await writeAuditLog({
        req,
        userId,
        actorRole: access.role,
        action: "practice_patient_list_opened",
        entityType: "practice_patient_list",
        entityId: practiceId,
        practiceProfileId: practiceId,
        metadata: { total: result.total },
      });
    }

    return res.json({
      ok: true,
      role: access.role,
      practiceId,
      ...result,
    });
  } catch (err) {
    console.error("[practice/patients/list]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patients/link */
router.post("/link", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.body?.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canWritePracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const link = await createPracticePatientLink({
      practiceProfileId: practiceId,
      patientUserId: req.body?.patientUserId,
      patientProfileId: req.body?.patientProfileId,
      status: req.body?.status,
    });

    await writeAuditLog({
      userId,
      actorRole: access.role,
      action: "practice_patient_link_created",
      entityType: "PracticePatientLink",
      entityId: link.id,
      metadata: { status: link.status },
    });

    return res.status(201).json({ ok: true, link });
  } catch (err) {
    console.error("[practice/patients/link]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** Messaging threads (PR-5) — before /:linkId */
router.use("/:linkId/threads", practicePatientThreadsRouter);
/** Alias: /messages — same router */
router.use("/:linkId/messages", practicePatientThreadsRouter);

/** Medication plans v2 (PR-6) — before /:linkId */
router.use("/:linkId/medication-plans", practiceMedicationPlansRouter);

/** Practice documents (PR-7) — before /:linkId */
router.use("/:linkId/documents", practiceDocumentsRouter);

/** Patient profile read-only (PR-8) — before /:linkId */
router.use("/:linkId/profile", practicePatientProfileRouter);

/** GET /api/practice/patients/:linkId/consents?practiceId= */
router.get("/:linkId/consents", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const consents = await listPracticeLinkConsents(req.params.linkId, practiceId);
    return res.json({ ok: true, consents });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patients/:linkId/export */
router.post("/:linkId/export", practiceExportLimiter, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const link = await getPracticePatientLink(req.params.linkId, practiceId);
    const job = await createAndRunExportJob({
      requestedByUserId: userId,
      actorRole: "practice",
      practiceRole: access.role,
      type: req.body?.type || "patient_summary",
      format: req.body?.format || "pdf",
      locale: req.body?.locale,
      practiceProfileId: practiceId,
      practicePatientLinkId: link.id,
      patientUserId: link.patientUserId,
      req,
    });
    return res.status(201).json({ ok: true, export: job, role: access.role });
  } catch (err) {
    const msg = err?.message || "export_failed";
    if (msg === "forbidden") return res.status(403).json({ ok: false, error: msg });
    if (msg === "link_not_found") return res.status(404).json({ ok: false, error: msg });
    if (msg === "validation_invalid_export_type" || msg === "validation_invalid_format") {
      return res.status(400).json({ ok: false, error: msg });
    }
    console.error("[practice/patients/export]", msg);
    return res.status(500).json({ ok: false, error: "export_failed" });
  }
});

/** GET /api/practice/patients/:linkId/search?practiceId=&q= */
router.get("/:linkId/search", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const result = await searchPracticePatientRecord(
      req.params.linkId,
      practiceId,
      req.query.q,
    );

    if (req.query.q) {
      await writeAuditLog({
        req,
        userId,
        actorRole: access.role,
        action: "practice_patient_record_search",
        entityType: "practice_patient_record",
        entityId: req.params.linkId,
        practiceProfileId: practiceId,
        practicePatientLinkId: req.params.linkId,
        metadata: {
          queryHint: anonymizeSearchQueryForAudit(req.query.q),
          resultCount: result.results?.length || 0,
        },
      });
    }

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[practice/patients/record-search]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/practice/patients/:linkId/activity?practiceId= */
router.get("/:linkId/activity", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    logAccessDenied({
      req,
      userId,
      actorRole: access?.role || "unknown",
      practiceProfileId: practiceId,
      practicePatientLinkId: req.params.linkId,
      metadata: { route: "practice_patient_activity" },
    });
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const result = await getPracticePatientActivity(req.params.linkId, practiceId, {
      type: req.query.type,
      q: req.query.q,
      from: req.query.from,
      to: req.query.to,
    });
    return res.json({ ok: true, role: access.role, ...result });
  } catch (err) {
    console.error("[practice/patients/activity]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/patients/:linkId/activity/ai-summary */
router.post("/:linkId/activity/ai-summary", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const result = await generatePracticeLinkActivityAiSummary({
      linkId: req.params.linkId,
      practiceProfileId: practiceId,
      viewerUserId: userId,
      locale: req.body?.locale || req.query.locale,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[practice/patients/activity/ai-summary]", err?.message ?? err);
    const msg = err?.message || "request_failed";
    if (msg === "ai_not_configured") {
      return res.status(503).json({ ok: false, error: msg });
    }
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/practice/patients/:linkId/pre-visits?practiceId= */
router.get("/:linkId/pre-visits", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const result = await listPreVisitsForPracticePatient(
      req.params.linkId,
      practiceId,
    );
    return res.json({ ok: true, role: access.role, ...result });
  } catch (err) {
    console.error("[practice/patients/pre-visits]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/practice/patients/:linkId?practiceId= */
router.get("/:linkId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const record = await getPracticePatientRecord(req.params.linkId, practiceId);

    if (String(req.query.fromSearch || "").toLowerCase() === "true") {
      await writeAuditLog({
        req,
        userId,
        actorRole: access.role,
        action: "practice_patient_record_opened_from_search",
        entityType: "practice_patient_record",
        entityId: req.params.linkId,
        practiceProfileId: practiceId,
        practicePatientLinkId: req.params.linkId,
        metadata: {
          queryHint: anonymizeSearchQueryForAudit(req.query.q),
        },
      });
    }

    return res.json({ ok: true, role: access.role, ...record });
  } catch (err) {
    console.error("[practice/patients/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/practice/patients/:linkId/status */
router.patch("/:linkId/status", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canWritePracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const status = String(req.body?.status || "").trim();
  if (!status) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  try {
    const link = await updatePracticePatientLinkStatus(
      req.params.linkId,
      practiceId,
      status,
    );

    await writeAuditLog({
      userId,
      actorRole: access.role,
      action: "practice_patient_link_status_updated",
      entityType: "PracticePatientLink",
      entityId: link.id,
      metadata: { status: link.status },
    });

    return res.json({ ok: true, link });
  } catch (err) {
    console.error("[practice/patients/status]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
