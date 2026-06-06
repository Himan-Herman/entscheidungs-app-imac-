/**
 * GOÄ / PKV billing plausibility — route.
 *
 * IMPORTANT: This is a plausibility hint tool only.
 * It is NOT a billing system, NOT a certified GOÄ service, and does NOT
 * produce legally binding reimbursement decisions. No patient identifiers
 * are accepted or stored. No AI is invoked.
 *
 * Feature flag: ENABLE_BILLING_PLAUSIBILITY (default: false)
 * Access: practice owner and admin only (INTEGRATIONS_MANAGE permission).
 */

import express from "express";
import { isBillingPlausibilityEnabled, isBillingAiReviewEnabled } from "../config/featureFlags.js";
import {
  listSessionsForPractice,
  createSessionForPractice,
  getSessionForPractice,
  dismissSessionForPractice,
} from "../services/billingPlausibility/billingPlausibilityService.js";
import { requestAiReviewForSession } from "../services/billingPlausibility/billingPlausibilityAiReviewService.js";

const router = express.Router();

const FORBIDDEN_PATIENT_FIELDS = [
  "patientName",
  "patientId",
  "dateOfBirth",
  "diagnosisText",
  "clinicalNotes",
  "icd10",
  "diagnosis",
];

function requireBillingFlag(req, res, next) {
  if (!isBillingPlausibilityEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}

function userId(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function practiceIdFromQuery(req) {
  const id = req.query?.practiceId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function mapServiceError(result) {
  if (result.ok) return null;
  const map = {
    forbidden: 403,
    practice_not_found: 404,
    session_not_found: 404,
    feature_disabled: 404,
    rows_required: 400,
    too_many_rows: 400,
    already_dismissed: 409,
    session_dismissed: 409,
  };
  return { status: map[result.error] ?? 500, error: result.error };
}

router.use(requireBillingFlag);

/** GET / — list sessions for a practice. */
router.get("/", async (req, res) => {
  const uid = userId(req);
  const practiceId = practiceIdFromQuery(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  try {
    const result = await listSessionsForPractice(practiceId, { userId: uid });
    const mapped = mapServiceError(result);
    if (mapped) return res.status(mapped.status).json({ ok: false, error: mapped.error });
    return res.json({
      ok: true,
      sessions: result.sessions,
      capabilities: { aiReview: isBillingAiReviewEnabled() },
    });
  } catch (err) {
    console.error("[billing-plausibility] GET /", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** GET /:sessionId — get one session with items. */
router.get("/:sessionId", async (req, res) => {
  const uid = userId(req);
  const practiceId = practiceIdFromQuery(req);
  const { sessionId } = req.params;
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  if (!sessionId) return res.status(400).json({ ok: false, error: "sessionId_required" });

  try {
    const result = await getSessionForPractice(practiceId, sessionId, { userId: uid });
    const mapped = mapServiceError(result);
    if (mapped) return res.status(mapped.status).json({ ok: false, error: mapped.error });
    return res.json({ ok: true, session: result.session });
  } catch (err) {
    console.error("[billing-plausibility] GET /:sessionId", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** POST / — create a new plausibility session. */
router.post("/", async (req, res) => {
  const uid = userId(req);
  const practiceId = practiceIdFromQuery(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  const body = req.body || {};

  for (const field of FORBIDDEN_PATIENT_FIELDS) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== "") {
      return res.status(400).json({ ok: false, error: "patient_data_not_accepted" });
    }
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return res.status(400).json({ ok: false, error: "rows_required" });
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== "object") {
      return res.status(400).json({ ok: false, error: "invalid_row", rowIndex: i });
    }
    if (!String(row.ziffer ?? "").trim()) {
      return res.status(400).json({ ok: false, error: "ziffer_required", rowIndex: i });
    }
    if (row.factor === undefined || row.factor === null || row.factor === "") {
      return res.status(400).json({ ok: false, error: "factor_required", rowIndex: i });
    }
    if (row.count === undefined || row.count === null || row.count === "") {
      return res.status(400).json({ ok: false, error: "count_required", rowIndex: i });
    }
  }

  try {
    const result = await createSessionForPractice(practiceId, { userId: uid }, {
      rows: rows.map((r) => ({
        ziffer: String(r.ziffer ?? "").trim(),
        factor: String(r.factor ?? ""),
        count: r.count,
        contextText: typeof r.contextText === "string" ? r.contextText : undefined,
      })),
    });
    const mapped = mapServiceError(result);
    if (mapped) return res.status(mapped.status).json({ ok: false, error: mapped.error });
    return res.status(201).json({ ok: true, session: result.session });
  } catch (err) {
    console.error("[billing-plausibility] POST /", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/**
 * POST /:sessionId/review — request AI-assisted plausibility hints.
 *
 * Requires ENABLE_BILLING_AI_REVIEW=true (separate from main billing flag).
 * Returns deterministic fallback if AI is unavailable — never blocks the request.
 * Patient-identifying fields in the request body are rejected (400).
 * Dismissed sessions are rejected (409).
 * Raw prompt and raw AI output are never returned.
 */
router.post("/:sessionId/review", async (req, res) => {
  if (!isBillingAiReviewEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }

  const uid = userId(req);
  const practiceId = practiceIdFromQuery(req);
  const { sessionId } = req.params;
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  if (!sessionId) return res.status(400).json({ ok: false, error: "sessionId_required" });

  const body = req.body || {};
  for (const field of FORBIDDEN_PATIENT_FIELDS) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== "") {
      return res.status(400).json({ ok: false, error: "patient_data_not_accepted" });
    }
  }

  try {
    const result = await requestAiReviewForSession(practiceId, sessionId, { userId: uid });
    const mapped = mapServiceError(result);
    if (mapped) return res.status(mapped.status).json({ ok: false, error: mapped.error });
    return res.json({
      ok: true,
      session: result.session,
      aiResult: result.aiResult,
      used_fallback: result.used_fallback,
    });
  } catch (err) {
    console.error("[billing-plausibility] POST /:sessionId/review", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** POST /:sessionId/dismiss — mark session as dismissed (non-destructive). */
router.post("/:sessionId/dismiss", async (req, res) => {
  const uid = userId(req);
  const practiceId = practiceIdFromQuery(req);
  const { sessionId } = req.params;
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  if (!sessionId) return res.status(400).json({ ok: false, error: "sessionId_required" });

  try {
    const result = await dismissSessionForPractice(practiceId, sessionId, { userId: uid });
    const mapped = mapServiceError(result);
    if (mapped) return res.status(mapped.status).json({ ok: false, error: mapped.error });
    return res.json({ ok: true, session: result.session });
  } catch (err) {
    console.error("[billing-plausibility] POST /:sessionId/dismiss", err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
