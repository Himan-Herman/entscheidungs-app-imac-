/**
 * Practice Anamnesis — configurable questionnaire template management + link/submission management.
 */

import express from "express";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { requirePracticeAnamnesisFeature } from "../middleware/requirePracticeAnamnesis.js";
import { getPracticeAccess } from "../utils/practiceAccess.js";
import { canManageAnamnesis, canReadAnamnesis } from "../utils/practicePermissions.js";

const router = express.Router();
router.use(requirePracticeAnamnesisFeature);

const prisma = new PrismaClient();

const VALID_QUESTION_TYPES = new Set([
  "text",
  "textarea",
  "single_choice",
  "multi_choice",
  "date",
  "number",
  "yes_no",
]);

// ── Standard template structure (multilingual, DB-created on request) ─────────

const STANDARD_TEMPLATE_STRUCTURE = {
  titleJson: { de: "Standard-Anamnese", en: "Standard Anamnesis", fr: "Anamnèse standard", it: "Anamnesi standard", es: "Anamnesis estándar" },
  descriptionJson: { de: "Vordefinierte Standardvorlage — bitte nach Bedarf anpassen.", en: "Predefined standard template — please customise as needed.", fr: "Modèle standard prédéfini — à personnaliser.", it: "Modello standard predefinito — da personalizzare.", es: "Plantilla estándar predefinida — personalizar según sea necesario." },
  sections: [
    {
      titleJson: { de: "Aktuelles Anliegen", en: "Current Complaint", fr: "Plainte actuelle", it: "Reclamo attuale", es: "Motivo de consulta" },
      questions: [
        { type: "textarea", isRequired: true, labelJson: { de: "Was ist Ihr Hauptanliegen / Ihre Hauptbeschwerde?", en: "What is your main complaint?", fr: "Quelle est votre plainte principale ?", it: "Qual è il suo problema principale?", es: "¿Cuál es su queja principal?" }, hintJson: { de: "Bitte so genau wie möglich beschreiben", en: "Please describe as precisely as possible", fr: "Décrivez aussi précisément que possible", it: "Descrivere il più precisamente possibile", es: "Describa lo más preciso posible" } },
        { type: "text", isRequired: false, labelJson: { de: "Seit wann bestehen die Beschwerden?", en: "How long have you had these symptoms?", fr: "Depuis quand avez-vous ces symptômes ?", it: "Da quanto tempo ha questi sintomi?", es: "¿Desde cuándo tiene estos síntomas?" }, hintJson: { de: "z. B. seit 3 Tagen, seit 2 Wochen", en: "e.g. for 3 days, for 2 weeks", fr: "p. ex. depuis 3 jours", it: "es. da 3 giorni", es: "p. ej. desde hace 3 días" } },
        { type: "number", isRequired: false, labelJson: { de: "Schmerzstärke (0 = kein Schmerz, 10 = unerträglicher Schmerz)", en: "Pain intensity (0 = no pain, 10 = unbearable)", fr: "Intensité de la douleur (0 = pas de douleur, 10 = insupportable)", it: "Intensità del dolore (0 = nessun dolore, 10 = insopportabile)", es: "Intensidad del dolor (0 = sin dolor, 10 = insoportable)" } },
        { type: "single_choice", isRequired: false, labelJson: { de: "Schmerzcharakter", en: "Pain character", fr: "Caractère de la douleur", it: "Carattere del dolore", es: "Carácter del dolor" }, optionsJson: [{ de: "Stechend", en: "Stabbing", fr: "Lancinant", it: "Pungente", es: "Punzante" }, { de: "Dumpf", en: "Dull", fr: "Sourd", it: "Sordo", es: "Sordo" }, { de: "Brennend", en: "Burning", fr: "Brûlant", it: "Bruciante", es: "Ardiente" }, { de: "Drückend", en: "Pressing", fr: "Oppressif", it: "Pressante", es: "Opresivo" }, { de: "Krampfartig", en: "Cramping", fr: "Crampes", it: "Cramposo", es: "Calambre" }] },
      ],
    },
    {
      titleJson: { de: "Vorerkrankungen & Operationen", en: "Medical History & Surgeries", fr: "Antécédents médicaux & chirurgies", it: "Storia clinica & interventi", es: "Antecedentes & cirugías" },
      questions: [
        { type: "textarea", isRequired: false, labelJson: { de: "Bekannte Vorerkrankungen", en: "Known medical conditions", fr: "Maladies connues", it: "Malattie note", es: "Enfermedades conocidas" }, hintJson: { de: "z. B. Bluthochdruck, Diabetes, Herzerkrankung", en: "e.g. hypertension, diabetes, heart disease", fr: "p. ex. hypertension, diabète", it: "es. ipertensione, diabete", es: "p. ej. hipertensión, diabetes" } },
        { type: "textarea", isRequired: false, labelJson: { de: "Frühere Operationen", en: "Previous surgeries", fr: "Opérations précédentes", it: "Interventi chirurgici precedenti", es: "Cirugías previas" } },
        { type: "textarea", isRequired: false, labelJson: { de: "Frühere Krankenhausaufenthalte", en: "Previous hospitalizations", fr: "Hospitalisations précédentes", it: "Ricoveri precedenti", es: "Hospitalizaciones previas" } },
      ],
    },
    {
      titleJson: { de: "Medikamente & Allergien", en: "Medications & Allergies", fr: "Médicaments & allergies", it: "Farmaci & allergie", es: "Medicamentos & alergias" },
      questions: [
        { type: "textarea", isRequired: false, labelJson: { de: "Aktuelle Medikamente (Name, Dosierung, Häufigkeit)", en: "Current medications (name, dosage, frequency)", fr: "Médicaments actuels (nom, dosage, fréquence)", it: "Farmaci attuali (nome, dosaggio, frequenza)", es: "Medicamentos actuales (nombre, dosis, frecuencia)" } },
        { type: "textarea", isRequired: false, labelJson: { de: "Allergien & Unverträglichkeiten", en: "Allergies & intolerances", fr: "Allergies et intolérances", it: "Allergie & intolleranze", es: "Alergias e intolerancias" }, hintJson: { de: "z. B. Penicillin, Latex, Nüsse", en: "e.g. penicillin, latex, nuts", fr: "p. ex. pénicilline, latex", it: "es. penicillina, lattice", es: "p. ej. penicilina, látex" } },
        { type: "yes_no", isRequired: false, labelJson: { de: "Nehmen Sie Blutverdünner / Gerinnungshemmer?", en: "Do you take blood thinners / anticoagulants?", fr: "Prenez-vous des anticoagulants ?", it: "Assume anticoagulanti?", es: "¿Toma anticoagulantes?" } },
      ],
    },
    {
      titleJson: { de: "Schwangerschaft & Lebensstil", en: "Pregnancy & Lifestyle", fr: "Grossesse & mode de vie", it: "Gravidanza & stile di vita", es: "Embarazo & estilo de vida" },
      questions: [
        { type: "yes_no", isRequired: false, labelJson: { de: "Bestehende oder mögliche Schwangerschaft?", en: "Existing or possible pregnancy?", fr: "Grossesse existante ou possible ?", it: "Gravidanza esistente o possibile?", es: "¿Embarazo existente o posible?" } },
        { type: "yes_no", isRequired: false, labelJson: { de: "Rauchen Sie?", en: "Do you smoke?", fr: "Fumez-vous ?", it: "Fuma?", es: "¿Fuma usted?" } },
        { type: "single_choice", isRequired: false, labelJson: { de: "Alkoholkonsum", en: "Alcohol consumption", fr: "Consommation d'alcool", it: "Consumo di alcol", es: "Consumo de alcohol" }, optionsJson: [{ de: "Kein Alkohol", en: "No alcohol", fr: "Pas d'alcool", it: "Nessun alcol", es: "Sin alcohol" }, { de: "Gelegentlich", en: "Occasionally", fr: "Occasionnellement", it: "Occasionalmente", es: "Ocasionalmente" }, { de: "Regelmäßig", en: "Regularly", fr: "Régulièrement", it: "Regolarmente", es: "Regularmente" }] },
      ],
    },
    {
      titleJson: { de: "Hinweise für die Praxis", en: "Notes for the Practice", fr: "Remarques pour le cabinet", it: "Note per lo studio", es: "Notas para la consulta" },
      questions: [
        { type: "textarea", isRequired: false, labelJson: { de: "Wichtige Hinweise oder Anmerkungen für das Praxisteam", en: "Important notes for the practice team", fr: "Remarques importantes pour l'équipe", it: "Note importanti per il team dello studio", es: "Notas importantes para el equipo" } },
        { type: "yes_no", isRequired: false, labelJson: { de: "Benötigen Sie einen Dolmetscher?", en: "Do you need an interpreter?", fr: "Avez-vous besoin d'un interprète ?", it: "Ha bisogno di un interprete?", es: "¿Necesita un intérprete?" } },
      ],
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function uidFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length ? id : null;
}

function practiceIdFromReq(req) {
  const id = req.query?.practiceId ?? req.body?.practiceId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  const forbidden = new Set(["forbidden", "anamnesis_disabled"]);
  const notFound = new Set(["practice_not_found", "template_not_found", "section_not_found", "question_not_found", "link_not_found", "submission_not_found"]);
  const bad = new Set(["practiceId_required", "title_required", "type_required", "label_required", "invalid_question_type", "options_required_for_choice"]);
  if (forbidden.has(msg)) return { status: 403, error: msg };
  if (notFound.has(msg)) return { status: 404, error: msg };
  if (bad.has(msg)) return { status: 400, error: msg };
  return { status: 500, error: "request_failed" };
}

function generateLinkToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash, prefix: raw.slice(0, 8) };
}

