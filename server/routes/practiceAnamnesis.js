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
  descriptionJson: { de: "Allgemeine Gesprächsvorbereitung — bitte nach Bedarf kopieren und anpassen. Kein Ersatz für das ärztliche Gespräch.", en: "General pre-appointment questionnaire — copy and customise as needed. Not a substitute for the physician consultation.", fr: "Préparation générale au rendez-vous — à copier et personnaliser. Ne remplace pas la consultation médicale.", it: "Preparazione generale all'appuntamento — da copiare e personalizzare. Non sostituisce la visita medica.", es: "Preparación general para la cita — copiar y personalizar según sea necesario. No reemplaza la consulta médica." },
  sections: [
    {
      titleJson: { de: "Aktuelles Anliegen", en: "Current Complaint", fr: "Motif de la visite", it: "Motivo della visita", es: "Motivo de la consulta" },
      questions: [
        { type: "textarea", isRequired: true,  labelJson: { de: "Was ist Ihr Hauptanliegen / Ihre Hauptbeschwerde?", en: "What is your main complaint / reason for the visit?", fr: "Quelle est votre plainte principale / raison de la visite ?", it: "Qual è il suo problema principale / motivo della visita?", es: "¿Cuál es su queja principal / motivo de la visita?" }, hintJson: { de: "Bitte so genau wie möglich beschreiben", en: "Please describe as precisely as possible", fr: "Décrivez aussi précisément que possible", it: "Descrivere il più precisamente possibile", es: "Describa lo más preciso posible" } },
        { type: "text",     isRequired: true,  labelJson: { de: "Seit wann bestehen die Beschwerden?", en: "How long have you had these symptoms?", fr: "Depuis quand avez-vous ces symptômes ?", it: "Da quanto tempo ha questi sintomi?", es: "¿Desde cuándo tiene estos síntomas?" }, hintJson: { de: "z. B. seit 3 Tagen, seit 2 Wochen", en: "e.g. for 3 days, for 2 weeks", fr: "p. ex. depuis 3 jours", it: "es. da 3 giorni", es: "p. ej. desde hace 3 días" } },
        { type: "text",     isRequired: false, labelJson: { de: "Wo treten die Beschwerden auf?", en: "Where are the symptoms located?", fr: "Où se situent les symptômes ?", it: "Dove si manifestano i sintomi?", es: "¿Dónde se localizan los síntomas?" } },
      ],
    },
    {
      titleJson: { de: "Beschwerden und Verlauf", en: "Symptoms and Course", fr: "Symptômes et évolution", it: "Sintomi e decorso", es: "Síntomas y evolución" },
      questions: [
        { type: "single_choice", isRequired: false, labelJson: { de: "Haben sich die Beschwerden verändert?", en: "Have your symptoms changed?", fr: "Vos symptômes ont-ils évolué ?", it: "I suoi sintomi sono cambiati?", es: "¿Han cambiado sus síntomas?" }, optionsJson: [{ de: "Besser", en: "Better", fr: "Mieux", it: "Meglio", es: "Mejor" }, { de: "Schlechter", en: "Worse", fr: "Pire", it: "Peggio", es: "Peor" }, { de: "Unverändert", en: "Unchanged", fr: "Inchangé", it: "Invariato", es: "Sin cambios" }, { de: "Wechselnd", en: "Fluctuating", fr: "Variable", it: "Variabile", es: "Variable" }] },
        { type: "textarea",     isRequired: false, labelJson: { de: "Gibt es Begleitsymptome?", en: "Are there accompanying symptoms?", fr: "Y a-t-il des symptômes associés ?", it: "Ci sono sintomi associati?", es: "¿Hay síntomas acompañantes?" }, hintJson: { de: "z. B. Fieber, Übelkeit, Schwindel", en: "e.g. fever, nausea, dizziness", fr: "p. ex. fièvre, nausées, vertiges", it: "es. febbre, nausea, vertigini", es: "p. ej. fiebre, náuseas, mareos" } },
        { type: "number",       isRequired: false, labelJson: { de: "Schmerzstärke (0 = kein Schmerz, 10 = unerträglicher Schmerz)", en: "Pain intensity (0 = no pain, 10 = unbearable)", fr: "Intensité de la douleur (0 = sans douleur, 10 = insupportable)", it: "Intensità del dolore (0 = nessun dolore, 10 = insopportabile)", es: "Intensidad del dolor (0 = sin dolor, 10 = insoportable)" } },
      ],
    },
    {
      titleJson: { de: "Medikamente & Allergien", en: "Medications & Allergies", fr: "Médicaments & allergies", it: "Farmaci & allergie", es: "Medicamentos & alergias" },
      questions: [
        { type: "textarea", isRequired: false, labelJson: { de: "Nehmen Sie aktuell Medikamente? (Name, Dosierung, Häufigkeit)", en: "Do you currently take any medications? (name, dosage, frequency)", fr: "Prenez-vous actuellement des médicaments ? (nom, dosage, fréquence)", it: "Assume attualmente farmaci? (nome, dosaggio, frequenza)", es: "¿Toma actualmente medicamentos? (nombre, dosis, frecuencia)" } },
        { type: "textarea", isRequired: false, labelJson: { de: "Sind Allergien oder Unverträglichkeiten bekannt?", en: "Are any allergies or intolerances known?", fr: "Des allergies ou intolérances sont-elles connues ?", it: "Sono note allergie o intolleranze?", es: "¿Se conocen alergias o intolerancias?" }, hintJson: { de: "z. B. Penicillin, Latex, Nüsse", en: "e.g. penicillin, latex, nuts", fr: "p. ex. pénicilline, latex", it: "es. penicillina, lattice", es: "p. ej. penicilina, látex" } },
      ],
    },
    {
      titleJson: { de: "Vorerkrankungen & Operationen", en: "Medical History & Surgeries", fr: "Antécédents médicaux & chirurgies", it: "Anamnesi & interventi", es: "Antecedentes & cirugías" },
      questions: [
        { type: "textarea", isRequired: false, labelJson: { de: "Sind relevante Vorerkrankungen bekannt?", en: "Are there any relevant medical conditions?", fr: "Y a-t-il des antécédents médicaux pertinents ?", it: "Ci sono patologie rilevanti note?", es: "¿Existen enfermedades previas relevantes?" }, hintJson: { de: "z. B. Bluthochdruck, Diabetes, Herzerkrankung", en: "e.g. hypertension, diabetes, heart disease", fr: "p. ex. hypertension, diabète", it: "es. ipertensione, diabete", es: "p. ej. hipertensión, diabetes" } },
        { type: "textarea", isRequired: false, labelJson: { de: "Gab es frühere Operationen?", en: "Have you had any previous surgeries?", fr: "Avez-vous déjà subi des opérations ?", it: "Ha avuto interventi chirurgici precedenti?", es: "¿Ha tenido cirugías previas?" } },
      ],
    },
    {
      titleJson: { de: "Wichtige Hinweise für die Praxis", en: "Important Notes for the Practice", fr: "Remarques importantes pour le cabinet", it: "Note importanti per lo studio", es: "Notas importantes para la consulta" },
      questions: [
        { type: "textarea", isRequired: false, labelJson: { de: "Gibt es etwas, das die Praxis vor dem Termin wissen sollte?", en: "Is there anything the practice should know before the appointment?", fr: "Y a-t-il quelque chose que le cabinet devrait savoir avant le rendez-vous ?", it: "C'è qualcosa che lo studio dovrebbe sapere prima dell'appuntamento?", es: "¿Hay algo que la consulta deba saber antes de la cita?" } },
        { type: "textarea", isRequired: false, labelJson: { de: "Welche Fragen möchten Sie im Termin stellen?", en: "What questions would you like to ask during the appointment?", fr: "Quelles questions souhaitez-vous poser lors du rendez-vous ?", it: "Quali domande desidera porre durante la visita?", es: "¿Qué preguntas le gustaría hacer durante la cita?" } },
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
    const updated = await prisma.practiceAnamnesisSubmission.update({
      where: { id: req.params.submissionId },
      data,
      select: {
        id: true, status: true, viewedAt: true, archivedAt: true, updatedAt: true,
      },
    });
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
