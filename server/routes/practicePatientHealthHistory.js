/**
 * Practice read-only view of a patient's health history (allergies + diagnoses).
 *
 * GET /api/practice/patients/:linkId/health-history
 * POST /api/practice/patients/:linkId/health-history/ai-summary  (anonymised AI summary)
 *
 * Requires: active PracticePatientLink + patient consent "health_history_access"
 */

import express from "express";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { isHealthHistoryEnabled } from "../config/featureFlags.js";
import { resolvePatientLinkForPractice } from "../services/careRelationship/resolvePatientLink.js";
import { assertConsentForLink } from "../services/consent/consentRecordService.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { getOpenAiChatModel } from "../config/openAiModels.js";
import { logServerError } from "../utils/safeApiError.js";

const router = express.Router({ mergeParams: true });
const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LINK_ACTIVE = new Set(["invited", "active"]);

function requireFeature(_req, res, next) {
  if (!isHealthHistoryEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

async function resolveLink(req, res) {
  const { linkId } = req.params;
  const practiceId = req.query.practiceId || "";
  const actorUserId = req.user?.userId;
  if (!practiceId || !actorUserId) {
    res.status(400).json({ ok: false, error: "missing_practice_id" });
    return null;
  }
  let link;
  try {
    link = await resolvePatientLinkForPractice(linkId, practiceId);
  } catch (err) {
    if (err?.message === "link_not_found") res.status(404).json({ ok: false, error: "link_not_found" });
    else res.status(400).json({ ok: false, error: "invalid_request" });
    return null;
  }
  if (!LINK_ACTIVE.has(link.status)) {
    res.status(403).json({ ok: false, error: "link_inactive" });
    return null;
  }
  try {
    await assertConsentForLink(link, "health_history_access", { req, actorUserId, actorRole: "practice" });
  } catch {
    res.status(403).json({ ok: false, error: "consent_required" });
    return null;
  }
  return { link, actorUserId };
}

/** GET /api/practice/patients/:linkId/health-history */
router.get("/", requireFeature, async (req, res) => {
  const ctx = await resolveLink(req, res);
  if (!ctx) return;
  const { link, actorUserId } = ctx;

  try {
    const [allergies, diagnoses] = await Promise.all([
      prisma.allergyEntry.findMany({
        where: { userId: link.patientUserId, deletedAt: null },
        orderBy: [{ severity: "asc" }, { allergen: "asc" }],
      }),
      prisma.diagnosisEntry.findMany({
        where: { userId: link.patientUserId, deletedAt: null },
        orderBy: [{ status: "asc" }, { conditionName: "asc" }],
      }),
    ]);

    await writeAuditLog({
      userId: actorUserId,
      action: "practice_health_history_viewed",
      meta: { linkId: req.params.linkId, patientUserId: link.patientUserId, allergyCount: allergies.length, diagnosisCount: diagnoses.length },
    }).catch(() => {});

    return res.json({
      ok: true,
      allergies: allergies.map(r => ({
        id: r.id, allergen: r.allergen, allergyType: r.allergyType,
        severity: r.severity, reaction: r.reaction, diagnosedDate: r.diagnosedDate,
        status: r.status, notes: r.notes, createdAt: r.createdAt,
      })),
      diagnoses: diagnoses.map(r => ({
        id: r.id, conditionName: r.conditionName, icdCode: r.icdCode,
        diagnosedDate: r.diagnosedDate, status: r.status,
        treatingDoctor: r.treatingDoctor, notes: r.notes, createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error("[practiceHealthHistory] GET", err?.message);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/**
 * POST /api/practice/patients/:linkId/health-history/ai-summary
 * Generates an anonymised clinical risk summary for the practice.
 * No patient name, DOB, or identifiers are included in the AI prompt.
 */
router.post("/ai-summary", requireFeature, async (req, res) => {
  const ctx = await resolveLink(req, res);
  if (!ctx) return;
  const { link, actorUserId } = ctx;
  const { locale = "de" } = req.body || {};

  try {
    const [allergies, diagnoses] = await Promise.all([
      prisma.allergyEntry.findMany({ where: { userId: link.patientUserId, deletedAt: null, status: { not: "inactive" } } }),
      prisma.diagnosisEntry.findMany({ where: { userId: link.patientUserId, deletedAt: null } }),
    ]);

    if (allergies.length === 0 && diagnoses.length === 0) {
      return res.json({ ok: true, summary: null, reason: "no_data" });
    }

    const allergyList = allergies.map(a =>
      `- ${a.allergen} (${a.allergyType}, ${a.severity}${a.reaction ? `: ${a.reaction}` : ""})`
    ).join("\n");

    const diagnosisList = diagnoses.map(d =>
      `- ${d.conditionName}${d.icdCode ? ` [${d.icdCode}]` : ""} (${d.status})`
    ).join("\n");

    const lang = locale === "de" ? "German" : locale === "fr" ? "French" : locale === "it" ? "Italian" : locale === "es" ? "Spanish" : "English";

    const completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      messages: [
        {
          role: "system",
          content: `You are a clinical summary assistant for healthcare professionals.
Write a concise clinical relevance summary in ${lang} for a medical team reviewing a patient's self-reported health history.
Focus on: critical allergies (especially life-threatening), active chronic conditions, and drug interactions to be aware of.
Keep it under 120 words. Use bullet points. Do not include patient names or identifiers. Add a disclaimer that this is patient-self-reported data, not a clinical diagnosis.`,
        },
        {
          role: "user",
          content: `Allergies:\n${allergyList || "None reported"}\n\nDiagnoses/Conditions:\n${diagnosisList || "None reported"}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });

    const summary = completion.choices[0].message.content?.trim() || null;

    await writeAuditLog({
      userId: actorUserId,
      action: "practice_health_history_ai_summary",
      meta: { linkId: req.params.linkId },
    }).catch(() => {});

    return res.json({ ok: true, summary });
  } catch (err) {
    logServerError("practiceHealthHistory/ai-summary", err);
    return res.status(500).json({ ok: false, error: "ai_unavailable" });
  }
});

export default router;
