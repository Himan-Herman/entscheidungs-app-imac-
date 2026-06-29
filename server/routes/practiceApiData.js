/**
 * Read-only practice integration API — metadata-focused; no intake answers or clinical text.
 */

import express from "express";
import { prisma } from "../lib/prisma.js";
import {
  canAccessPracticeDataApi,
  getPracticeAccess,
} from "../utils/practiceAccess.js";

const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function sessionApiJson(row) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    practiceStatus: row.practiceStatus,
    patientLanguage: row.patientLanguage,
    doctorLanguage: row.doctorLanguage,
    title: row.title,
    preVisitCaseId: row.preVisitCaseId,
    practiceQrTargetId: row.practiceQrTargetId,
    appointmentAt: row.appointmentAt,
    appointmentReference: row.appointmentReference,
    pdfDownloaded: row.pdfDownloaded,
    openedAt: row.openedAt,
    archivedAt: row.archivedAt,
    completedAt: row.completedAt,
    lastStatusChangeAt: row.lastStatusChangeAt,
  };
}

router.get("/previsit-sessions", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = String(req.query.practiceProfileId || "").trim();
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceProfileId_required" });
  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canAccessPracticeDataApi(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const rows = await prisma.preVisitSession.findMany({
    where: { practiceProfileId: access.practice.id },
    orderBy: { createdAt: "desc" },
    take: 250,
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      practiceStatus: true,
      patientLanguage: true,
      doctorLanguage: true,
      title: true,
      preVisitCaseId: true,
      practiceQrTargetId: true,
      appointmentAt: true,
      appointmentReference: true,
      pdfDownloaded: true,
      openedAt: true,
      archivedAt: true,
      completedAt: true,
      lastStatusChangeAt: true,
    },
  });
  return res.json({
    ok: true,
    role: access.role,
    items: rows.map(sessionApiJson),
  });
});

router.get("/previsit-sessions/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = String(req.query.practiceProfileId || "").trim();
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceProfileId_required" });
  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canAccessPracticeDataApi(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const row = await prisma.preVisitSession.findFirst({
    where: { id: req.params.id, practiceProfileId: access.practice.id },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      practiceStatus: true,
      patientLanguage: true,
      doctorLanguage: true,
      title: true,
      preVisitCaseId: true,
      practiceQrTargetId: true,
      appointmentAt: true,
      appointmentReference: true,
      pdfDownloaded: true,
      openedAt: true,
      archivedAt: true,
      completedAt: true,
      lastStatusChangeAt: true,
      preVisitCase: { select: { id: true, title: true } },
    },
  });
  if (!row) return res.status(404).json({ ok: false, error: "not_found" });

  const base = sessionApiJson(row);
  return res.json({
    ok: true,
    role: access.role,
    item: {
      ...base,
      preVisitCase: row.preVisitCase,
    },
  });
});

router.get("/follow-ups", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = String(req.query.practiceProfileId || "").trim();
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceProfileId_required" });
  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canAccessPracticeDataApi(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const rows = await prisma.preVisitFollowUpThread.findMany({
    where: { practiceProfileId: access.practice.id },
    orderBy: { updatedAt: "desc" },
    take: 250,
    select: {
      id: true,
      preVisitSessionId: true,
      status: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      isArchived: true,
      _count: { select: { messages: true } },
    },
  });
  return res.json({
    ok: true,
    role: access.role,
    items: rows.map((r) => ({
      id: r.id,
      preVisitSessionId: r.preVisitSessionId,
      status: r.status,
      title: r.title,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      isArchived: r.isArchived,
      messageCount: r._count.messages,
    })),
  });
});

router.get("/cases", async (req, res) => {
  const userId = userIdFromReq(req);
  const practiceId = String(req.query.practiceProfileId || "").trim();
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceProfileId_required" });
  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canAccessPracticeDataApi(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const rows = await prisma.preVisitCase.findMany({
    where: {
      sessions: { some: { practiceProfileId: access.practice.id } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      title: true,
      category: true,
      isArchived: true,
    },
  });
  return res.json({ ok: true, role: access.role, items: rows });
});

export default router;
