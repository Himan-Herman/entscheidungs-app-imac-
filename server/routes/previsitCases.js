/**
 * Authenticated Pre-Visit case / longitudinal timeline grouping.
 */

import express from "express";
import { PrismaClient } from "@prisma/client";
import { summarizeCaseContinuity } from "../services/preVisitCaseContinuityClient.js";
import { previsitCaseContinuityLimiter } from "../middleware/ipRateLimit.js";
import { trackAnalyticsEvent } from "../services/analyticsService.js";

const prisma = new PrismaClient();
const router = express.Router();

const TITLE_MAX = 140;
const DESC_MAX = 2000;
const CAT_MAX = 80;

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function normalizeTitle(v, required = false) {
  if (v === undefined || v === null) {
    return required ? { ok: false, error: "title_required" } : { ok: true, value: undefined };
  }
  if (typeof v !== "string") return { ok: false, error: "title_invalid" };
  const t = v.trim().slice(0, TITLE_MAX);
  if (!t && required) return { ok: false, error: "title_required" };
  return { ok: true, value: t || undefined };
}

function normalizeOpt(v, max) {
  if (v === undefined || v === null) return { ok: true, value: undefined };
  if (typeof v !== "string") return { ok: false, error: "invalid_string_field" };
  const t = v.trim().slice(0, max);
  return { ok: true, value: t.length ? t : null };
}

function sessionTimelineJson(row) {
  const ans =
    row.answers && typeof row.answers === "object" && !Array.isArray(row.answers)
      ? row.answers
      : {};
  const reason = String(ans.appointmentReason || "").trim();
  const preview =
    reason ||
    String(ans.symptomsOwnWords || "").trim().slice(0, 160) ||
    "";
  let practiceSnippet = "";
  const pc = ans.practiceContext;
  if (pc && typeof pc === "object") {
    const bits = [
      pc.practiceName ? String(pc.practiceName) : "",
      pc.targetName ? String(pc.targetName) : "",
    ].filter(Boolean);
    practiceSnippet = bits.join(" · ");
  }
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    title: row.title,
    status: row.status,
    pdfDownloaded: row.pdfDownloaded,
    patientLanguage: row.patientLanguage,
    appointmentReasonPreview: preview ? preview.slice(0, 200) : "",
    practiceContextSnippet: practiceSnippet.slice(0, 200),
  };
}

function caseListJson(row) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    title: row.title,
    description: row.description,
    category: row.category,
    isArchived: row.isArchived,
    _count: row._count,
  };
}

