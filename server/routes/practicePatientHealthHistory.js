/**
 * Practice read-only view of a patient's health history (allergies + diagnoses).
 *
 * GET /api/practice/patients/:linkId/health-history
 * POST /api/practice/patients/:linkId/health-history/ai-summary  (anonymised AI summary)
 *
 * Requires: active PracticePatientLink + patient consent "health_history_access"
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import OpenAI from "openai";
import { isHealthHistoryEnabled } from "../config/featureFlags.js";
import { requirePracticePatientLinkAccess } from "../services/authorization/practicePatientLinkAuthorization.js";
import { PERMISSIONS } from "../utils/practicePermissions.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { getOpenAiChatModel } from "../config/openAiModels.js";
import { logServerError } from "../utils/safeApiError.js";
import { buildPatientDataContextReadWhere, practiceProvenanceJson } from "../services/patientData/patientDataContextReadService.js";

const router = express.Router({ mergeParams: true });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function requireFeature(_req, res, next) {
  if (!isHealthHistoryEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

const requireHealthHistoryAccess = requirePracticePatientLinkAccess({
  permission: PERMISSIONS.CLINICAL_HEALTH_HISTORY_READ,
  consentType: "health_history_access",
});

/**
 * The AI summary needs BOTH permissions. Being allowed to READ the health
 * history must never imply being allowed to send it to an external AI
 * processor — that is a separate purpose under Art. 9 GDPR.
 * CLINICAL_AI_SUMMARY_GENERATE is currently held by no role, so this route
 * denies by default until a legal basis is wired.
 */
const requireAiSummaryAccess = requirePracticePatientLinkAccess({
  permission: [
    PERMISSIONS.CLINICAL_HEALTH_HISTORY_READ,
    PERMISSIONS.CLINICAL_AI_SUMMARY_GENERATE,
  ],
  consentType: "health_history_access",
});

/** GET /api/practice/patients/:linkId/health-history */
router.get("/", requireFeature, requireHealthHistoryAccess, async (req, res) => {
  const { link, actorUserId } = req.linkAccess;

  try {
    // Global records plus the ones recorded inside THIS care relationship.
    // Another link's data and unclassified legacy rows never match.
    const contextWhere = buildPatientDataContextReadWhere({
      patientUserId: link.patientUserId,
      practicePatientLinkId: link.id,
    });
    const [allergies, diagnoses] = await Promise.all([
      prisma.allergyEntry.findMany({
        where: contextWhere,
        orderBy: [{ severity: "asc" }, { allergen: "asc" }],
      }),
      prisma.diagnosisEntry.findMany({
        where: contextWhere,
        orderBy: [{ status: "asc" }, { conditionName: "asc" }],
      }),
    ]);

    writeAuditLog({
      userId: actorUserId,
      action: "practice_health_history_viewed",
      metadata: { linkId: req.params.linkId, patientUserId: link.patientUserId, allergyCount: allergies.length, diagnosisCount: diagnoses.length },
    });

    return res.json({
      ok: true,
      allergies: allergies.map(r => ({
        // Origin type only — never the link id, never the patient id.
        ...practiceProvenanceJson(r),
        id: r.id, allergen: r.allergen, allergyType: r.allergyType,
        severity: r.severity, reaction: r.reaction, diagnosedDate: r.diagnosedDate,
        status: r.status, notes: r.notes, createdAt: r.createdAt,
      })),
      diagnoses: diagnoses.map(r => ({
        ...practiceProvenanceJson(r),
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
router.post("/ai-summary", requireFeature, requireAiSummaryAccess, async (req, res) => {
  const { link, actorUserId } = req.linkAccess;
  const { locale = "de" } = req.body || {};

  try {
    // Same context filter as the read path. The route is unreachable today —
    // CLINICAL_AI_SUMMARY_GENERATE is granted to no role — but if it is ever
    // enabled it must not process another practice's records either.
    const contextWhere = buildPatientDataContextReadWhere({
      patientUserId: link.patientUserId,
      practicePatientLinkId: link.id,
    });
    const [allergies, diagnoses] = await Promise.all([
      prisma.allergyEntry.findMany({
        where: { ...contextWhere, status: { not: "inactive" } },
      }),
      prisma.diagnosisEntry.findMany({ where: contextWhere }),
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

    writeAuditLog({
      userId: actorUserId,
      action: "practice_health_history_ai_summary",
      metadata: { linkId: req.params.linkId },
    });

    return res.json({ ok: true, summary });
  } catch (err) {
    logServerError("practiceHealthHistory/ai-summary", err);
    return res.status(500).json({ ok: false, error: "ai_unavailable" });
  }
});

export default router;
