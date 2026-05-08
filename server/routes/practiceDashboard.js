import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

const PRACTICE_STATUSES = new Set([
  "new",
  "opened",
  "in_review",
  "completed",
  "archived",
]);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

async function resolvePracticeAccess(userId, practiceId) {
  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceId },
  });
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

function canUpdateStatus(role) {
  return ["owner", "admin", "doctor", "assistant"].includes(role);
}

function canArchiveOrDelete(role) {
  return ["owner", "admin"].includes(role);
}

function dashboardItemJson(row) {
  const answers =
    row.answers && typeof row.answers === "object" && !Array.isArray(row.answers)
      ? row.answers
      : {};
  const patientIdentity =
    answers.patientIdentity &&
    typeof answers.patientIdentity === "object" &&
    !Array.isArray(answers.patientIdentity)
      ? answers.patientIdentity
      : {};
  const practiceContext =
    answers.practiceContext &&
    typeof answers.practiceContext === "object" &&
    !Array.isArray(answers.practiceContext)
      ? answers.practiceContext
      : {};
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    practiceStatus: row.practiceStatus || "new",
    patientLanguage: row.patientLanguage,
    doctorLanguage: row.doctorLanguage,
    title: row.title,
    patientName: String(patientIdentity.patientName || "").trim() || null,
    patientEmail: String(patientIdentity.patientEmail || "").trim() || null,
    targetName: row.practiceQrTarget?.targetName || String(practiceContext.targetName || "").trim() || null,
    targetDoctorName:
      row.practiceQrTarget?.doctorName || String(practiceContext.doctorName || "").trim() || null,
    targetType: row.practiceQrTarget?.targetType || String(practiceContext.targetType || "").trim() || null,
    preVisitCaseId: row.preVisitCaseId || null,
    preVisitCaseTitle: row.preVisitCase?.title || null,
    appointmentReason:
      String(answers.appointmentReason || "").trim() ||
      String(answers.symptomsOwnWords || "").trim().slice(0, 180) ||
      "",
    pdfDownloaded: Boolean(row.pdfDownloaded),
    openedAt: row.openedAt,
    archivedAt: row.archivedAt,
    completedAt: row.completedAt,
    lastStatusChangeAt: row.lastStatusChangeAt,
    appointmentAt: row.appointmentAt || null,
    appointmentReference: row.appointmentReference || null,
  };
}

function preparationDetailJson(row) {
  const base = dashboardItemJson(row);
  const answers =
    row.answers && typeof row.answers === "object" && !Array.isArray(row.answers)
      ? row.answers
      : {};
  const caseTimeline =
    answers.caseTimeline &&
    typeof answers.caseTimeline === "object" &&
    !Array.isArray(answers.caseTimeline)
      ? answers.caseTimeline
      : null;
  return {
    ...base,
    answers,
    aiDoctorVersion: row.aiDoctorVersion ?? null,
    aiSafetyNotice: row.aiSafetyNotice ?? null,
    caseTimeline,
  };
}

