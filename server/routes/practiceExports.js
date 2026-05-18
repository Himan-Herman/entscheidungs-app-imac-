import express from "express";
import { PrismaClient } from "@prisma/client";
import { getPracticeAccess } from "../utils/practiceAccess.js";
import { canReadPracticePatientLinks } from "../utils/practicePermissions.js";
import {
  createAndRunExportJob,
  getExportJobForDownload,
  listExportJobs,
} from "../services/export/exportJobService.js";
import { generateExportAiOrganize } from "../services/export/exportAiOrganizeService.js";
import { writeAuditLog } from "../services/auditLogService.js";

const prisma = new PrismaClient();
const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const jobs = await listExportJobs({
    actorRole: "practice",
    userId,
    practiceProfileId: practiceId,
  });
  return res.json({ ok: true, exports: jobs, role: access.role });
});

router.post("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const job = await createAndRunExportJob({
      requestedByUserId: userId,
      actorRole: "practice",
      practiceRole: access.role,
      type: req.body?.type,
      format: req.body?.format || "pdf",
      locale: req.body?.locale,
      practiceProfileId: practiceId,
      practicePatientLinkId: req.body?.practicePatientLinkId,
      patientUserId: req.body?.patientUserId,
      req,
    });
    return res.status(201).json({ ok: true, export: job, role: access.role });
  } catch (err) {
    const msg = err?.message || "export_failed";
    if (msg === "forbidden") return res.status(403).json({ ok: false, error: msg });
    if (msg === "linkId_required") return res.status(400).json({ ok: false, error: msg });
    if (msg === "validation_invalid_export_type" || msg === "validation_invalid_format") {
      return res.status(400).json({ ok: false, error: msg });
    }
    console.error("[practice/exports/create]", msg);
    return res.status(500).json({ ok: false, error: "export_failed" });
  }
});

router.post("/:exportId/ai-organize", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  const access = await getPracticeAccess(userId, practiceId);
  if (!access) return res.status(403).json({ ok: false, error: "forbidden" });

  const row = await prisma.exportJob.findUnique({ where: { id: req.params.exportId } });
  if (!row || row.practiceProfileId !== practiceId) {
    return res.status(404).json({ ok: false, error: "export_not_found" });
  }

  try {
    const result = await generateExportAiOrganize({
      locale: req.body?.locale,
      type: row.type,
      format: row.format,
    });

    await writeAuditLog({
      req,
      userId,
      actorRole: access.role,
      action: "export_ai_organize_created",
      entityType: "export_job",
      entityId: row.id,
      practiceProfileId: practiceId,
      practicePatientLinkId: row.practicePatientLinkId,
      metadata: { type: row.type, format: row.format },
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[practice/exports/ai-organize]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "ai_organize_failed" });
  }
});

router.get("/:exportId/download", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) return res.status(400).json({ ok: false, error: "practiceId_required" });

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const { buffer, mime, filename, job } = await getExportJobForDownload(req.params.exportId, {
      userId,
      actorRole: "practice",
      practiceProfileId: practiceId,
    });

    await writeAuditLog({
      req,
      userId,
      actorRole: access.role,
      action: "export_job_downloaded",
      entityType: "export_job",
      entityId: job.id,
      practiceProfileId: practiceId,
      practicePatientLinkId: job.practicePatientLinkId,
      patientUserId: job.patientUserId,
      metadata: { type: job.type, format: job.format },
    });

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(buffer);
  } catch (err) {
    const msg = err?.message || "download_failed";
    if (msg === "export_not_found") return res.status(404).json({ ok: false, error: msg });
    if (msg === "forbidden") return res.status(403).json({ ok: false, error: msg });
    if (msg === "export_expired" || msg === "export_not_ready") {
      return res.status(410).json({ ok: false, error: msg });
    }
    console.error("[practice/exports/download]", msg);
    return res.status(500).json({ ok: false, error: "download_failed" });
  }
});

export default router;
