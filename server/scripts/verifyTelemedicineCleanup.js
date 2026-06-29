/**
 * Telemedicine cleanup smoke tests.
 * Usage: ENABLE_TELEMEDICINE=true node scripts/verifyTelemedicineCleanup.js
 */

import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import {
  processTelemedicineCleanup,
  getTelemedicineCleanupStatus,
} from "../services/telemedicine/telemedicineCleanupService.js";
import {
  TELEMEDICINE_PLANNED_GRACE_MS,
  TELEMEDICINE_WAITING_MAX_MS,
} from "../services/telemedicine/telemedicineCleanupConstants.js";


function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  process.env.ENABLE_TELEMEDICINE = "true";

  const practice = await prisma.practiceProfile.findFirst({ select: { id: true } });
  if (!practice) {
    console.log("[verify] skip — no practice in DB");
    return;
  }

  const now = Date.now();
  const prefix = `verify_tm_${now}`;

  const waitingStale = await prisma.telemedicineSession.create({
    data: {
      practiceProfileId: practice.id,
      status: "waiting",
      title: `${prefix}_waiting`,
      updatedAt: new Date(now - TELEMEDICINE_WAITING_MAX_MS - 60_000),
    },
  });

  const plannedStale = await prisma.telemedicineSession.create({
    data: {
      practiceProfileId: practice.id,
      status: "planned",
      title: `${prefix}_planned`,
      scheduledEndAt: new Date(now - TELEMEDICINE_PLANNED_GRACE_MS - 60_000),
    },
  });

  const revoked = await prisma.telemedicineSession.create({
    data: {
      practiceProfileId: practice.id,
      status: "waiting",
      title: `${prefix}_revoked`,
      linkRevokedAt: new Date(now - 3_600_000),
    },
  });

  const terminal = await prisma.telemedicineSession.create({
    data: {
      practiceProfileId: practice.id,
      status: "cancelled",
      title: `${prefix}_terminal`,
      endedAt: new Date(),
    },
  });

  const orphan = await prisma.telemedicineParticipant.create({
    data: {
      sessionId: terminal.id,
      role: "patient",
      status: "joined",
    },
  });

  const run1 = await processTelemedicineCleanup({ limit: 100 });
  assert(run1.waitingCancelled >= 1, "waiting stale cancelled");
  assert(run1.plannedFailed >= 1, "planned stale failed");
  assert(run1.revokedCancelled >= 1, "revoked session cancelled");
  assert(run1.participantsCleaned >= 1, "orphan participant cleaned");
  console.log("[verify] first cleanup run ok", run1);

  const w = await prisma.telemedicineSession.findUnique({ where: { id: waitingStale.id } });
  const p = await prisma.telemedicineSession.findUnique({ where: { id: plannedStale.id } });
  const r = await prisma.telemedicineSession.findUnique({ where: { id: revoked.id } });
  assert(w?.status === "cancelled", "waiting -> cancelled");
  assert(p?.status === "failed", "planned -> failed");
  assert(r?.status === "cancelled", "revoked -> cancelled");

  const part = await prisma.telemedicineParticipant.findUnique({ where: { id: orphan.id } });
  assert(part?.status === "left" && part.leftAt, "participant leftAt set");

  const run2 = await processTelemedicineCleanup({ limit: 100 });
  assert(run2.waitingCancelled === 0, "idempotent waiting");
  assert(run2.plannedFailed === 0, "idempotent planned");
  console.log("[verify] second cleanup run idempotent ok");

  const audits = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          "telemedicine.session.cleanup_started",
          "telemedicine.session.auto_cancelled",
          "telemedicine.session.auto_failed",
          "telemedicine.participant.cleaned",
          "telemedicine.link.revoked_cleanup",
        ],
      },
      createdAt: { gte: new Date(now - 120_000) },
    },
    select: { action: true, metadata: true },
    take: 50,
  });
  assert(audits.length > 0, "audit logs written");
  for (const row of audits) {
    const meta = row.metadata || {};
    const blob = JSON.stringify(meta);
    assert(!/joinUrl|hostUrl|secret|providerSecret/i.test(blob), "audit has no secrets/urls");
  }
  console.log("[verify] audit metadata ok");

  const status = await getTelemedicineCleanupStatus();
  assert(status.enabled === true, "status enabled");
  console.log("[verify] status ok", status);

  await prisma.telemedicineParticipant.deleteMany({
    where: { sessionId: { in: [waitingStale.id, plannedStale.id, revoked.id, terminal.id] } },
  });
  await prisma.telemedicineSession.deleteMany({
    where: { id: { in: [waitingStale.id, plannedStale.id, revoked.id, terminal.id] } },
  });
  console.log("[verify] cleanup fixtures removed");
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error("[verify] failed:", err.message);
    prisma.$disconnect().finally(() => process.exit(1));
  });
