import { prisma } from "../../lib/prisma.js";
import { EXPORT_FORMATS, EXPORT_TTL_MS } from "./exportConstants.js";
import { collectExportDataset } from "./exportCollectors.js";
import { buildExportCsv, buildExportPdf } from "./exportBuilders.js";
import { exportStorage } from "./exportStorage.js";
import { isValidExportType, canPracticeExportType } from "./exportPermissions.js";
import { writeAuditLog } from "../auditLogService.js";
import {
  computeJobNextRetryAt,
  DEFAULT_MAX_JOB_ATTEMPTS,
  EXPORT_POLL_STATUSES,
  isTransientJobError,
  JOB_STATUS,
} from "../backgroundJobs/jobConstants.js";


/**
 * @param {import('@prisma/client').ExportJob} row
 */
export function exportJobToJson(row) {
  const now = Date.now();
  const expired =
    row.status === JOB_STATUS.EXPIRED ||
    (row.expiresAt && new Date(row.expiresAt).getTime() < now && row.status === JOB_STATUS.COMPLETED);

  const inFlight = [JOB_STATUS.PENDING, JOB_STATUS.PROCESSING].includes(row.status);

  return {
    id: row.id,
    type: row.type,
    format: row.format,
    status: expired ? JOB_STATUS.EXPIRED : row.status,
    actorRole: row.actorRole,
    practiceProfileId: row.practiceProfileId,
    patientUserId: row.patientUserId,
    practicePatientLinkId: row.practicePatientLinkId,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    expiresAt: row.expiresAt,
    failedAt: row.failedAt,
    errorCode: row.errorCode,
    downloadReady:
      row.status === JOB_STATUS.COMPLETED && !expired && Boolean(row.storageKey),
    processing: inFlight,
  };
}

async function validateExportInput(input) {
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
    if (input.practicePatientLinkId && input.practiceProfileId) {
      const link = await prisma.practicePatientLink.findFirst({
        where: {
          id: input.practicePatientLinkId,
          practiceProfileId: input.practiceProfileId,
        },
      });
      if (!link) throw new Error("link_not_found");
      const { assertConsentForLink } = await import("../consent/consentRecordService.js");
      await assertConsentForLink(link, "data_export", {
        req: input.req,
        actorUserId: input.requestedByUserId,
        actorRole: input.practiceRole || "practice",
      });
    }
  }

  return { type, format };
}

/**
 * Create export job (pending) — processing via worker.
 */
export async function createExportJob(input) {
  const { type, format } = await validateExportInput(input);
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
      status: JOB_STATUS.PENDING,
      expiresAt,
      locale: input.locale ? String(input.locale).slice(0, 8) : null,
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

  return exportJobToJson(job);
}

/** @deprecated Use createExportJob — kept for compatibility. */
export async function createAndRunExportJob(input) {
  return createExportJob(input);
}

/**
 * Process one export job (must be in processing state).
 * @param {string} exportJobId
 */
