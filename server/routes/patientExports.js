import express from "express";
import {
  createExportJob,
  getExportJobForDownload,
  listExportJobs,
} from "../services/export/exportJobService.js";
import { generateExportAiOrganize } from "../services/export/exportAiOrganizeService.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { prisma } from "../lib/prisma.js";
import { patientExportLimiter } from "../middleware/ipRateLimit.js";

const router = express.Router();

router.use(patientExportLimiter);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const jobs = await listExportJobs({
    actorRole: "patient",
    userId,
    patientUserId: userId,
  });
  return res.json({ ok: true, exports: jobs });
});

router.post("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const job = await createExportJob({
      requestedByUserId: userId,
      actorRole: "patient",
      type: req.body?.type,
      format: req.body?.format || "pdf",
      locale: req.body?.locale,
      patientUserId: userId,
      req,
    });
    return res.status(201).json({ ok: true, export: job });
  } catch (err) {
    const msg = err?.message || "export_failed";
    if (msg === "validation_invalid_export_type" || msg === "validation_invalid_format") {
      return res.status(400).json({ ok: false, error: msg });
    }
    console.error("[patient/exports/create]", msg);
    return res.status(500).json({ ok: false, error: "export_failed" });
  }
});

router.post("/:exportId/ai-organize", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  const row = await prisma.exportJob.findUnique({ where: { id: req.params.exportId } });
  if (!row || row.requestedByUserId !== userId) {
    return res.status(404).json({ ok: false, error: "export_not_found" });
  }

  try {
    const result = await generateExportAiOrganize({
      locale: req.body?.locale,
      type: row.type,
      format: row.format,
      rowCount: 0,
    });

    await writeAuditLog({
      req,
      userId,
      actorRole: "patient",
      action: "export_ai_organize_created",
      entityType: "export_job",
      entityId: row.id,
      patientUserId: userId,
      metadata: { type: row.type, format: row.format },
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[patient/exports/ai-organize]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "ai_organize_failed" });
  }
});

router.get("/:exportId/download", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const { buffer, mime, filename, job } = await getExportJobForDownload(req.params.exportId, {
      userId,
      actorRole: "patient",
    });

    await writeAuditLog({
      req,
      userId,
      actorRole: "patient",
      action: "export_job_downloaded",
      entityType: "export_job",
      entityId: job.id,
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
    console.error("[patient/exports/download]", msg);
    return res.status(500).json({ ok: false, error: "download_failed" });
  }
});

export default router;
