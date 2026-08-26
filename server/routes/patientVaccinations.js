/**
 * Patient vaccination pass — /api/patient/vaccinations
 * Self-reported entries only. Not an official medical record.
 */

import crypto from "node:crypto";
import {
  isStoredVaccinationKey,
  VACCINATION_DOCUMENT_MAX_BYTES,
  VACCINATION_DOCUMENT_MIME,
  vaccinationDocumentStorage,
} from "../services/vaccination/vaccinationDocumentStorage.js";
import {
  assertDeclaredTypeMatchesBytes,
  normalizeMime,
  safeDisplayFilename,
} from "../utils/fileSignature.js";
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
  // A payload that is not what it claims is a bad request, not a server fault.
  // Both codes answer the same way: telling the sender WHICH check they failed
  // would say how close they came, and a real client knows what it uploaded.
  if (msg === "file_type_not_allowed" || msg === "file_type_mismatch") {
    return { status: 400, error: "file_type_invalid" };
  }
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
    // Only a key this server actually wrote a file for counts as a document.
    //
    // Rows written before vaccination storage existed carry a key that names
    // nothing: the buffer was discarded and no route could ever have fetched
    // it. Reporting those as `true` is what told patients their certificate was
    // attached when it was not, so the prefix — not the mere presence of a
    // string — is what this asks about. No migration needed; the old rows
    // simply stop claiming something they cannot back up.
    hasDocument: isStoredVaccinationKey(row.documentKey),
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


/**
 * Sends a stored certificate with the headers a medical document needs.
 *
 * `attachment` so nothing renders in the page's own origin; `nosniff` so the
 * browser does not override that on its own; `no-store, private` so a shared
 * cache never keeps a copy. The filename is the sanitised display name, which
 * by construction carries no separators.
 *
 * @param {import("express").Response} res
 * @param {{ documentName: string | null, documentMime: string | null }} entry
 * @param {Buffer} buffer
 */
function sendVaccinationDocument(res, entry, buffer) {
  const filename = safeDisplayFilename(entry.documentName, "impfnachweis");
  res.setHeader("Content-Type", entry.documentMime || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store, private");
  return res.send(buffer);
}

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

    // Declared type first, then the bytes: the Content-Type on a multipart part
    // is written by the client, so on its own it is a statement of intent.
    assertDeclaredTypeMatchesBytes(
      req.file.buffer,
      req.file.mimetype,
      VACCINATION_DOCUMENT_MIME,
    );

    if (req.file.buffer.length > VACCINATION_DOCUMENT_MAX_BYTES) {
      throw new Error("validation_file_too_large");
    }

    /*
     * The file is written FIRST, and the row only afterwards.
     *
     * There is no transaction spanning a filesystem and a database, so one of
     * the two orderings has to be chosen deliberately. This one can leave a
     * file that no row points at — invisible, harmless, and reclaimable. The
     * other ordering leaves a row claiming a document that does not exist,
     * which is the exact defect being fixed here: the patient is told their
     * vaccination certificate is attached when nothing was ever stored.
     *
     * If the row update then fails, the orphan is removed straight away, so
     * the leak needs a crash between the two lines to happen at all.
     */
    const previousKey = existing.documentKey;
    const key = await vaccinationDocumentStorage.putDocument({
      userId,
      buffer: req.file.buffer,
      mimeType: normalizeMime(req.file.mimetype),
    });

    let updated;
    try {
      updated = await prisma.vaccinationEntry.update({
        where: { id: existing.id },
        data: {
          documentKey: key,
          // Kept for display only, with separators and control characters gone.
          documentName: safeDisplayFilename(req.file.originalname).slice(0, 200),
          documentMime: normalizeMime(req.file.mimetype),
        },
      });
    } catch (err) {
      await vaccinationDocumentStorage.deleteDocument(key);
      throw err;
    }

    // Replacing a document leaves the old file behind otherwise. Done after the
    // row is committed, so a failure here costs a stale file and never the new
    // one the patient just uploaded.
    if (previousKey && previousKey !== key) {
      await vaccinationDocumentStorage.deleteDocument(previousKey);
    }

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

/**
 * GET /api/patient/vaccinations/:id/document
 *
 * The route that did not exist. Without it, uploading was a one-way trip: the
 * patient was shown "Dokument" against their entry and had no way to ever see
 * it again — which is part of why nobody noticed the file was never stored.
 *
 * Authorization is re-derived here from the token, not carried over from the
 * upload: `userId` scopes the lookup, so one patient's certificate is not
 * reachable with another patient's session and a guessed entry id.
 */
router.get("/:id/document", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const entry = await prisma.vaccinationEntry.findFirst({
      where: { id: req.params.id, userId, deletedAt: null },
    });
    if (!entry || !isStoredVaccinationKey(entry.documentKey)) throw new Error("not_found");

    const buffer = await vaccinationDocumentStorage.getDocument(entry.documentKey);
    return sendVaccinationDocument(res, entry, buffer);
  } catch (err) {
    console.error("[patient/vaccinations/document-get]", err?.message ?? err);
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

    // The row is cleared first: after this the document is unreachable through
    // any route, which is what the patient asked for. The file is then removed.
    // Failing in between leaves an orphan nobody can reach, never a reachable
    // document the patient believes they deleted.
    await prisma.vaccinationEntry.update({
      where: { id: existing.id },
      data: { documentKey: null, documentName: null, documentMime: null },
    });
    await vaccinationDocumentStorage.deleteDocument(existing.documentKey);

    return res.json({ ok: true });
  } catch (err) {
    console.error("[patient/vaccinations/document-delete]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
