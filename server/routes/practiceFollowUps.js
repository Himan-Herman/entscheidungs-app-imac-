import express from "express";
import { prisma } from "../lib/prisma.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { trackAnalyticsEvent } from "../services/analyticsService.js";
import {
  cancelFollowUpReminders,
  scheduleFollowUpPatientNudge,
} from "../services/reminders/appointmentReminderSchedule.js";

const router = express.Router();

const THREAD_STATUS = new Set([
  "open",
  "waiting_for_patient",
  "answered",
  "closed",
  "archived",
]);
const SENDER = new Set(["practice", "patient", "system"]);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

async function resolvePracticeAccess(userId, practiceId) {
  const practice = await prisma.practiceProfile.findUnique({ where: { id: practiceId } });
  if (!practice) return null;
  if (practice.userId === userId) return { practice, role: "owner" };
  const member = await prisma.practiceMember.findUnique({
    where: { practiceProfileId_userId: { practiceProfileId: practiceId, userId } },
  });
  if (!member) return null;
  return { practice, role: member.role };
}

function canRead(role) {
  return ["owner", "admin", "doctor", "assistant", "viewer"].includes(role);
}
function canWrite(role) {
  return ["owner", "admin", "doctor", "assistant"].includes(role);
}

function threadJson(row) {
  return {
    id: row.id,
    preVisitSessionId: row.preVisitSessionId,
    practiceProfileId: row.practiceProfileId,
    qrTargetId: row.qrTargetId,
    patientUserId: row.patientUserId,
    createdByUserId: row.createdByUserId,
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
  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  const access = await resolvePracticeAccess(userId, practiceId);
  if (!access || !canRead(access.role)) return res.status(403).json({ ok: false, error: "forbidden" });

  const rows = await prisma.preVisitFollowUpThread.findMany({
    where: { practiceProfileId: access.practice.id },
    include: {
      session: { select: { id: true, createdAt: true, title: true, patientLanguage: true, doctorLanguage: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 3 },
    },
    orderBy: { updatedAt: "desc" },
    take: 250,
  });
  return res.json({ ok: true, role: access.role, threads: rows.map(threadJson) });
});

router.post("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.body?.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  const access = await resolvePracticeAccess(userId, practiceId);
  if (!access || !canWrite(access.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  const preVisitSessionId = String(req.body?.preVisitSessionId || "").trim();
  if (!preVisitSessionId) return res.status(400).json({ ok: false, error: "preVisitSessionId_required" });
  const title = String(req.body?.title || "").trim().slice(0, 180) || null;
  const firstMessage = String(req.body?.message || "").trim().slice(0, 5000);
  if (!firstMessage) return res.status(400).json({ ok: false, error: "message_required" });

  const session = await prisma.preVisitSession.findFirst({
    where: { id: preVisitSessionId, practiceProfileId: access.practice.id },
  });
  if (!session) return res.status(404).json({ ok: false, error: "session_not_found" });

  const created = await prisma.preVisitFollowUpThread.create({
    data: {
      preVisitSessionId: session.id,
      practiceProfileId: access.practice.id,
      qrTargetId: session.practiceQrTargetId,
      patientUserId: session.userId,
      createdByUserId: userId,
      status: "waiting_for_patient",
      title,
      messages: {
        create: {
          senderType: "practice",
          senderUserId: userId,
          body: firstMessage,
        },
      },
    },
    include: {
      session: { select: { id: true, createdAt: true, title: true, patientLanguage: true, doctorLanguage: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  void trackAnalyticsEvent({
    eventType: "followup_created",
    userId: session.userId,
    practiceId: access.practice.id,
    sessionId: session.id,
    metadata: { followupCount: 1 },
  });
  if (session.preVisitCaseId) {
    void trackAnalyticsEvent({
      eventType: "case_followup_created",
      userId: session.userId,
      practiceId: access.practice.id,
      sessionId: session.id,
      metadata: { hasCaseContext: true },
    });
  }
  void scheduleFollowUpPatientNudge(created.id).catch(() => {});
  return res.status(201).json({ ok: true, thread: threadJson(created) });
});

router.get("/:threadId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  const access = await resolvePracticeAccess(userId, practiceId);
  if (!access || !canRead(access.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  const row = await prisma.preVisitFollowUpThread.findFirst({
    where: { id: req.params.threadId, practiceProfileId: access.practice.id },
    include: {
      session: { select: { id: true, createdAt: true, title: true, patientLanguage: true, doctorLanguage: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return res.status(404).json({ ok: false, error: "not_found" });
  return res.json({ ok: true, role: access.role, thread: threadJson(row) });
});

router.post("/:threadId/messages", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.body?.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  const access = await resolvePracticeAccess(userId, practiceId);
  if (!access || !canWrite(access.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  const body = String(req.body?.body || "").trim().slice(0, 5000);
  if (!body) return res.status(400).json({ ok: false, error: "body_required" });

  const thread = await prisma.preVisitFollowUpThread.findFirst({
    where: { id: req.params.threadId, practiceProfileId: access.practice.id },
  });
  if (!thread) return res.status(404).json({ ok: false, error: "not_found" });

  const message = await prisma.preVisitFollowUpMessage.create({
    data: { threadId: thread.id, senderType: "practice", senderUserId: userId, body },
  });
  await prisma.preVisitFollowUpThread.update({
    where: { id: thread.id },
    data: { status: "waiting_for_patient" },
  });
  writeAuditLog({
    req,
    userId,
    actorRole: access.role,
    action: "followup_message_created",
    entityType: "PreVisitFollowUpMessage",
    entityId: message.id,
    metadata: { threadId: thread.id, senderType: "practice" },
  });
  void scheduleFollowUpPatientNudge(thread.id).catch(() => {});
  return res.status(201).json({ ok: true, message });
});

router.put("/:threadId/status", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.body?.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  const access = await resolvePracticeAccess(userId, practiceId);
  if (!access || !canWrite(access.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  const status = String(req.body?.status || "").trim();
  if (!THREAD_STATUS.has(status)) return res.status(400).json({ ok: false, error: "status_invalid" });

  const updated = await prisma.preVisitFollowUpThread.updateMany({
    where: { id: req.params.threadId, practiceProfileId: access.practice.id },
    data: status === "archived" ? { status, isArchived: true } : { status },
  });
  if (updated.count === 0) return res.status(404).json({ ok: false, error: "not_found" });
  if (status === "closed" || status === "archived") {
    void cancelFollowUpReminders(req.params.threadId, `thread_${status}`).catch(() => {});
  }
  return res.json({ ok: true, updated: true });
});

router.delete("/:threadId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.body?.practiceId || req.query?.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  const access = await resolvePracticeAccess(userId, practiceId);
  if (!access || !canWrite(access.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  const mode = String(req.body?.mode || req.query?.mode || "archive").trim();

  const thread = await prisma.preVisitFollowUpThread.findFirst({
    where: { id: req.params.threadId, practiceProfileId: access.practice.id },
  });
  if (!thread) return res.status(404).json({ ok: false, error: "not_found" });
  if (mode === "delete") {
    await prisma.preVisitFollowUpThread.delete({ where: { id: thread.id } });
    void cancelFollowUpReminders(thread.id, "thread_deleted").catch(() => {});
    return res.json({ ok: true, deleted: true });
  }
  await prisma.preVisitFollowUpThread.update({
    where: { id: thread.id },
    data: { status: "archived", isArchived: true },
  });
  void cancelFollowUpReminders(thread.id, "thread_archived").catch(() => {});
  return res.json({ ok: true, archived: true });
});

export default router;
