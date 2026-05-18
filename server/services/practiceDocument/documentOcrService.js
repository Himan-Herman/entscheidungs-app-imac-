import { PrismaClient } from "@prisma/client";
import {
  isDocumentOcrUiEnabled,
  isLabInterpretationEnabled,
} from "../../config/featureFlags.js";
import {
  assertLinkForPractice,
  getDocumentFileForPractice,
  getDocumentForPractice,
} from "./practiceDocumentService.js";
import { getPracticeDocumentStorage } from "./storage/index.js";
import { getDocumentOcrEngine, resolveOcrEngine } from "./documentOcrEngineAdapter.js";
import {
  hasPracticePermission,
  PERMISSIONS,
} from "../../utils/practicePermissions.js";
import { getSharedDocumentForPatient } from "./practiceDocumentService.js";

const prisma = new PrismaClient();
const storage = getPracticeDocumentStorage();

const REVIEW_STATUSES = new Set([
  "detected",
  "needs_review",
  "reviewed",
  "shared",
  "discarded",
]);

function jobToJson(row) {
  return {
    id: row.id,
    documentId: row.documentId,
    fileId: row.fileId,
    status: row.status,
    engine: row.engine,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    failedAt: row.failedAt,
    errorCode: row.errorCode,
    createdAt: row.createdAt,
    reviewStatus: row.result?.reviewStatus ?? null,
  };
}

function entryToJson(row) {
  return {
    id: row.id,
    label: row.label,
    valueText: row.valueText,
    unit: row.unit,
    referenceRangeText: row.referenceRangeText,
    collectedAt: row.collectedAt,
    sourcePage: row.sourcePage,
    sourceLine: row.sourceLine,
    confidence: row.confidence,
  };
}

async function assertOcrConsents(link, engine, ctx) {
  const { assertConsentForLink } = await import("../consent/consentRecordService.js");
  await assertConsentForLink(link, "document_sharing", ctx);
  if (engine === "ai_vision") {
    await assertConsentForLink(link, "ai_organizational_assistance", ctx);
  }
}

function assertNotInterpretation() {
  if (isLabInterpretationEnabled()) {
    throw new Error("lab_interpretation_disabled");
  }
}

export async function startDocumentOcr(
  actorUserId,
  practiceProfileId,
  linkId,
  documentId,
  { fileId, engine: requestedEngine, locale },
  ctx = {},
) {
  assertNotInterpretation();
  if (!isDocumentOcrUiEnabled()) throw new Error("feature_disabled");

  const link = await assertLinkForPractice(linkId, practiceProfileId, {
    ...ctx,
    actorUserId,
    actorRole: ctx.access?.role,
  });

  if (!hasPracticePermission(ctx.access?.role, PERMISSIONS.DOCUMENTS_WRITE)) {
    throw new Error("forbidden");
  }

  const engine = resolveOcrEngine(requestedEngine);
  await assertOcrConsents(link, engine, {
    ...ctx,
    actorUserId,
    actorRole: ctx.access?.role,
  });

  const document = await getDocumentForPractice(documentId, linkId, practiceProfileId);
  const { file } = await getDocumentFileForPractice(
    documentId,
    fileId,
    linkId,
    practiceProfileId,
  );

  const running = await prisma.documentOcrJob.findFirst({
    where: { documentId, status: { in: ["pending", "running"] } },
  });
  if (running) throw new Error("ocr_job_in_progress");

  const job = await prisma.documentOcrJob.create({
    data: {
      documentId,
      fileId: file.id,
      practiceProfileId,
      practicePatientLinkId: linkId,
      patientUserId: document.patientUserId,
      status: "running",
      engine,
      startedAt: new Date(),
      createdByUserId: actorUserId,
    },
  });

  try {
    const buffer = await storage.getObject(file.storageKey);
    const adapter = getDocumentOcrEngine(engine);
    const extracted = await adapter.extract({
      buffer,
      mimeType: file.mimeType,
      documentType: document.type,
      locale,
    });

    if (!extracted.ok) {
      await prisma.documentOcrJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          failedAt: new Date(),
          errorCode: extracted.error || "ocr_failed",
        },
      });
      throw new Error(extracted.error || "ocr_unavailable");
    }

    const result = await prisma.documentOcrResult.create({
      data: {
        ocrJobId: job.id,
        documentId,
        reviewStatus: "needs_review",
        structuredJson: extracted.structuredJson,
        confidence: extracted.confidence,
        language: extracted.language,
      },
    });

    if (extracted.entries?.length) {
      await prisma.labStructuredEntry.createMany({
        data: extracted.entries.map((e) => ({
          documentId,
          ocrJobId: job.id,
          label: String(e.label || "").slice(0, 200),
          valueText: String(e.valueText || "unklar").slice(0, 200),
          unit: e.unit ? String(e.unit).slice(0, 80) : null,
          referenceRangeText: e.referenceRangeText
            ? String(e.referenceRangeText).slice(0, 200)
            : null,
          sourceLine: e.sourceLine ?? null,
          sourcePage: e.sourcePage ?? null,
          confidence: e.confidence ?? null,
        })),
      });
    }

    await prisma.documentOcrJob.update({
      where: { id: job.id },
      data: { status: "completed", completedAt: new Date() },
    });

    return {
      job: jobToJson({
        ...job,
        status: "completed",
        completedAt: new Date(),
        result,
      }),
    };
  } catch (err) {
    if (err.message !== "ocr_unavailable" && err.message !== "ocr_disabled") {
      await prisma.documentOcrJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          failedAt: new Date(),
          errorCode: err.message?.slice(0, 80) || "ocr_failed",
        },
      }).catch(() => {});
    }
    throw err;
  }
}

