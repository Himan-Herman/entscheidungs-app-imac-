/**
 * Export + OCR background job smoke tests.
 * Usage: node scripts/verifyBackgroundJobs.js
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  createExportJob,
  exportJobToJson,
  processExportJob,
} from "../services/export/exportJobService.js";
import {
  JOB_STATUS,
  isTransientJobError,
  computeJobNextRetryAt,
} from "../services/backgroundJobs/jobConstants.js";
import { runBackgroundJobWorker } from "../services/backgroundJobs/backgroundJobWorker.js";

const prisma = new PrismaClient();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  assert(isTransientJobError("network_error"), "network is transient");
  assert(!isTransientJobError("forbidden"), "forbidden is terminal");
  const t1 = computeJobNextRetryAt(0);
  const t2 = computeJobNextRetryAt(2);
  assert(t2 > t1, "backoff increases");
  console.log("[verify] job constants ok");

  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) {
    console.log("[verify] skip export — no user");
    return;
  }

  const job = await createExportJob({
    requestedByUserId: user.id,
    actorRole: "patient",
    type: "activity",
    format: "csv",
    locale: "de",
    patientUserId: user.id,
  });
  assert(job.status === JOB_STATUS.PENDING, "export created pending");
  console.log("[verify] createExportJob pending ok");

  const claimed = await prisma.exportJob.updateMany({
    where: { id: job.id, status: JOB_STATUS.PENDING },
    data: { status: JOB_STATUS.PROCESSING, processingAt: new Date() },
  });
  assert(claimed.count === 1, "claim export");

  const secondClaim = await prisma.exportJob.updateMany({
    where: { id: job.id, status: JOB_STATUS.PENDING },
    data: { status: JOB_STATUS.PROCESSING, processingAt: new Date() },
  });
  assert(secondClaim.count === 0, "no double claim");

  const outcome = await processExportJob(job.id);
  console.log("[verify] processExportJob outcome:", outcome.status || outcome);

  const row = await prisma.exportJob.findUnique({ where: { id: job.id } });
  const json = exportJobToJson(row);
  if (json.status === JOB_STATUS.COMPLETED) {
    assert(json.downloadReady, "download ready when completed");
  }
  console.log("[verify] export final status:", json.status);

  const stats = await runBackgroundJobWorker({ limit: 5 });
  console.log("[verify] worker run:", JSON.stringify(stats));

  console.log("[verify] done");
}

main()
  .catch((e) => {
    console.error("[verify] failed:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
