/**
 * Pre-Visit saved sessions API (authenticated).
 *
 * IMPORTANT — consent / UX (frontend not wired here):
 * Cloud persistence must only run after the user has explicitly agreed in the UI
 * to store their structured answers on the server (see privacy copy). Do not call
 * these endpoints without that consent flow.
 *
 * Identity: always use requireAuth + req.user.userId from the JWT.
 * Never trust userId from the request body or query.
 */

import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const router = express.Router();

const ALLOWED_STATUS = new Set(["draft", "pdf_created", "completed"]);
const TITLE_MAX = 120;

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function validateAnswers(answers, required) {
  if (required && (answers === undefined || answers === null)) {
    return { ok: false, error: "answers_required" };
  }
  if (!required && (answers === undefined || answers === null)) {
    return { ok: true, skip: true };
  }
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return { ok: false, error: "answers_must_be_object" };
  }
  return { ok: true };
}

function normalizeTitle(title) {
  if (title === undefined || title === null) return { ok: true, value: null };
  if (typeof title !== "string") return { ok: false, error: "title_invalid" };
  const t = title.trim();
  if (t.length > TITLE_MAX) return { ok: false, error: "title_too_long" };
  return { ok: true, value: t.length ? t : null };
}

function normalizeStatus(status, fallback) {
  const s = status === undefined || status === null ? fallback : status;
  if (typeof s !== "string" || !ALLOWED_STATUS.has(s)) {
    return { ok: false, error: "invalid_status" };
  }
  return { ok: true, value: s };
}

/** Optional language field: null clears; invalid types rejected. */
function normalizeDoctorLanguageField(v) {
  if (v === undefined) return { ok: true, omit: true };
  if (v === null) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false, error: "doctorLanguage_invalid" };
  const t = v.trim();
  return { ok: true, value: t.length ? t : null };
}

/** Strip internal fields from responses (no userId echoed). */
function sessionJson(row) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    preVisitCaseId: row.preVisitCaseId ?? null,
    patientLanguage: row.patientLanguage,
    doctorLanguage: row.doctorLanguage,
    title: row.title,
    status: row.status,
    pdfDownloaded: row.pdfDownloaded,
    answers: row.answers,
    aiDoctorVersion: row.aiDoctorVersion ?? null,
    aiSafetyNotice: row.aiSafetyNotice ?? null,
  };
}

async function resolvePreVisitCaseId(userId, raw) {
  if (raw === undefined) return { omit: true };
  if (raw === null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "preVisitCaseId_invalid" };
  const cid = raw.trim();
  if (!cid) return { ok: true, value: null };
  const row = await prisma.preVisitCase.findFirst({
    where: { id: cid, userId },
  });
  if (!row) return { ok: false, error: "preVisitCase_not_found" };
  return { ok: true, value: cid };
}

function safeServerError(res, err, context) {
  console.error(`[previsit/sessions] ${context}`, err?.message ?? err);
  return res.status(500).json({ ok: false, error: "server_error" });
}

/**
 * GET / — list current user's sessions (newest first).
 */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const rows = await prisma.preVisitSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ ok: true, sessions: rows.map(sessionJson) });
  } catch (err) {
    return safeServerError(res, err, "list");
  }
});

/**
 * POST / — create session.
 */
router.post("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const body = req.body ?? {};
  const {
    patientLanguage,
    doctorLanguage,
    answers,
    aiDoctorVersion,
    aiSafetyNotice,
    title,
    status,
    pdfDownloaded: pdfDownloadedBody,
  } = body;

  if (
    pdfDownloadedBody !== undefined &&
    pdfDownloadedBody !== null &&
    typeof pdfDownloadedBody !== "boolean"
  ) {
    return res.status(400).json({ ok: false, error: "pdfDownloaded_invalid" });
  }

  if (!patientLanguage || typeof patientLanguage !== "string" || !patientLanguage.trim()) {
    return res.status(400).json({ ok: false, error: "patientLanguage_required" });
  }

  const ans = validateAnswers(answers, true);
  if (!ans.ok) return res.status(400).json({ ok: false, error: ans.error });

  const st = normalizeStatus(status, "draft");
  if (!st.ok) return res.status(400).json({ ok: false, error: st.error });

  const ti = normalizeTitle(title);
  if (!ti.ok) return res.status(400).json({ ok: false, error: ti.error });

  let docLang = null;
  if (doctorLanguage !== undefined) {
    const dl = normalizeDoctorLanguageField(doctorLanguage);
    if (!dl.ok) return res.status(400).json({ ok: false, error: dl.error });
    docLang = dl.value;
  }

  let aiNotice = null;
  if (aiSafetyNotice !== undefined && aiSafetyNotice !== null) {
    if (typeof aiSafetyNotice !== "string") {
      return res.status(400).json({ ok: false, error: "aiSafetyNotice_invalid" });
    }
    aiNotice = aiSafetyNotice;
  }

  let pdfDownloaded = pdfDownloadedBody === true;
  if (st.value === "pdf_created") {
    pdfDownloaded = true;
  }

  let preVisitCaseIdValue;
  let includePreVisitCaseId = false;
  if (Object.prototype.hasOwnProperty.call(body, "preVisitCaseId")) {
    const cr = await resolvePreVisitCaseId(userId, body.preVisitCaseId);
    if (!cr.omit && !cr.ok) {
      return res.status(400).json({ ok: false, error: cr.error });
    }
    if (!cr.omit) {
      includePreVisitCaseId = true;
      preVisitCaseIdValue = cr.value;
    }
  }

  try {
    const created = await prisma.preVisitSession.create({
      data: {
        userId,
        patientLanguage: patientLanguage.trim(),
        doctorLanguage: docLang,
        title: ti.value,
        status: st.value,
        pdfDownloaded,
        answers,
        aiDoctorVersion:
          aiDoctorVersion === undefined || aiDoctorVersion === null ? null : aiDoctorVersion,
        aiSafetyNotice: aiNotice,
        ...(includePreVisitCaseId ? { preVisitCaseId: preVisitCaseIdValue } : {}),
      },
    });
    return res.status(201).json({ ok: true, session: sessionJson(created) });
  } catch (err) {
    return safeServerError(res, err, "create");
  }
});

