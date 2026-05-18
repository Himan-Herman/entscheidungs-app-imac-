/**
 * Post-visit medication plans — practice write, patient read.
 */

import express from "express";
import { PrismaClient } from "@prisma/client";
import {
  getPracticeMedications,
  savePracticeMedications,
  notifyPatientAboutMedications,
  listPatientMedicationSessions,
  getPatientSessionMedications,
} from "../services/visitMedicationService.js";
import { writeAuditLog } from "../services/auditLogService.js";

const prisma = new PrismaClient();
const router = express.Router();

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

/** GET /api/practice-dashboard/preparations/:id/medications */
router.get("/preparations/:id/medications", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.query.practiceId || "").trim();
  const sessionId = String(req.params.id || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  const access = await resolvePracticeAccess(userId, practiceId);
  if (!access || !canRead(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  const entries = await getPracticeMedications(sessionId, practiceId);
  return res.json({ ok: true, entries });
});

/** PUT /api/practice-dashboard/preparations/:id/medications */
router.put("/preparations/:id/medications", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const practiceId = String(req.body?.practiceId || "").trim();
  const sessionId = String(req.params.id || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });
  const access = await resolvePracticeAccess(userId, practiceId);
  if (!access || !canWrite(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const publish = req.body?.publish !== false;
  const notifyPatient = req.body?.notifyPatient === true;

  try {
    const entries = await savePracticeMedications({
      sessionId,
      practiceId,
      userId,
      entries: req.body?.entries,
      publish,
    });

    let notificationThreadId = null;
    if (publish && notifyPatient && entries.length > 0) {
      const session = await prisma.preVisitSession.findFirst({
        where: { id: sessionId, practiceProfileId: practiceId },
      });
      if (session) {
        notificationThreadId = await notifyPatientAboutMedications({
          session,
          practiceId,
          userId,
          patientLanguage: session.patientLanguage === "de" ? "de" : "en",
        });
      }
    }

    await writeAuditLog({
      userId,
      actorRole: access.role,
      action: "visit_medications_saved",
      entityType: "PreVisitSession",
      entityId: sessionId,
      metadata: { entryCount: entries.length, publish, notifyPatient },
    });

    return res.json({
      ok: true,
      entries,
      notificationThreadId,
    });
  } catch (err) {
    const msg = err?.message || "save_failed";
    if (msg.startsWith("validation_")) {
      return res.status(400).json({ ok: false, error: msg });
    }
    if (msg === "session_not_found") {
      return res.status(404).json({ ok: false, error: msg });
    }
    console.error("[visit-medications/save]", err);
    return res.status(500).json({ ok: false, error: "save_failed" });
  }
});

export default router;

/** Patient router — mount at /api/previsit/visit-medications */
export const patientVisitMedicationsRouter = express.Router();

patientVisitMedicationsRouter.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const sessions = await listPatientMedicationSessions(userId);
  return res.json({ ok: true, sessions });
});

patientVisitMedicationsRouter.get("/session/:sessionId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });
  const sessionId = String(req.params.sessionId || "").trim();
  const markViewed = req.query.markViewed === "1" || req.query.markViewed === "true";
  try {
    const payload = await getPatientSessionMedications(userId, sessionId, {
      markViewed,
    });
    return res.json({ ok: true, ...payload });
  } catch (err) {
    if (err?.message === "session_not_found") {
      return res.status(404).json({ ok: false, error: "session_not_found" });
    }
    return res.status(500).json({ ok: false, error: "load_failed" });
  }
});
