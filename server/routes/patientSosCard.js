/**
 * Patient Notfallausweis / SOS-Karte — /api/patient/sos-card
 *
 * GET    /api/patient/sos-card               — fetch or return empty card
 * PUT    /api/patient/sos-card               — upsert card data
 * DELETE /api/patient/sos-card               — soft-delete / deactivate the whole card
 * POST   /api/patient/sos-card/generate-token — generate / rotate public QR token
 * DELETE /api/patient/sos-card/revoke-token  — revoke public token (disable QR)
 * POST   /api/patient/sos-card/ai-summary    — trigger gpt-4o-mini summary
 */

import { randomUUID } from "crypto";
import express from "express";
import { prisma } from "../lib/prisma.js";
import { isSosCardEnabled } from "../config/featureFlags.js";
import { generateSosCardSummary } from "../services/sosCard/sosCardAiSummary.js";
import {
  computeAge,
  plausibleHeightCm,
  plausibleWeightKg,
} from "../services/sosCard/sosCardEmergencyData.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router();

const BLOOD_TYPES = new Set([
  "A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-",
  "O+", "O-",
]);

// Allowed preferred-emergency-language codes. Mirrors client EMERGENCY_LANGUAGES.
const EMERGENCY_LANGS = new Set([
  "de", "en", "fr", "es", "it",
  "ckb", "kmr", "fa", "ar", "tr", "pl", "ru", "uk", "el", "ur",
]);
// Medically-relevant, self-reported emergency values — not identity/political fields.
const BIOLOGICAL_SEX = new Set(["MALE", "FEMALE", "DIVERSE_INTERSEX", "UNKNOWN", "PREFER_NOT_TO_SAY"]);
const PREGNANCY_STATUS = new Set(["UNKNOWN", "NO", "YES", "NOT_APPLICABLE", "PREFER_NOT_TO_SAY"]);

// Visibility flags settable via PUT — kept in one list so route + sanitizeCard stay in sync.
const SHOW_FLAGS = [
  "showBloodType",
  "showAge",
  "showDateOfBirth",
  "showBiologicalSex",
  "showHeight",
  "showWeight",
  "showAllergies",
  "showDiagnoses",
  "showMedications",
  "showImplants",
  "showPregnancyStatus",
  "showEmergencyContacts",
  "showFirstResponderNote",
  "showAiSummary",
  "showPreferredLanguage",
];

// Optional sub-fields per structured list (name is always required, capped separately).
const MEDICATION_FIELDS = [
  { key: "dose", max: 80 },
  { key: "frequency", max: 80 },
  { key: "instruction", max: 200 },
  { key: "note", max: 200 },
];
const IMPLANT_FIELDS = [
  { key: "bodyRegion", max: 80 },
  { key: "manufacturer", max: 120 },
  { key: "note", max: 200 },
];

const MAX_LIST_ITEMS = 30;
const MAX_TOKEN_EXPIRY_DAYS = 3650;

