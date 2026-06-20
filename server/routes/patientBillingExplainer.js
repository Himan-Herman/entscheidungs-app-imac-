/**
 * Patient-facing "Rechnung verstehen" (billing explain) — route.
 *
 * IMPORTANT: This is a plain-language explanation HINT tool only.
 * It is NOT a billing system, NOT a certified GOÄ service, and does NOT produce a
 * legally binding or final invoice review. It never states an invoice is correct or
 * incorrect, and gives no diagnosis, therapy, urgency, or medical assessment.
 *
 * Stateless: no database, no storage, no upload, no OCR, no AI. No patient identifiers
 * are stored, no practiceId is used, and invoice content is never logged.
 *
 * Feature flag: ENABLE_PATIENT_BILLING_EXPLAIN (default: false)
 * Access: any authenticated patient (requireAuth, mounted in app.js).
 */

import express from "express";
import { isPatientBillingExplainEnabled } from "../config/featureFlags.js";
import { createIpRateLimiter } from "../middleware/ipRateLimit.js";
import {
  explainEntries,
  PATIENT_BILLING_EXPLAIN_LIMITS,
} from "../services/billingPlausibility/patientBillingExplainService.js";

const router = express.Router();

// Self-contained limiter so the shared middleware file stays untouched.
const explainLimiter = createIpRateLimiter({
  max: 40,
  keyPrefix: "patient_billing_explain",
});

function requireFeature(req, res, next) {
  if (!isPatientBillingExplainEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}

router.use(requireFeature);

/**
 * POST /explain
 * Body: { rows?: [{ ziffer, factor, count, amount?, note? }], text?: string }
 * Returns deterministic per-position explanation + advisory warning codes.
 */
router.post("/explain", explainLimiter, (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const body = req.body || {};
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const text = typeof body.text === "string" ? body.text : "";

  let result;
  try {
    result = explainEntries({ rows, text });
  } catch {
    // Never surface internals or log invoice content.
    return res.status(500).json({ ok: false, error: "generic" });
  }

  if (!result.ok) {
    // Map service-level validation errors to 400 with a stable code for i18n.
    return res.status(400).json({ ok: false, error: result.error });
  }

  return res.json({
    ok: true,
    source: result.source,
    items: result.items,
    hasWarnings: result.hasWarnings,
    noFindings: result.noFindings,
    personalDataNotice: result.personalDataNotice,
    limits: PATIENT_BILLING_EXPLAIN_LIMITS,
  });
});

export default router;