/** Server-side compact text for adaptive intake (no AI); cost-aware truncation. */
function buildCompactIntakeContextFromSessions(sessions) {
  const parts = [];
  const maxSessions = 4;
  const slice = [...sessions].slice(-maxSessions);
  const perFieldCap = 180;
  for (const row of slice) {
    const ans =
      row.answers && typeof row.answers === "object" && !Array.isArray(row.answers)
        ? row.answers
        : {};
    const block = [
      `Session ${new Date(row.createdAt).toISOString().slice(0, 10)}:`,
      ans.appointmentReason
        ? `reason: ${String(ans.appointmentReason).slice(0, perFieldCap)}`
        : "",
      ans.symptomsOwnWords
        ? `symptoms: ${String(ans.symptomsOwnWords).slice(0, perFieldCap)}`
        : "",
      ans.medications
        ? `medications: ${String(ans.medications).slice(0, perFieldCap)}`
        : "",
      ans.preExistingConditions
        ? `conditions: ${String(ans.preExistingConditions).slice(0, perFieldCap)}`
        : "",
      ans.patientQuestions
        ? `questions: ${String(ans.patientQuestions).slice(0, perFieldCap)}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");
    if (block.length > 20) parts.push(block);
  }
  let text = parts.join("\n").slice(0, 2400);
  if (parts.length === 0) {
    text = "";
  }
  return { snippet: text, sessionCountUsed: slice.length };
}

router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const archived = req.query.archived === "1" || req.query.archived === "true";

  try {
    const rows = await prisma.preVisitCase.findMany({
      where: {
        userId,
        isArchived: archived,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { sessions: true } } },
    });
    return res.json({ ok: true, cases: rows.map(caseListJson) });
  } catch (err) {
    console.error("[previsit/cases] list", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/:caseId/compact-intake-context", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const { caseId } = req.params;

  try {
    const row = await prisma.preVisitCase.findFirst({
      where: { id: caseId, userId },
      include: { sessions: { orderBy: { createdAt: "asc" } } },
    });
    if (!row) return res.status(404).json({ ok: false, error: "not_found" });
    const built = buildCompactIntakeContextFromSessions(row.sessions);
    return res.json({ ok: true, ...built, caseTitle: row.title });
  } catch (err) {
    console.error("[previsit/cases] compact-intake-context", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/:caseId/continuity-summary", previsitCaseContinuityLimiter, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const { caseId } = req.params;
  const body = req.body || {};
  const patientLanguage = String(body.patientLanguage || "de").slice(0, 12);
  const doctorLanguage = String(body.doctorLanguage || "de").slice(0, 12);

  try {
    const row = await prisma.preVisitCase.findFirst({
      where: { id: caseId, userId },
      include: { sessions: { orderBy: { createdAt: "asc" } } },
    });
    if (!row) return res.status(404).json({ ok: false, error: "not_found" });
    if (row.sessions.length === 0) {
      return res.status(400).json({ ok: false, error: "no_sessions" });
    }
    const result = await summarizeCaseContinuity({
      caseTitle: row.title,
      sessions: row.sessions.map((s) => ({
        createdAt: s.createdAt,
        answers: s.answers,
      })),
      patientLanguage,
      doctorLanguage,
    });
    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const safe =
      err.safeMessage ||
      (status >= 500
        ? "Something went wrong. Please try again later."
        : "Invalid request.");
    if (!err.statusCode) {
      console.error("[previsit/cases/continuity-summary]", err);
    }
    return res.status(status).json({ ok: false, error: safe });
  }
});

router.post("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const body = req.body || {};
  const ti = normalizeTitle(body.title, true);
  if (!ti.ok) return res.status(400).json({ ok: false, error: ti.error });
  const desc = normalizeOpt(body.description, DESC_MAX);
  if (!desc.ok) return res.status(400).json({ ok: false, error: desc.error });
  const cat = normalizeOpt(body.category, CAT_MAX);
  if (!cat.ok) return res.status(400).json({ ok: false, error: cat.error });

  try {
    const created = await prisma.preVisitCase.create({
      data: {
        userId,
        title: ti.value,
        description: desc.value ?? null,
        category: cat.value ?? null,
        isArchived: body.isArchived === true,
      },
    });
    void trackAnalyticsEvent({
      eventType: "case_created",
      userId,
      metadata: {},
    });
    return res.status(201).json({
      ok: true,
      case: {
        id: created.id,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        title: created.title,
        description: created.description,
        category: created.category,
        isArchived: created.isArchived,
        _count: { sessions: 0 },
      },
    });
  } catch (err) {
    console.error("[previsit/cases] create", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/:caseId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const { caseId } = req.params;

  try {
    const row = await prisma.preVisitCase.findFirst({
      where: { id: caseId, userId },
      include: {
        sessions: { orderBy: { createdAt: "asc" } },
        _count: { select: { sessions: true } },
      },
    });
    if (!row) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({
      ok: true,
      case: {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        title: row.title,
        description: row.description,
        category: row.category,
        isArchived: row.isArchived,
        _count: row._count,
        sessions: row.sessions.map(sessionTimelineJson),
      },
    });
  } catch (err) {
    console.error("[previsit/cases] get", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.put("/:caseId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const { caseId } = req.params;
  const body = req.body || {};

  try {
    const existing = await prisma.preVisitCase.findFirst({
      where: { id: caseId, userId },
    });
    if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

    const data = {};
    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      const ti = normalizeTitle(body.title, true);
      if (!ti.ok) return res.status(400).json({ ok: false, error: ti.error });
      data.title = ti.value;
    }
    if (Object.prototype.hasOwnProperty.call(body, "description")) {
      const d = normalizeOpt(body.description, DESC_MAX);
      if (!d.ok) return res.status(400).json({ ok: false, error: d.error });
      data.description = d.value === undefined ? existing.description : d.value;
    }
    if (Object.prototype.hasOwnProperty.call(body, "category")) {
      const c = normalizeOpt(body.category, CAT_MAX);
      if (!c.ok) return res.status(400).json({ ok: false, error: c.error });
      data.category = c.value === undefined ? existing.category : c.value;
    }
    if (Object.prototype.hasOwnProperty.call(body, "isArchived")) {
      data.isArchived = Boolean(body.isArchived);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: "no_fields_to_update" });
    }

    const updated = await prisma.preVisitCase.update({
      where: { id: caseId },
      data,
    });
    return res.json({
      ok: true,
      case: {
        id: updated.id,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        title: updated.title,
        description: updated.description,
        category: updated.category,
        isArchived: updated.isArchived,
      },
    });
  } catch (err) {
    console.error("[previsit/cases] put", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.delete("/:caseId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const { caseId } = req.params;

  try {
    const existing = await prisma.preVisitCase.findFirst({
      where: { id: caseId, userId },
    });
    if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

    await prisma.preVisitSession.updateMany({
      where: { preVisitCaseId: caseId, userId },
      data: { preVisitCaseId: null },
    });
    await prisma.preVisitCase.delete({ where: { id: caseId } });
    return res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error("[previsit/cases] delete", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