/**
 * GET /:id — single session owned by user.
 */
router.get("/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const { id } = req.params;

  try {
    const row = await prisma.preVisitSession.findFirst({
      where: { id, userId },
    });
    if (!row) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }
    return res.json({ ok: true, session: sessionJson(row) });
  } catch (err) {
    return safeServerError(res, err, "get");
  }
});

/**
 * PUT /:id — update session (partial).
 */
router.put("/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const { id } = req.params;
  const body = req.body ?? {};

  try {
    const existing = await prisma.preVisitSession.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    const data = {};

    if (Object.prototype.hasOwnProperty.call(body, "patientLanguage")) {
      const pl = body.patientLanguage;
      if (typeof pl !== "string" || !pl.trim()) {
        return res.status(400).json({ ok: false, error: "patientLanguage_invalid" });
      }
      data.patientLanguage = pl.trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, "doctorLanguage")) {
      const dl = normalizeDoctorLanguageField(body.doctorLanguage);
      if (!dl.ok) return res.status(400).json({ ok: false, error: dl.error });
      if (!dl.omit) data.doctorLanguage = dl.value;
    }

    if (Object.prototype.hasOwnProperty.call(body, "answers")) {
      const ans = validateAnswers(body.answers, true);
      if (!ans.ok) return res.status(400).json({ ok: false, error: ans.error });
      data.answers = body.answers;
    }

    if (Object.prototype.hasOwnProperty.call(body, "aiDoctorVersion")) {
      data.aiDoctorVersion =
        body.aiDoctorVersion === undefined || body.aiDoctorVersion === null
          ? null
          : body.aiDoctorVersion;
    }

    if (Object.prototype.hasOwnProperty.call(body, "aiSafetyNotice")) {
      if (body.aiSafetyNotice !== null && typeof body.aiSafetyNotice !== "string") {
        return res.status(400).json({ ok: false, error: "aiSafetyNotice_invalid" });
      }
      data.aiSafetyNotice = body.aiSafetyNotice;
    }

    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      const ti = normalizeTitle(body.title);
      if (!ti.ok) return res.status(400).json({ ok: false, error: ti.error });
      data.title = ti.value;
    }

    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      const st = normalizeStatus(body.status, null);
      if (!st.ok) return res.status(400).json({ ok: false, error: st.error });
      data.status = st.value;
    }

    if (Object.prototype.hasOwnProperty.call(body, "pdfDownloaded")) {
      const p = body.pdfDownloaded;
      if (p !== true && p !== false) {
        return res.status(400).json({ ok: false, error: "pdfDownloaded_invalid" });
      }
      data.pdfDownloaded = p;
    }

    if (Object.prototype.hasOwnProperty.call(body, "preVisitCaseId")) {
      const cr = await resolvePreVisitCaseId(userId, body.preVisitCaseId);
      if (!cr.omit && !cr.ok) {
        return res.status(400).json({ ok: false, error: cr.error });
      }
      if (!cr.omit) data.preVisitCaseId = cr.value;
    }

    const nextStatus =
      data.status !== undefined ? data.status : existing.status;
    if (nextStatus === "pdf_created") {
      data.pdfDownloaded = true;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: "no_fields_to_update" });
    }

    const updated = await prisma.preVisitSession.update({
      where: { id },
      data,
    });

    return res.json({ ok: true, session: sessionJson(updated) });
  } catch (err) {
    return safeServerError(res, err, "update");
  }
});

/**
 * DELETE / — delete all sessions for current user.
 * Registered before DELETE /:id so `/` is not captured as an id.
 */
router.delete("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const result = await prisma.preVisitSession.deleteMany({
      where: { userId },
    });
    return res.json({ ok: true, deletedCount: result.count });
  } catch (err) {
    return safeServerError(res, err, "deleteAll");
  }
});

/**
 * DELETE /:id — delete one session owned by user.
 */
router.delete("/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const { id } = req.params;

  try {
    const result = await prisma.preVisitSession.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }
    return res.json({ ok: true, deleted: true });
  } catch (err) {
    return safeServerError(res, err, "deleteOne");
  }
});

export default router;