export async function processExportJob(exportJobId) {
  const job = await prisma.exportJob.findUnique({ where: { id: exportJobId } });
  if (!job) return { ok: false, reason: "not_found" };
  if (job.status === JOB_STATUS.COMPLETED) return { ok: true, alreadyCompleted: true };
  if (job.status !== JOB_STATUS.PROCESSING) {
    return { ok: false, reason: "not_processing" };
  }

  await writeAuditLog({
    actorRole: "system",
    action: "export_job.started",
    entityType: "export_job",
    entityId: job.id,
    practiceProfileId: job.practiceProfileId,
    patientUserId: job.patientUserId,
    practicePatientLinkId: job.practicePatientLinkId,
    metadata: { type: job.type, format: job.format, attempt: job.attemptCount + 1 },
  });

  try {
    const dataset = await collectExportDataset({
      actorRole: job.actorRole,
      type: job.type,
      locale: job.locale,
      patientUserId: job.patientUserId,
      practiceProfileId: job.practiceProfileId,
      practicePatientLinkId: job.practicePatientLinkId,
    });

    const buffer =
      job.format === "csv"
        ? buildExportCsv(dataset)
        : Buffer.from(await buildExportPdf({ ...dataset, locale: job.locale }));

    const storageKey = await exportStorage.putExportFile({
      exportJobId: job.id,
      buffer,
      extension: job.format === "csv" ? "csv" : "pdf",
    });

    const updated = await prisma.exportJob.updateMany({
      where: { id: job.id, status: JOB_STATUS.PROCESSING },
      data: {
        status: JOB_STATUS.COMPLETED,
        storageKey,
        completedAt: new Date(),
        processingAt: null,
        nextRetryAt: null,
        errorCode: null,
      },
    });

    if (updated.count === 1) {
      await writeAuditLog({
        actorRole: "system",
        action: "export_job.completed",
        entityType: "export_job",
        entityId: job.id,
        practiceProfileId: job.practiceProfileId,
        patientUserId: job.patientUserId,
        practicePatientLinkId: job.practicePatientLinkId,
        metadata: { type: job.type, format: job.format },
      });
    }

    return { ok: true, completed: updated.count === 1 };
  } catch (err) {
    const errorCode = String(err?.message || "export_failed").slice(0, 80);
    const attemptCount = job.attemptCount + 1;
    const transient = isTransientJobError(errorCode);

    if (!transient || attemptCount >= DEFAULT_MAX_JOB_ATTEMPTS) {
      await prisma.exportJob.updateMany({
        where: { id: job.id, status: JOB_STATUS.PROCESSING },
        data: {
          status: JOB_STATUS.FAILED,
          attemptCount,
          failedAt: new Date(),
          errorCode,
          processingAt: null,
          nextRetryAt: null,
        },
      });
      await writeAuditLog({
        actorRole: "system",
        action: "export_job.failed",
        entityType: "export_job",
        entityId: job.id,
        practiceProfileId: job.practiceProfileId,
        metadata: { type: job.type, format: job.format, errorCode },
      });
      return { ok: false, failed: true, errorCode };
    }

    const nextRetryAt = computeJobNextRetryAt(attemptCount);
    await prisma.exportJob.updateMany({
      where: { id: job.id, status: JOB_STATUS.PROCESSING },
      data: {
        status: JOB_STATUS.PENDING,
        attemptCount,
        errorCode,
        processingAt: null,
        nextRetryAt,
      },
    });
    return { ok: false, retrying: true, nextRetryAt };
  }
}

/**
 * Mark expired exports and optionally remove storage files.
 */
export async function cleanupExpiredExports() {
  const now = new Date();
  const rows = await prisma.exportJob.findMany({
    where: {
      status: JOB_STATUS.COMPLETED,
      expiresAt: { lt: now },
    },
    select: { id: true, storageKey: true, type: true, format: true },
    take: 100,
  });

  let expired = 0;
  for (const row of rows) {
    const updated = await prisma.exportJob.updateMany({
      where: { id: row.id, status: JOB_STATUS.COMPLETED },
      data: { status: JOB_STATUS.EXPIRED },
    });
    if (updated.count === 1) {
      expired += 1;
      await writeAuditLog({
        actorRole: "system",
        action: "export_job.expired",
        entityType: "export_job",
        entityId: row.id,
        metadata: { type: row.type, format: row.format },
      }).catch(() => {});
    }
  }

  return { expired };
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

  if (row.status !== JOB_STATUS.COMPLETED || !row.storageKey) {
    throw new Error("export_not_ready");
  }

  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    await prisma.exportJob.update({
      where: { id: row.id },
      data: { status: JOB_STATUS.EXPIRED },
    });
    await writeAuditLog({
      userId: access.userId,
      actorRole: access.actorRole,
      action: "export_job.expired",
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