router.get("/inbox", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  const access = await resolvePracticeAccess(userId, practiceId);
  if (!access || !canRead(access.role)) return res.status(403).json({ ok: false, error: "forbidden" });

  const status = String(req.query.status || "").trim();
  const targetId = String(req.query.targetId || "").trim();
  const language = String(req.query.language || "").trim();
  const doctor = String(req.query.doctor || "").trim();
  const q = String(req.query.q || "").trim();

  if (status && !PRACTICE_STATUSES.has(status)) {
    return res.status(400).json({ ok: false, error: "practiceStatus_invalid" });
  }

  const where = {
    practiceProfileId: access.practice.id,
    ...(status ? { practiceStatus: status } : {}),
    ...(targetId ? { practiceQrTargetId: targetId } : {}),
    ...(language
      ? {
          OR: [{ patientLanguage: language }, { doctorLanguage: language }],
        }
      : {}),
  };

  if (doctor) {
    where.OR = [...(where.OR || []), { practiceQrTarget: { doctorName: { contains: doctor, mode: "insensitive" } } }];
  }
  if (q) {
    where.OR = [
      ...(where.OR || []),
      { preVisitCase: { title: { contains: q, mode: "insensitive" } } },
      { title: { contains: q, mode: "insensitive" } },
      { answers: { path: ["patientIdentity", "patientName"], string_contains: q } },
    ];
  }

  const rows = await prisma.preVisitSession.findMany({
    where,
    include: {
      preVisitCase: { select: { id: true, title: true } },
      practiceQrTarget: { select: { id: true, targetName: true, doctorName: true, targetType: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 250,
  });

  return res.json({
    ok: true,
    role: access.role,
    practice: {
      id: access.practice.id,
      practiceName: access.practice.practiceName,
    },
    items: rows.map(dashboardItemJson),
  });
});

router.get("/preparations/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  const access = await resolvePracticeAccess(userId, practiceId);
  if (!access || !canRead(access.role)) return res.status(403).json({ ok: false, error: "forbidden" });

  const row = await prisma.preVisitSession.findFirst({
    where: { id: req.params.id, practiceProfileId: access.practice.id },
    include: {
      preVisitCase: { select: { id: true, title: true } },
      practiceQrTarget: { select: { id: true, targetName: true, doctorName: true, targetType: true } },
    },
  });
  if (!row) return res.status(404).json({ ok: false, error: "not_found" });

  const data = {};
  if (row.practiceStatus === "new") {
    data.practiceStatus = "opened";
    data.openedAt = row.openedAt || new Date();
    data.lastStatusChangeAt = new Date();
  }
  if (Object.keys(data).length > 0) {
    await prisma.preVisitSession.update({ where: { id: row.id }, data });
    row.practiceStatus = data.practiceStatus || row.practiceStatus;
    row.openedAt = data.openedAt || row.openedAt;
    row.lastStatusChangeAt = data.lastStatusChangeAt || row.lastStatusChangeAt;
  }

  return res.json({ ok: true, role: access.role, preparation: preparationDetailJson(row) });
});

router.put("/preparations/:id/appointment", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.body?.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  const access = await resolvePracticeAccess(userId, practiceId);
  if (!access || !canUpdateStatus(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const existing = await prisma.preVisitSession.findFirst({
    where: { id: req.params.id, practiceProfileId: access.practice.id },
  });
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  const data = {};
  if (Object.prototype.hasOwnProperty.call(req.body || {}, "appointmentAt")) {
    const raw = req.body.appointmentAt;
    if (raw === null || raw === "") {
      data.appointmentAt = null;
    } else {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ ok: false, error: "appointmentAt_invalid" });
      }
      data.appointmentAt = d;
    }
  }
  if (Object.prototype.hasOwnProperty.call(req.body || {}, "appointmentReference")) {
    const ref = req.body.appointmentReference;
    data.appointmentReference =
      ref === null || ref === ""
        ? null
        : String(ref).trim().slice(0, 500) || null;
  }

  if (Object.keys(data).length === 0) {
    const row = await prisma.preVisitSession.findFirst({
      where: { id: existing.id },
      include: {
        preVisitCase: { select: { id: true, title: true } },
        practiceQrTarget: { select: { id: true, targetName: true, doctorName: true, targetType: true } },
      },
    });
    return res.json({ ok: true, preparation: preparationDetailJson(row) });
  }

  const updated = await prisma.preVisitSession.update({
    where: { id: existing.id },
    data,
    include: {
      preVisitCase: { select: { id: true, title: true } },
      practiceQrTarget: { select: { id: true, targetName: true, doctorName: true, targetType: true } },
    },
  });
  return res.json({ ok: true, preparation: preparationDetailJson(updated) });
});

router.put("/preparations/:id/status", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.body?.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  const access = await resolvePracticeAccess(userId, practiceId);
  if (!access || !canUpdateStatus(access.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  const nextStatus = String(req.body?.practiceStatus || "").trim();
  if (!PRACTICE_STATUSES.has(nextStatus)) {
    return res.status(400).json({ ok: false, error: "practiceStatus_invalid" });
  }
  if ((nextStatus === "archived" || nextStatus === "completed") && !canArchiveOrDelete(access.role) && nextStatus === "archived") {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const existing = await prisma.preVisitSession.findFirst({
    where: { id: req.params.id, practiceProfileId: access.practice.id },
  });
  if (!existing) return res.status(404).json({ ok: false, error: "not_found" });

  const now = new Date();
  const data = {
    practiceStatus: nextStatus,
    lastStatusChangeAt: now,
  };
  if (nextStatus === "opened" && !existing.openedAt) data.openedAt = now;
  if (nextStatus === "completed") data.completedAt = now;
  if (nextStatus === "archived") data.archivedAt = now;
  if (nextStatus !== "archived") data.archivedAt = null;

  const updated = await prisma.preVisitSession.update({
    where: { id: existing.id },
    data,
    include: {
      preVisitCase: { select: { id: true, title: true } },
      practiceQrTarget: { select: { id: true, targetName: true, doctorName: true, targetType: true } },
    },
  });
  return res.json({ ok: true, preparation: preparationDetailJson(updated) });
});

router.delete("/preparations/:id", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  const access = await resolvePracticeAccess(userId, practiceId);
  if (!access || !canArchiveOrDelete(access.role)) return res.status(403).json({ ok: false, error: "forbidden" });

  const mode = String(req.body?.mode || req.query.mode || "archive").trim();
  const row = await prisma.preVisitSession.findFirst({
    where: { id: req.params.id, practiceProfileId: access.practice.id },
  });
  if (!row) return res.status(404).json({ ok: false, error: "not_found" });

  if (mode === "delete") {
    await prisma.preVisitSession.delete({ where: { id: row.id } });
    return res.json({ ok: true, deleted: true });
  }

  const now = new Date();
  const updated = await prisma.preVisitSession.update({
    where: { id: row.id },
    data: {
      practiceStatus: "archived",
      archivedAt: now,
      lastStatusChangeAt: now,
    },
  });
  return res.json({ ok: true, archived: true, id: updated.id });
});

export default router;