export async function getDocumentOcrStatus(
  practiceProfileId,
  linkId,
  documentId,
  ctx = {},
) {
  if (!isDocumentOcrUiEnabled()) throw new Error("feature_disabled");
  await assertLinkForPractice(linkId, practiceProfileId, ctx);
  if (!hasPracticePermission(ctx.access?.role, PERMISSIONS.DOCUMENTS_READ)) {
    throw new Error("forbidden");
  }

  const job = await prisma.documentOcrJob.findFirst({
    where: { documentId, practiceProfileId },
    include: { result: true },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return { job: null };
  return { job: jobToJson(job) };
}

export async function getDocumentOcrResult(
  practiceProfileId,
  linkId,
  documentId,
  ctx = {},
) {
  if (!isDocumentOcrUiEnabled()) throw new Error("feature_disabled");
  await assertLinkForPractice(linkId, practiceProfileId, ctx);
  if (!hasPracticePermission(ctx.access?.role, PERMISSIONS.DOCUMENTS_READ)) {
    throw new Error("forbidden");
  }

  const job = await prisma.documentOcrJob.findFirst({
    where: { documentId, practiceProfileId, status: "completed" },
    include: { result: true },
    orderBy: { createdAt: "desc" },
  });
  if (!job?.result) return { result: null, entries: [] };

  const entries = await prisma.labStructuredEntry.findMany({
    where: { ocrJobId: job.id },
    orderBy: { sourceLine: "asc" },
  });

  return {
    job: jobToJson(job),
    result: {
      id: job.result.id,
      reviewStatus: job.result.reviewStatus,
      language: job.result.language,
      confidence: job.result.confidence,
      structuredJson: job.result.structuredJson,
      autoDetected: true,
    },
    entries: entries.map(entryToJson),
  };
}

export async function patchDocumentOcrResult(
  actorUserId,
  practiceProfileId,
  linkId,
  documentId,
  body,
  ctx = {},
) {
  if (!isDocumentOcrUiEnabled()) throw new Error("feature_disabled");
  await assertLinkForPractice(linkId, practiceProfileId, {
    ...ctx,
    actorUserId,
    actorRole: ctx.access?.role,
  });
  if (!hasPracticePermission(ctx.access?.role, PERMISSIONS.DOCUMENTS_WRITE)) {
    throw new Error("forbidden");
  }

  const job = await prisma.documentOcrJob.findFirst({
    where: { documentId, practiceProfileId, status: "completed" },
    include: { result: true },
    orderBy: { createdAt: "desc" },
  });
  if (!job?.result) throw new Error("ocr_result_not_found");
  if (job.result.reviewStatus === "discarded") throw new Error("ocr_result_discarded");

  const entries = Array.isArray(body.entries) ? body.entries : null;
  if (entries) {
    await prisma.labStructuredEntry.deleteMany({ where: { ocrJobId: job.id } });
    if (entries.length) {
      await prisma.labStructuredEntry.createMany({
        data: entries.map((e) => ({
          documentId,
          ocrJobId: job.id,
          label: String(e.label || "").slice(0, 200),
          valueText: String(e.valueText || "unklar").slice(0, 200),
          unit: e.unit ? String(e.unit).slice(0, 80) : null,
          referenceRangeText: e.referenceRangeText
            ? String(e.referenceRangeText).slice(0, 200)
            : null,
          sourceLine: e.sourceLine ?? null,
          sourcePage: e.sourcePage ?? null,
          confidence: e.confidence ?? null,
        })),
      });
    }
  }

  const nextStatus =
    body.reviewStatus && REVIEW_STATUSES.has(body.reviewStatus)
      ? body.reviewStatus
      : "reviewed";

  const updated = await prisma.documentOcrResult.update({
    where: { id: job.result.id },
    data: { reviewStatus: nextStatus },
  });

  const rows = await prisma.labStructuredEntry.findMany({
    where: { ocrJobId: job.id },
    orderBy: { sourceLine: "asc" },
  });

  return {
    result: {
      id: updated.id,
      reviewStatus: updated.reviewStatus,
      language: updated.language,
      confidence: updated.confidence,
      autoDetected: true,
    },
    entries: rows.map(entryToJson),
  };
}

export async function shareDocumentOcrResult(
  actorUserId,
  practiceProfileId,
  linkId,
  documentId,
  ctx = {},
) {
  if (!isDocumentOcrUiEnabled()) throw new Error("feature_disabled");
  await assertLinkForPractice(linkId, practiceProfileId, {
    ...ctx,
    actorUserId,
    actorRole: ctx.access?.role,
  });
  if (!hasPracticePermission(ctx.access?.role, PERMISSIONS.DOCUMENTS_WRITE)) {
    throw new Error("forbidden");
  }

  const job = await prisma.documentOcrJob.findFirst({
    where: { documentId, practiceProfileId, status: "completed" },
    include: { result: true },
    orderBy: { createdAt: "desc" },
  });
  if (!job?.result) throw new Error("ocr_result_not_found");
  if (!["reviewed", "needs_review"].includes(job.result.reviewStatus)) {
    throw new Error("ocr_not_ready_to_share");
  }

  const updated = await prisma.documentOcrResult.update({
    where: { id: job.result.id },
    data: { reviewStatus: "shared" },
  });

  return {
    result: {
      id: updated.id,
      reviewStatus: updated.reviewStatus,
    },
  };
}

export async function discardDocumentOcrResult(
  actorUserId,
  practiceProfileId,
  linkId,
  documentId,
  ctx = {},
) {
  if (!isDocumentOcrUiEnabled()) throw new Error("feature_disabled");
  await assertLinkForPractice(linkId, practiceProfileId, {
    ...ctx,
    actorUserId,
    actorRole: ctx.access?.role,
  });
  if (!hasPracticePermission(ctx.access?.role, PERMISSIONS.DOCUMENTS_WRITE)) {
    throw new Error("forbidden");
  }

  const job = await prisma.documentOcrJob.findFirst({
    where: { documentId, practiceProfileId },
    include: { result: true },
    orderBy: { createdAt: "desc" },
  });
  if (!job) throw new Error("ocr_result_not_found");

  if (job.result) {
    await prisma.documentOcrResult.update({
      where: { id: job.result.id },
      data: { reviewStatus: "discarded" },
    });
  }

  if (job.status === "pending" || job.status === "running") {
    await prisma.documentOcrJob.update({
      where: { id: job.id },
      data: { status: "cancelled" },
    });
  }

  return { ok: true };
}

export async function getPatientStructuredDocument(documentId, patientUserId, ctx = {}) {
  if (!isDocumentOcrUiEnabled()) throw new Error("feature_disabled");

  await getSharedDocumentForPatient(documentId, patientUserId);

  const result = await prisma.documentOcrResult.findFirst({
    where: {
      documentId,
      reviewStatus: "shared",
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!result) return { structured: null };

  const job = await prisma.documentOcrJob.findUnique({
    where: { id: result.ocrJobId },
  });

  const entries = await prisma.labStructuredEntry.findMany({
    where: { ocrJobId: result.ocrJobId },
    orderBy: { sourceLine: "asc" },
  });

  return {
    structured: {
      documentId,
      reviewStatus: result.reviewStatus,
      language: result.language,
      autoDetected: true,
      entries: entries.map(entryToJson),
      structuredMeta: result.structuredJson,
    },
  };
}

export async function listPracticeOcrJobs(practiceProfileId, limit = 50) {
  if (!isDocumentOcrUiEnabled()) throw new Error("feature_disabled");
  const rows = await prisma.documentOcrJob.findMany({
    where: { practiceProfileId },
    include: { result: true },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });
  return rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    fileId: r.fileId,
    status: r.status,
    engine: r.engine,
    reviewStatus: r.result?.reviewStatus ?? null,
    createdAt: r.createdAt,
  }));
}