const TEMPLATE_INCLUDE = {
  sections: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  },
  questions: { where: { sectionId: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
};

async function requireAccess(uid, pid, needsManage = false) {
  const access = await getPracticeAccess(uid, pid);
  if (!access) throw new Error("practice_not_found");
  if (!access.practice.anamnesisEnabled) throw new Error("anamnesis_disabled");
  if (needsManage && !canManageAnamnesis(access.role)) throw new Error("forbidden");
  if (!needsManage && !canReadAnamnesis(access.role)) throw new Error("forbidden");
  return access;
}

async function buildSectionsInTx(tx, templateId, sections) {
  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const sec = sections[sIdx];
    const section = await tx.practiceAnamnesisSection.create({
      data: { templateId, titleJson: sec.titleJson || { de: "", en: "" }, sortOrder: sIdx },
    });
    const qs = Array.isArray(sec.questions) ? sec.questions : [];
    for (let qIdx = 0; qIdx < qs.length; qIdx++) {
      const q = qs[qIdx];
      if (!VALID_QUESTION_TYPES.has(q.type)) continue;
      await tx.practiceAnamnesisQuestion.create({
        data: {
          templateId,
          sectionId: section.id,
          type: q.type,
          labelJson: q.labelJson || { de: "", en: "" },
          hintJson: q.hintJson ?? null,
          optionsJson: Array.isArray(q.optionsJson) && q.optionsJson.length ? q.optionsJson : null,
          isRequired: Boolean(q.isRequired),
          sortOrder: qIdx,
        },
      });
    }
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

router.get("/templates", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, false);
    const templates = await prisma.practiceAnamnesisTemplate.findMany({
      where: { practiceProfileId: pid },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: TEMPLATE_INCLUDE,
    });
    return res.json({ ok: true, templates });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

router.post("/templates/from-standard", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, true);
    const maxOrder = await prisma.practiceAnamnesisTemplate.aggregate({
      where: { practiceProfileId: pid },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const template = await prisma.$transaction(async (tx) => {
      const tpl = await tx.practiceAnamnesisTemplate.create({
        data: {
          practiceProfileId: pid,
          titleJson: STANDARD_TEMPLATE_STRUCTURE.titleJson,
          descriptionJson: STANDARD_TEMPLATE_STRUCTURE.descriptionJson,
          sortOrder,
        },
      });
      await buildSectionsInTx(tx, tpl.id, STANDARD_TEMPLATE_STRUCTURE.sections);
      return tx.practiceAnamnesisTemplate.findUnique({ where: { id: tpl.id }, include: TEMPLATE_INCLUDE });
    });

    return res.status(201).json({ ok: true, template });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

router.post("/templates", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, true);
    const { titleJson, descriptionJson } = req.body;
    if (!titleJson || typeof titleJson !== "object") throw new Error("title_required");
    const maxOrder = await prisma.practiceAnamnesisTemplate.aggregate({
      where: { practiceProfileId: pid },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    const template = await prisma.practiceAnamnesisTemplate.create({
      data: { practiceProfileId: pid, titleJson, descriptionJson: descriptionJson ?? null, sortOrder },
      include: TEMPLATE_INCLUDE,
    });
    return res.status(201).json({ ok: true, template });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

router.get("/templates/:templateId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, false);
    const template = await prisma.practiceAnamnesisTemplate.findUnique({
      where: { id: req.params.templateId },
      include: TEMPLATE_INCLUDE,
    });
    if (!template || template.practiceProfileId !== pid) throw new Error("template_not_found");
    return res.json({ ok: true, template });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

router.patch("/templates/:templateId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, true);
    const existing = await prisma.practiceAnamnesisTemplate.findUnique({ where: { id: req.params.templateId } });
    if (!existing || existing.practiceProfileId !== pid) throw new Error("template_not_found");
    const { titleJson, descriptionJson, status } = req.body;
    const data = {};
    if (titleJson !== undefined) data.titleJson = titleJson;
    if (descriptionJson !== undefined) data.descriptionJson = descriptionJson;
    if (status !== undefined) data.status = status;
    const template = await prisma.practiceAnamnesisTemplate.update({
      where: { id: req.params.templateId },
      data,
      include: TEMPLATE_INCLUDE,
    });
    return res.json({ ok: true, template });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

/**
 * Full replacement — atomically replaces all sections + questions.
 * Used by the template editor "Save" action.
 */
router.put("/templates/:templateId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, true);
    const existing = await prisma.practiceAnamnesisTemplate.findUnique({ where: { id: req.params.templateId } });
    if (!existing || existing.practiceProfileId !== pid) throw new Error("template_not_found");

    const { titleJson, descriptionJson, sections } = req.body;
    if (!titleJson || typeof titleJson !== "object") throw new Error("title_required");

    const template = await prisma.$transaction(async (tx) => {
      await tx.practiceAnamnesisTemplate.update({
        where: { id: req.params.templateId },
        data: { titleJson, descriptionJson: descriptionJson ?? null },
      });
      // Cascade-delete all existing sections (and their questions via FK)
      await tx.practiceAnamnesisSection.deleteMany({ where: { templateId: req.params.templateId } });
      // Also delete any unsectioned questions
      await tx.practiceAnamnesisQuestion.deleteMany({ where: { templateId: req.params.templateId } });

      if (Array.isArray(sections) && sections.length) {
        await buildSectionsInTx(tx, req.params.templateId, sections);
      }
      return tx.practiceAnamnesisTemplate.findUnique({ where: { id: req.params.templateId }, include: TEMPLATE_INCLUDE });
    });

    return res.json({ ok: true, template });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

router.delete("/templates/:templateId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, true);
    const existing = await prisma.practiceAnamnesisTemplate.findUnique({ where: { id: req.params.templateId } });
    if (!existing || existing.practiceProfileId !== pid) throw new Error("template_not_found");
    await prisma.practiceAnamnesisTemplate.delete({ where: { id: req.params.templateId } });
    return res.json({ ok: true });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

// ── Links ─────────────────────────────────────────────────────────────────────

router.get("/templates/:templateId/links", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, false);
    const template = await prisma.practiceAnamnesisTemplate.findUnique({ where: { id: req.params.templateId } });
    if (!template || template.practiceProfileId !== pid) throw new Error("template_not_found");
    const links = await prisma.practiceAnamnesisLink.findMany({
      where: { templateId: req.params.templateId, practiceProfileId: pid },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, label: true, tokenPrefix: true, isActive: true,
        expiresAt: true, disabledAt: true, createdAt: true, updatedAt: true,
        _count: { select: { submissions: true } },
      },
    });
    return res.json({ ok: true, links });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

router.post("/templates/:templateId/links", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, true);
    const template = await prisma.practiceAnamnesisTemplate.findUnique({ where: { id: req.params.templateId } });
    if (!template || template.practiceProfileId !== pid) throw new Error("template_not_found");
    const { label, expiresAt } = req.body;
    const { raw, hash, prefix } = generateLinkToken();
    const link = await prisma.practiceAnamnesisLink.create({
      data: {
        practiceProfileId: pid,
        templateId: req.params.templateId,
        createdByUserId: uid,
        tokenHash: hash,
        tokenPrefix: prefix,
        label: typeof label === "string" && label.trim() ? label.trim() : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      select: {
        id: true, label: true, tokenPrefix: true, isActive: true,
        expiresAt: true, createdAt: true,
      },
    });
    return res.status(201).json({ ok: true, link, rawToken: raw });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

router.patch("/templates/:templateId/links/:linkId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, true);
    const link = await prisma.practiceAnamnesisLink.findUnique({ where: { id: req.params.linkId } });
    if (!link || link.practiceProfileId !== pid || link.templateId !== req.params.templateId) {
      throw new Error("link_not_found");
    }
    const { isActive, label, expiresAt } = req.body;
    const data = {};
    if (typeof isActive === "boolean") {
      data.isActive = isActive;
      data.disabledAt = isActive ? null : new Date();
    }
    if (label !== undefined) data.label = typeof label === "string" && label.trim() ? label.trim() : null;
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
    const updated = await prisma.practiceAnamnesisLink.update({
      where: { id: req.params.linkId },
      data,
      select: {
        id: true, label: true, tokenPrefix: true, isActive: true,
        expiresAt: true, disabledAt: true, createdAt: true, updatedAt: true,
      },
    });
    return res.json({ ok: true, link: updated });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

router.delete("/templates/:templateId/links/:linkId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, true);
    const link = await prisma.practiceAnamnesisLink.findUnique({ where: { id: req.params.linkId } });
    if (!link || link.practiceProfileId !== pid || link.templateId !== req.params.templateId) {
      throw new Error("link_not_found");
    }
    await prisma.practiceAnamnesisLink.delete({ where: { id: req.params.linkId } });
    return res.json({ ok: true });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

// ── Submissions ───────────────────────────────────────────────────────────────

router.get("/templates/:templateId/submissions", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, false);
    const template = await prisma.practiceAnamnesisTemplate.findUnique({ where: { id: req.params.templateId } });
    if (!template || template.practiceProfileId !== pid) throw new Error("template_not_found");
    const submissions = await prisma.practiceAnamnesisSubmission.findMany({
      where: { templateId: req.params.templateId, practiceProfileId: pid, deletedAt: null },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true, patientLanguage: true, status: true,
        submittedAt: true, viewedAt: true, archivedAt: true,
        consentGrantedAt: true, consentVersion: true,
        link: { select: { id: true, label: true, tokenPrefix: true } },
      },
    });
    return res.json({ ok: true, submissions });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

router.get("/submissions/:submissionId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, false);
    const submission = await prisma.practiceAnamnesisSubmission.findUnique({
      where: { id: req.params.submissionId },
      include: { link: { select: { id: true, label: true, tokenPrefix: true } } },
    });
    if (!submission || submission.practiceProfileId !== pid || submission.deletedAt) {
      throw new Error("submission_not_found");
    }
    if (submission.status === "new") {
      await prisma.practiceAnamnesisSubmission.update({
        where: { id: submission.id },
        data: { status: "viewed", viewedAt: new Date() },
      });
      submission.status = "viewed";
      submission.viewedAt = new Date();
    }
    return res.json({ ok: true, submission });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

router.patch("/submissions/:submissionId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, true);
    const submission = await prisma.practiceAnamnesisSubmission.findUnique({ where: { id: req.params.submissionId } });
    if (!submission || submission.practiceProfileId !== pid || submission.deletedAt) {
      throw new Error("submission_not_found");
    }
    const { status } = req.body;
    const data = {};
    const VALID_STATUSES = new Set(["new", "viewed", "archived"]);
    if (status !== undefined) {
      if (!VALID_STATUSES.has(status)) return res.status(400).json({ ok: false, error: "invalid_status" });
      data.status = status;
      if (status === "archived" && !submission.archivedAt) data.archivedAt = new Date();
      if (status !== "archived") data.archivedAt = null;
    }
    const updated = await prisma.practiceAnamnesisSubmission.update({ where: { id: req.params.submissionId }, data });
    return res.json({ ok: true, submission: updated });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

router.delete("/submissions/:submissionId", async (req, res) => {
  const uid = uidFromReq(req);
  const pid = practiceIdFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!pid) return res.status(400).json({ ok: false, error: "practiceId_required" });
  try {
    await requireAccess(uid, pid, true);
    const submission = await prisma.practiceAnamnesisSubmission.findUnique({ where: { id: req.params.submissionId } });
    if (!submission || submission.practiceProfileId !== pid || submission.deletedAt) {
      throw new Error("submission_not_found");
    }
    await prisma.practiceAnamnesisSubmission.update({
      where: { id: req.params.submissionId },
      data: { status: "deleted", deletedAt: new Date() },
    });
    return res.json({ ok: true });
  } catch (e) {
    const { status, error } = mapError(e);
    return res.status(status).json({ ok: false, error });
  }
});

export default router;
