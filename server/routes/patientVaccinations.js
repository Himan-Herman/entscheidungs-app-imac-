/**
 * Patient vaccination pass — /api/patient/vaccinations
 * Self-reported entries only. Not an official medical record.
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import multer from "multer";
import { isVaccinationPassEnabled } from "../config/featureFlags.js";
import { writeAuditLog } from "../services/auditLogService.js";
import {
  CONTEXT_INPUT_FIELD,
  assertAllowedFields,
  assertNoContextChange,
  assertNoProvenanceOverride,
  contextErrorResponse,
  provenanceJson,
  createPatientDataWithValidatedContext,
} from "../services/patientData/patientDataContextService.js";

const router = express.Router();

const CREATE_FIELDS = [
  "vaccineName",
  "disease",
  "vaccinationDate",
  "doseLabel",
  "lotNumber",
  "location",
  "nextDueDate",
  "notes",
  CONTEXT_INPUT_FIELD,
];


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function requireFeature(req, res, next) {
  if (!isVaccinationPassEnabled()) {
    return res.status(404).json({ ok: false, error: "feature_disabled" });
  }
  return next();
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "not_found") return { status: 404, error: msg };
  if (msg === "forbidden") return { status: 403, error: msg };
  if (msg === "validation_required") return { status: 400, error: msg };
  if (msg === "file_type_invalid") return { status: 400, error: msg };
  return { status: 500, error: "request_failed" };
}

function entryToJson(row) {
  return {
    ...provenanceJson(row),
    id: row.id,
    vaccineName: row.vaccineName,
    disease: row.disease,
    vaccinationDate: row.vaccinationDate,
    doseLabel: row.doseLabel,
    lotNumber: row.lotNumber,
    location: row.location,
    nextDueDate: row.nextDueDate,
    notes: row.notes,
    hasDocument: Boolean(row.documentKey),
    documentName: row.documentName,
    documentMime: row.documentMime,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.use(requireFeature);

/** GET /api/patient/vaccinations */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const entries = await prisma.vaccinationEntry.findMany({
      where: { userId, deletedAt: null },
      orderBy: { vaccinationDate: "desc" },
    });
    return res.json({ ok: true, entries: entries.map(entryToJson) });
  } catch (err) {
    console.error("[patient/vaccinations/list]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** POST /api/patient/vaccinations */
router.post("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const { vaccineName, disease, vaccinationDate, doseLabel, lotNumber, location, nextDueDate, notes } = req.body || {};

  if (!vaccineName?.trim() || !disease?.trim() || !vaccinationDate) {
    return res.status(400).json({ ok: false, error: "validation_required" });
  }

  const vaccDate = new Date(vaccinationDate);
  if (isNaN(vaccDate.getTime()) || vaccDate > new Date()) {
    return res.status(400).json({ ok: false, error: "date_invalid" });
  }

  // Explicit allowlist: a client may describe the record and, optionally, name
  // ONE care relationship. Anything else — including any provenance field — is
  // refused rather than silently dropped.
  //
  // The context itself is decided by the server from that link alone; no
  // practiceId, dataScope or user id from the request influences it.
  try {
    assertAllowedFields(req.body, CREATE_FIELDS);
    assertNoProvenanceOverride(req.body);
  } catch (e) {
    const mapped = contextErrorResponse(e);
    if (mapped) return res.status(mapped.status).json(mapped.body);
    throw e;
  }

  try {
    // Context resolution and insert share ONE serializable transaction with a
    // row lock on the link, so a concurrent revocation cannot slip in between.
    const entry = await createPatientDataWithValidatedContext({
      patientUserId: userId,
      requestedPracticePatientLinkId: req.body?.[CONTEXT_INPUT_FIELD],
      createRecord: (tx, context) =>
        tx.vaccinationEntry.create({
          data: {
            userId,
            ...context,
            vaccineName: String(vaccineName).trim().slice(0, 200),
            disease: String(disease).trim().slice(0, 200),
            vaccinationDate: vaccDate,
            doseLabel: doseLabel ? String(doseLabel).trim().slice(0, 80) : null,
            lotNumber: lotNumber ? String(lotNumber).trim().slice(0, 80) : null,
            location: location ? String(location).trim().slice(0, 200) : null,
            nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
            notes: notes ? String(notes).trim().slice(0, 2000) : null,
          },
        }),
    });

    writeAuditLog({
      req,
      userId,
      actorRole: "patient",
      action: "vaccination_entry.created",
      entityType: "vaccination_entry",
      entityId: entry.id,
      metadata: { disease: entry.disease },
    });

    return res.status(201).json({ ok: true, entry: entryToJson(entry) });
  } catch (err) {
    const mapped = contextErrorResponse(err);
    if (mapped) return res.status(mapped.status).json(mapped.body);
    console.error("[patient/vaccinations/create]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** PATCH /api/patient/vaccinations/:id */
router.patch("/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  // Provenance is immutable: no ordinary update may move a record between
  // scopes or between care relationships. A controlled correction would need
  // its own audited, administrative process.
  try {
    assertNoContextChange(req.body);
  } catch (e) {
    const mapped = contextErrorResponse(e);
    if (mapped) return res.status(mapped.status).json(mapped.body);
    throw e;
  }

  try {
    const existing = await prisma.vaccinationEntry.findFirst({
      where: { id: req.params.id, userId, deletedAt: null },
    });
    if (!existing) throw new Error("not_found");

    const { vaccineName, disease, vaccinationDate, doseLabel, lotNumber, location, nextDueDate, notes } = req.body || {};

    if (!vaccineName?.trim() || !disease?.trim() || !vaccinationDate) {
      return res.status(400).json({ ok: false, error: "validation_required" });
    }

    const vaccDate = new Date(vaccinationDate);
    if (isNaN(vaccDate.getTime()) || vaccDate > new Date()) {
      return res.status(400).json({ ok: false, error: "date_invalid" });
    }

    const updated = await prisma.vaccinationEntry.update({
      where: { id: existing.id },
      data: {
        vaccineName: String(vaccineName).trim().slice(0, 200),
        disease: String(disease).trim().slice(0, 200),
        vaccinationDate: vaccDate,
        doseLabel: doseLabel ? String(doseLabel).trim().slice(0, 80) : null,
        lotNumber: lotNumber ? String(lotNumber).trim().slice(0, 80) : null,
        location: location ? String(location).trim().slice(0, 200) : null,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        notes: notes ? String(notes).trim().slice(0, 2000) : null,
      },
    });

    writeAuditLog({
      req,
      userId,
      actorRole: "patient",
      action: "vaccination_entry.updated",
      entityType: "vaccination_entry",
      entityId: updated.id,
    });

    return res.json({ ok: true, entry: entryToJson(updated) });
  } catch (err) {
    console.error("[patient/vaccinations/update]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** DELETE /api/patient/vaccinations/:id */
router.delete("/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const existing = await prisma.vaccinationEntry.findFirst({
      where: { id: req.params.id, userId, deletedAt: null },
    });
    if (!existing) throw new Error("not_found");

    await prisma.vaccinationEntry.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    writeAuditLog({
      req,
      userId,
      actorRole: "patient",
      action: "vaccination_entry.deleted",
      entityType: "vaccination_entry",
      entityId: existing.id,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[patient/vaccinations/delete]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/patient/vaccinations/:id/document */
router.post("/:id/document", upload.single("file"), async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  if (!req.file) return res.status(400).json({ ok: false, error: "file_required" });

  try {
    const existing = await prisma.vaccinationEntry.findFirst({
      where: { id: req.params.id, userId, deletedAt: null },
    });
    if (!existing) throw new Error("not_found");

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(req.file.mimetype)) throw new Error("file_type_invalid");

    const key = `vaccinations/${userId}/${existing.id}_${Date.now()}_${req.file.originalname.slice(0, 60)}`;

    const updated = await prisma.vaccinationEntry.update({
      where: { id: existing.id },
      data: {
        documentKey: key,
        documentName: req.file.originalname.slice(0, 200),
        documentMime: req.file.mimetype,
      },
    });

    writeAuditLog({
      req,
      userId,
      actorRole: "patient",
      action: "vaccination_entry.document_uploaded",
      entityType: "vaccination_entry",
      entityId: existing.id,
      metadata: { mimeType: req.file.mimetype },
    });

    return res.json({ ok: true, entry: entryToJson(updated) });
  } catch (err) {
    console.error("[patient/vaccinations/document]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** DELETE /api/patient/vaccinations/:id/document */
router.delete("/:id/document", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const existing = await prisma.vaccinationEntry.findFirst({
      where: { id: req.params.id, userId, deletedAt: null },
    });
    if (!existing) throw new Error("not_found");

    await prisma.vaccinationEntry.update({
      where: { id: existing.id },
      data: { documentKey: null, documentName: null, documentMime: null },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[patient/vaccinations/document-delete]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