function uid(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function requireFeature(_req, res, next) {
  if (!isSosCardEnabled()) return res.status(404).json({ ok: false, error: "feature_disabled" });
  return next();
}

/** Trim, strip angle brackets (no HTML), remove control chars, cap length. Returns null when empty. */
function cleanStr(value, max) {
  if (typeof value !== "string") return null;
  const s = value
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
  return s.length ? s : null;
}

/**
 * Normalize a patient-entered structured list. `name` is required; each optional sub-field
 * (from `fields`) is cleaned and capped. Unknown keys are dropped.
 * Returns: undefined (field absent → leave unchanged), null (explicit clear), or a capped array.
 */
function normalizeEntries(input, fields) {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (!Array.isArray(input)) return null;
  const out = [];
  for (const item of input.slice(0, MAX_LIST_ITEMS)) {
    if (!item || typeof item !== "object") continue;
    const name = cleanStr(item.name, 120);
    if (!name) continue;
    const entry = { name };
    for (const { key, max } of fields) {
      const v = cleanStr(item[key], max);
      if (v) entry[key] = v;
    }
    out.push(entry);
  }
  return out;
}

/** Returns the boolean if it is a real boolean, otherwise undefined (→ leave unchanged). */
function asBool(value) {
  return value === true || value === false ? value : undefined;
}

function sanitizeCard(row) {
  if (!row) return null;
  return {
    id: row.id,
    bloodType: row.bloodType,
    emergencyContact1Name: row.emergencyContact1Name,
    emergencyContact1Phone: row.emergencyContact1Phone,
    emergencyContact2Name: row.emergencyContact2Name,
    emergencyContact2Phone: row.emergencyContact2Phone,
    firstResponderNote: row.firstResponderNote,
    medications: row.medicationsJson ?? null,
    implants: row.implantsJson ?? null,
    emergencyBiologicalSex: row.emergencyBiologicalSex,
    pregnancyStatus: row.pregnancyStatus,
    preferredEmergencyLanguage: row.preferredEmergencyLanguage,
    aiSummary: row.aiSummary,
    aiSummaryUpdatedAt: row.aiSummaryUpdatedAt,
    hasPublicToken: Boolean(row.publicToken),
    tokenGeneratedAt: row.tokenGeneratedAt,
    publicTokenExpiresAt: row.publicTokenExpiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // All SOS data is patient self-reported; no medical verification exists.
    selfReported: true,
    ...Object.fromEntries(SHOW_FLAGS.map((k) => [k, row[k]])),
  };
}

router.use(requireFeature);

/** GET /api/patient/sos-card */
router.get("/", async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    const [card, user] = await Promise.all([
      prisma.sosCard.findUnique({ where: { patientUserId: userId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { dateOfBirth: true, profile: { select: { heightCm: true, weightKg: true } } },
      }),
    ]);
    // Soft-deleted card is treated as absent — patient can re-create by saving again.
    const visible = card && !card.deletedAt ? card : null;
    // Age / height / weight are referenced read-only from the profile, never stored on the card.
    const referenced = {
      dateOfBirth: user?.dateOfBirth ?? null,
      age: computeAge(user?.dateOfBirth),
      heightCm: plausibleHeightCm(user?.profile?.heightCm),
      weightKg: plausibleWeightKg(user?.profile?.weightKg),
    };
    return res.json({ ok: true, card: sanitizeCard(visible), referenced });
  } catch (err) {
    console.error("[sos-card] get error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** PUT /api/patient/sos-card */
router.put("/", async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const body = req.body || {};
  const {
    bloodType,
    emergencyContact1Name,
    emergencyContact1Phone,
    emergencyContact2Name,
    emergencyContact2Phone,
    firstResponderNote,
    medications,
    implants,
    emergencyBiologicalSex,
    pregnancyStatus,
    preferredEmergencyLanguage,
  } = body;

  if (bloodType !== undefined && bloodType !== null && bloodType !== "" && !BLOOD_TYPES.has(bloodType)) {
    return res.status(400).json({ ok: false, error: "invalid_blood_type" });
  }

  // Enum guards — empty/null clears the field; any other unexpected value is rejected.
  const enumChecks = [
    [preferredEmergencyLanguage, EMERGENCY_LANGS, "invalid_language"],
    [emergencyBiologicalSex, BIOLOGICAL_SEX, "invalid_biological_sex"],
    [pregnancyStatus, PREGNANCY_STATUS, "invalid_pregnancy_status"],
  ];
  for (const [val, set, errCode] of enumChecks) {
    if (val !== undefined && val !== null && val !== "" && !set.has(val)) {
      return res.status(400).json({ ok: false, error: errCode });
    }
  }

  // Existing fields keep their previous "always overwrite" semantics so current saves are unchanged.
  const data = {
    bloodType: bloodType || null,
    emergencyContact1Name: emergencyContact1Name?.trim().slice(0, 120) || null,
    emergencyContact1Phone: emergencyContact1Phone?.trim().slice(0, 40) || null,
    emergencyContact2Name: emergencyContact2Name?.trim().slice(0, 120) || null,
    emergencyContact2Phone: emergencyContact2Phone?.trim().slice(0, 40) || null,
    firstResponderNote: firstResponderNote?.trim().slice(0, 1000) || null,
    // Saving re-activates a previously soft-deleted card.
    deletedAt: null,
  };

  // New fields are only written when present in the body, so the existing
  // frontend save (which omits them) never resets the new columns to their defaults.
  const meds = normalizeEntries(medications, MEDICATION_FIELDS);
  if (meds !== undefined) data.medicationsJson = meds;
  const impl = normalizeEntries(implants, IMPLANT_FIELDS);
  if (impl !== undefined) data.implantsJson = impl;
  if (emergencyBiologicalSex !== undefined) {
    data.emergencyBiologicalSex = emergencyBiologicalSex || null;
  }
  if (pregnancyStatus !== undefined) data.pregnancyStatus = pregnancyStatus || null;
  if (preferredEmergencyLanguage !== undefined) {
    data.preferredEmergencyLanguage = preferredEmergencyLanguage || null;
  }
  for (const key of SHOW_FLAGS) {
    const v = asBool(body[key]);
    if (v !== undefined) data[key] = v;
  }

  try {
    const card = await prisma.sosCard.upsert({
      where: { patientUserId: userId },
      update: data,
      create: { patientUserId: userId, ...data },
    });

    await writeAuditLog({
      actorUserId: userId,
      actorRole: "patient",
      action: "sos_card_updated",
      targetUserId: userId,
    });

    return res.json({ ok: true, card: sanitizeCard(card) });
  } catch (err) {
    console.error("[sos-card] put error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** POST /api/patient/sos-card/generate-token */
router.post("/generate-token", async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  // Optional expiry: { expiresInDays: number } — omitted/null = no expiry (previous behaviour).
  let expiresAt = null;
  const { expiresInDays } = req.body || {};
  if (expiresInDays !== undefined && expiresInDays !== null && expiresInDays !== "") {
    const days = Number(expiresInDays);
    if (!Number.isFinite(days) || days <= 0 || days > MAX_TOKEN_EXPIRY_DAYS) {
      return res.status(400).json({ ok: false, error: "invalid_expiry" });
    }
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  try {
    const token = randomUUID();
    const now = new Date();
    const tokenData = {
      publicToken: token,
      tokenGeneratedAt: now,
      publicTokenExpiresAt: expiresAt,
      // Generating a share token re-activates a previously soft-deleted card.
      deletedAt: null,
    };
    const card = await prisma.sosCard.upsert({
      where: { patientUserId: userId },
      update: tokenData,
      create: { patientUserId: userId, ...tokenData },
    });

    await writeAuditLog({
      actorUserId: userId,
      actorRole: "patient",
      action: "sos_card_token_generated",
      targetUserId: userId,
    });

    return res.json({
      ok: true,
      publicToken: card.publicToken,
      tokenGeneratedAt: card.tokenGeneratedAt,
      publicTokenExpiresAt: card.publicTokenExpiresAt,
    });
  } catch (err) {
    console.error("[sos-card] generate-token error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** DELETE /api/patient/sos-card — soft-delete the whole card and disable any public link. */
router.delete("/", async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    await prisma.sosCard.updateMany({
      where: { patientUserId: userId, deletedAt: null },
      data: {
        deletedAt: new Date(),
        publicToken: null,
        tokenGeneratedAt: null,
        publicTokenExpiresAt: null,
      },
    });

    await writeAuditLog({
      actorUserId: userId,
      actorRole: "patient",
      action: "sos_card_deleted",
      targetUserId: userId,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[sos-card] delete error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** DELETE /api/patient/sos-card/revoke-token */
router.delete("/revoke-token", async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  try {
    await prisma.sosCard.updateMany({
      where: { patientUserId: userId },
      data: { publicToken: null, tokenGeneratedAt: null },
    });

    await writeAuditLog({
      actorUserId: userId,
      actorRole: "patient",
      action: "sos_card_token_revoked",
      targetUserId: userId,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[sos-card] revoke-token error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

/** POST /api/patient/sos-card/ai-summary */
router.post("/ai-summary", async (req, res) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ ok: false, error: "openai_not_configured" });
  }

  try {
    const [card, allergies, diagnoses] = await Promise.all([
      prisma.sosCard.findUnique({ where: { patientUserId: userId } }),
      prisma.allergyEntry.findMany({
        where: { userId, deletedAt: null },
        select: { allergen: true, severity: true, reaction: true },
      }),
      prisma.diagnosisEntry.findMany({
        where: { userId, deletedAt: null },
        // DB column is conditionName; the summary service expects { condition }.
        select: { conditionName: true, status: true },
      }),
    ]);

    const summary = await generateSosCardSummary({
      bloodType: card?.bloodType,
      allergies,
      diagnoses: diagnoses.map((d) => ({ condition: d.conditionName, status: d.status })),
      emergencyContact1Name: card?.emergencyContact1Name,
      emergencyContact1Phone: card?.emergencyContact1Phone,
      emergencyContact2Name: card?.emergencyContact2Name,
      emergencyContact2Phone: card?.emergencyContact2Phone,
      firstResponderNote: card?.firstResponderNote,
    });

    const updated = await prisma.sosCard.upsert({
      where: { patientUserId: userId },
      update: { aiSummary: summary, aiSummaryUpdatedAt: new Date() },
      create: {
        patientUserId: userId,
        aiSummary: summary,
        aiSummaryUpdatedAt: new Date(),
      },
    });

    return res.json({ ok: true, aiSummary: updated.aiSummary, aiSummaryUpdatedAt: updated.aiSummaryUpdatedAt });
  } catch (err) {
    console.error("[sos-card] ai-summary error", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
