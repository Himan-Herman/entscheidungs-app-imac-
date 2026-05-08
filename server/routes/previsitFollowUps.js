import express from "express";
import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../services/auditLogService.js";
import { trackAnalyticsEvent } from "../services/analyticsService.js";

const prisma = new PrismaClient();
const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function threadJson(row) {
  return {
    id: row.id,
    preVisitSessionId: row.preVisitSessionId,
    practiceProfileId: row.practiceProfileId,
    qrTargetId: row.qrTargetId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    status: row.status,
    title: row.title,
    isArchived: row.isArchived,
    session: row.session
      ? {
          id: row.session.id,
          createdAt: row.session.createdAt,
          title: row.session.title,
          patientLanguage: row.session.patientLanguage,
          doctorLanguage: row.session.doctorLanguage,
        }
      : null,
    practice: row.practiceProfile
      ? {
          id: row.practiceProfile.id,
          practiceName: row.practiceProfile.practiceName,
        }
      : null,
    target: row.qrTarget
      ? {
          id: row.qrTarget.id,
          targetName: row.qrTarget.targetName,
          doctorName: row.qrTarget.doctorName,
        }
      : null,
    messages: Array.isArray(row.messages)
      ? row.messages.map((m) => ({
          id: m.id,
          senderType: m.senderType,
          senderUserId: m.senderUserId,
          body: m.body,
          createdAt: m.createdAt,
          readAt: m.readAt,
        }))
      : [],
  };
}

router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const rows = await prisma.preVisitFollowUpThread.findMany({
    where: { patientUserId: userId },
    include: {
      session: { select: { id: true, createdAt: true, title: true, patientLanguage: true, doctorLanguage: true } },
      practiceProfile: { select: { id: true, practiceName: true } },
      qrTarget: { select: { id: true, targetName: true, doctorName: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 3 },
    },
    orderBy: { updatedAt: "desc" },
    take: 250,
  });
  return res.json({ ok: true, threads: rows.map(threadJson) });
});

router.get("/:threadId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const row = await prisma.preVisitFollowUpThread.findFirst({
    where: { id: req.params.threadId, patientUserId: userId },
    include: {
      session: { select: { id: true, createdAt: true, title: true, patientLanguage: true, doctorLanguage: true } },
      practiceProfile: { select: { id: true, practiceName: true } },
      qrTarget: { select: { id: true, targetName: true, doctorName: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return res.status(404).json({ ok: false, error: "not_found" });
  return res.json({ ok: true, thread: threadJson(row) });
});

router.post("/:threadId/messages", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const body = String(req.body?.body || "").trim().slice(0, 5000);
  if (!body) return res.status(400).json({ ok: false, error: "body_required" });
  const thread = await prisma.preVisitFollowUpThread.findFirst({
    where: { id: req.params.threadId, patientUserId: userId },
  });
  if (!thread) return res.status(404).json({ ok: false, error: "not_found" });
  const message = await prisma.preVisitFollowUpMessage.create({
    data: {
      threadId: thread.id,
      senderType: "patient",
      senderUserId: userId,
      body,
    },
  });
  await prisma.preVisitFollowUpThread.update({
    where: { id: thread.id },
    data: { status: "answered" },
  });
  writeAuditLog({
    req,
    userId,
    action: "followup_message_created",
    entityType: "PreVisitFollowUpMessage",
    entityId: message.id,
    metadata: { threadId: thread.id, senderType: "patient" },
  });
  void trackAnalyticsEvent({
    eventType: "followup_answered",
    userId,
    practiceId: thread.practiceProfileId || undefined,
    sessionId: thread.preVisitSessionId,
    metadata: {},
  });
  return res.status(201).json({ ok: true, message });
});

export default router;
