import { PrismaClient } from "@prisma/client";
import { EXPORT_FORMATS, EXPORT_TTL_MS } from "./exportConstants.js";
import { collectExportDataset } from "./exportCollectors.js";
import { buildExportCsv, buildExportPdf } from "./exportBuilders.js";
import { exportStorage } from "./exportStorage.js";
import { isValidExportType, canPracticeExportType } from "./exportPermissions.js";
import { writeAuditLog } from "../auditLogService.js";

const prisma = new PrismaClient();

/**
 * @param {import('@prisma/client').ExportJob} row
 */
export function exportJobToJson(row) {
  const now = Date.now();
  const expired =
    row.status === "expired" ||
    (row.expiresAt && new Date(row.expiresAt).getTime() < now && row.status === "completed");

  return {
    id: row.id,
    type: row.type,
    format: row.format,
    status: expired ? "expired" : row.status,
    actorRole: row.actorRole,
    practiceProfileId: row.practiceProfileId,
    patientUserId: row.patientUserId,
    practicePatientLinkId: row.practicePatientLinkId,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    expiresAt: row.expiresAt,
    failedAt: row.failedAt,
    errorCode: row.errorCode,
    downloadReady: row.status === "completed" && !expired && Boolean(row.storageKey),
  };
}

/**
 * @param {{
 *   requestedByUserId: string,
 *   actorRole: 'patient' | 'practice',
 *   type: string,
 *   format: string,
 *   locale?: string,
 *   patientUserId?: string,
 *   practiceProfileId?: string,
 *   practicePatientLinkId?: string,
 *   practiceRole?: string,
 *   req?: import('express').Request,
 * }} input
 */
export async function createAndRunExportJob(input) {
  const type = String(input.type || "").trim();
  const format = String(input.format || "pdf").toLowerCase();

  if (!EXPORT_FORMATS.has(format)) throw new Error("validation_invalid_format");
  if (!isValidExportType(input.actorRole, type)) {
    throw new Error("validation_invalid_export_type");
  }

  if (input.actorRole === "practice") {
    if (!canPracticeExportType(input.practiceRole, type)) {
      throw new Error("forbidden");
    }
    const needsLink = ["patient_summary", "medication_plan", "documents_list", "activity"].includes(
      type,
    );
    if (needsLink && !input.practicePatientLinkId) {
      throw new Error("linkId_required");
    }
  }

  const expiresAt = new Date(Date.now() + EXPORT_TTL_MS);

  const job = await prisma.exportJob.create({
    data: {
      requestedByUserId: input.requestedByUserId,
      actorRole: input.actorRole,
      practiceProfileId: input.practiceProfileId || null,
      patientUserId: input.patientUserId || null,
      practicePatientLinkId: input.practicePatientLinkId || null,
      type,
      format,
      status: "pending",
      expiresAt,
    },
  });

  await writeAuditLog({
    req: input.req,
    userId: input.requestedByUserId,
    actorRole: input.actorRole === "patient" ? "patient" : input.practiceRole || "practice",
    action: "export_job_requested",
    entityType: "export_job",
    entityId: job.id,
    practiceProfileId: job.practiceProfileId,
    patientUserId: job.patientUserId,
    practicePatientLinkId: job.practicePatientLinkId,
    metadata: { type, format },
  });

  try {
    const dataset = await collectExportDataset({
      actorRole: input.actorRole,
      type,
      locale: input.locale,
      patientUserId: input.patientUserId,
      practiceProfileId: input.practiceProfileId,
      practicePatientLinkId: input.practicePatientLinkId,
    });

    const buffer =
      format === "csv"
        ? buildExportCsv(dataset)
        : Buffer.from(await buildExportPdf({ ...dataset, locale: input.locale }));

    const storageKey = await exportStorage.putExportFile({
      exportJobId: job.id,
      buffer,
      extension: format === "csv" ? "csv" : "pdf",
    });

    const completed = await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        storageKey,
        completedAt: new Date(),
      },
    });

    await writeAuditLog({
      req: input.req,
      userId: input.requestedByUserId,
      actorRole: input.actorRole === "patient" ? "patient" : input.practiceRole || "practice",
      action: "export_job_completed",
      entityType: "export_job",
      entityId: job.id,
      practiceProfileId: job.practiceProfileId,
      patientUserId: job.patientUserId,
      practicePatientLinkId: job.practicePatientLinkId,
      metadata: { type, format, rowCount: dataset.rows?.length || 0 },
    });

    return exportJobToJson(completed);
  } catch (err) {
    const failed = await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        failedAt: new Date(),
        errorCode: String(err?.message || "export_failed").slice(0, 80),
      },
    });

    await writeAuditLog({
      req: input.req,
      userId: input.requestedByUserId,
      actorRole: input.actorRole === "patient" ? "patient" : input.practiceRole || "practice",
      action: "export_job_failed",
      entityType: "export_job",
      entityId: job.id,
      practiceProfileId: job.practiceProfileId,
      patientUserId: job.patientUserId,
      practicePatientLinkId: job.practicePatientLinkId,
      metadata: { type, format, errorCode: failed.errorCode },
    });

    throw err;
  }
}

/**
 * @param {{ actorRole: 'patient' | 'practice', userId: string, patientUserId?: string, practiceProfileId?: string }} filters
 */
export async function listExportJobs(filters) {
  const where =
    filters.actorRole === "patient"
      ? { requestedByUserId: filters.userId, actorRole: "patient" }
      : {
          practiceProfileId: filters.practiceProfileId,
          actorRole: "practice",
        };

  const rows = await prisma.exportJob.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return rows.map(exportJobToJson);
}

/**
 * @param {string} exportId
 * @param {{ userId: string, actorRole: 'patient' | 'practice', practiceProfileId?: string }} access
 */
export async function getExportJobForDownload(exportId, access) {
  const row = await prisma.exportJob.findUnique({ where: { id: exportId } });
  if (!row) throw new Error("export_not_found");

  if (access.actorRole === "patient") {
    if (row.requestedByUserId !== access.userId || row.actorRole !== "patient") {
      throw new Error("forbidden");
    }
  } else if (row.practiceProfileId !== access.practiceProfileId) {
    throw new Error("forbidden");
  }

  if (row.status !== "completed" || !row.storageKey) {
    throw new Error("export_not_ready");
  }

  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    await prisma.exportJob.update({
      where: { id: row.id },
      data: { status: "expired" },
    });
    await writeAuditLog({
      userId: access.userId,
      actorRole: access.actorRole,
      action: "export_job_expired",
      entityType: "export_job",
      entityId: row.id,
      practiceProfileId: row.practiceProfileId,
      patientUserId: row.patientUserId,
      practicePatientLinkId: row.practicePatientLinkId,
      metadata: { type: row.type, format: row.format },
    });
    throw new Error("export_expired");
  }

  const buffer = await exportStorage.getExportFile(row.storageKey);
  const mime = row.format === "csv" ? "text/csv" : "application/pdf";
  const filename = `medscoutx-export-${row.type}-${row.id.slice(0, 8)}.${row.format}`;

  return { buffer, mime, filename, job: row };
}
