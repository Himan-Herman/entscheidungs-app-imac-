/**
 * Practice settings & branding
 * GET    /api/practice/settings?practiceId=
 * PATCH  /api/practice/settings?practiceId=
 * POST   /api/practice/settings/logo?practiceId=
 * DELETE /api/practice/settings/logo?practiceId=
 * GET    /api/practice/settings/logo-file?practiceId=
 * POST   /api/practice/settings/ai-description-draft?practiceId=
 * GET    /api/practice/settings/patient-branding?practiceId=  (patient with link)
 */

import express from "express";
import { uploadPracticeLogo } from "../middleware/uploadPracticeLogo.js";
import {
  deletePracticeLogo,
  getPatientPracticeBranding,
  getPracticeLogoFile,
  getPracticeSettings,
  patchPracticeSettings,
  uploadPracticeLogo as uploadLogoService,
} from "../services/practiceSettings/practiceSettingsService.js";
import { generatePracticeDescriptionDraft } from "../services/practiceSettings/practiceSettingsAiService.js";
import { getPracticeAccess } from "../utils/practiceAccess.js";

const router = express.Router();

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
  const clientErrors = new Set([
    "practice_not_found",
    "forbidden",
    "validation_required",
    "practiceName_required",
    "email_invalid",
    "marketing_claim_forbidden",
    "accentColor_invalid",
    "supportedLanguages_invalid",
    "preferredDoctorLanguage_invalid",
    "logo_type_invalid",
    "logo_missing",
  ]);
  if (msg === "ai_not_configured") return { status: 503, error: msg };
  if (clientErrors.has(msg)) {
    return { status: msg === "practice_not_found" ? 404 : msg === "forbidden" ? 403 : 400, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const settings = await getPracticeSettings(userId, practiceId);
    return res.json({ ok: true, settings });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.patch("/", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const settings = await patchPracticeSettings(userId, practiceId, req.body || {}, { req });
    return res.json({ ok: true, settings });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/logo", uploadPracticeLogo.single("logo"), async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  if (!req.file?.buffer) {
    return res.status(400).json({ ok: false, error: "logo_missing" });
  }
  try {
    const settings = await uploadLogoService(
      userId,
      practiceId,
      { buffer: req.file.buffer, mimeType: req.file.mimetype },
      { req },
    );
    return res.json({ ok: true, settings });
  } catch (err) {
    if (err?.message === "logo_type_invalid") {
      return res.status(400).json({ ok: false, error: "logo_type_invalid" });
    }
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.delete("/logo", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const settings = await deletePracticeLogo(userId, practiceId, { req });
    return res.json({ ok: true, settings });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.get("/logo-file", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  try {
    const access = await getPracticeAccess(userId, practiceId);
    let allowed = Boolean(access);
    if (!allowed) {
      try {
        await getPatientPracticeBranding(userId, practiceId);
        allowed = true;
      } catch {
        allowed = false;
      }
    }
    if (!allowed) return res.status(403).json({ ok: false, error: "forbidden" });

    const file = await getPracticeLogoFile(practiceId);
    if (!file) return res.status(404).json({ ok: false, error: "logo_not_found" });

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.send(file.buffer);
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.post("/ai-description-draft", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const result = await generatePracticeDescriptionDraft(
      userId,
      practiceId,
      req.body || {},
      { req },
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

router.get("/patient-branding", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = practiceIdFromQuery(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    const branding = await getPatientPracticeBranding(userId, practiceId);
    return res.json({ ok: true, branding });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
