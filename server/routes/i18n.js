/**
 * Locale metadata & organizational translation helper (no medical content).
 */

import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { listLocalesMetadata, validateUiLocale } from "../services/i18n/i18nLocaleService.js";
import { translateOrganizationalText } from "../services/i18n/i18nAiTranslationService.js";
import { prisma } from "../lib/prisma.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** GET /api/i18n/locales */
router.get("/locales", (_req, res) => {
  return res.json({
    ok: true,
    locales: listLocalesMetadata(),
    defaultLocale: "en",
    activeLocales: ["de", "en"],
  });
});

/** GET /api/i18n/translations/:locale — metadata only (bundles ship with client) */
router.get("/translations/:locale", (req, res) => {
  const locale = validateUiLocale(req.params.locale);
  if (!locale) {
    return res.status(400).json({ ok: false, error: "validation_invalid_locale" });
  }
  const meta = listLocalesMetadata().find((l) => l.code === locale);
  return res.json({
    ok: true,
    locale,
    metadata: meta,
    clientBundled: true,
    namespaces: [
      "common",
      "apiErrors",
      "roleEntry",
      "patientInbox",
      "practiceInbox",
      "patientThreads",
      "practiceMessages",
      "practiceDocuments",
      "patientMedicationPlan",
      "patientDataControl",
      "patientConsents",
      "exports",
      "practiceSecurity",
      "practiceAudit",
    ],
  });
});

/** PATCH /api/i18n/preferences — persist UI language on user profile */
router.patch("/preferences", requireAuth, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const locale = validateUiLocale(req.body?.locale);
  if (!locale) {
    return res.status(400).json({ ok: false, error: "validation_invalid_locale" });
  }

  try {
    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, preferredUiLanguage: locale },
      update: { preferredUiLanguage: locale },
    });

    writeAuditLog({
      req,
      userId,
      actorRole: "user",
      action: "ui_locale_changed",
      entityType: "user_profile",
      entityId: userId,
      metadata: { locale },
    });

    return res.json({ ok: true, locale });
  } catch (err) {
    console.error("[i18n/preferences]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** GET /api/i18n/preferences */
router.get("/preferences", requireAuth, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { preferredUiLanguage: true },
  });

  return res.json({
    ok: true,
    locale: profile?.preferredUiLanguage || null,
  });
});

/** POST /api/i18n/ai-translation-helper */
router.post("/ai-translation-helper", requireAuth, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const result = await translateOrganizationalText({
      text: req.body?.text,
      sourceLocale: req.body?.sourceLocale,
      targetLocale: req.body?.targetLocale || req.body?.locale,
      userId,
      req,
    });
    return res.json({ ok: true, result });
  } catch (err) {
    const msg = err?.message || "request_failed";
    if (msg === "validation_required" || msg === "validation_medical_content_not_allowed") {
      return res.status(400).json({ ok: false, error: msg });
    }
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

export default router;
