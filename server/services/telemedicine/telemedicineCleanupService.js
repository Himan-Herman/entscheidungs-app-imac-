import { prisma } from "../../lib/prisma.js";
import { isTelemedicineUiEnabled } from "../../config/featureFlags.js";
import { writeAuditLog } from "../auditLogService.js";
import { notifyTelemedicineEvent } from "./telemedicineNotify.js";
import {
  PARTICIPANT_OPEN_STATUSES,
  TELEMEDICINE_ACTIVE_REVIEW_MS,
  TELEMEDICINE_OPEN_STATUSES,
  TELEMEDICINE_PLANNED_GRACE_MS,
  TELEMEDICINE_TERMINAL_STATUSES,
  TELEMEDICINE_WAITING_MAX_MS,
  telemedicineCleanupBatchSize,
} from "./telemedicineCleanupConstants.js";


let lastRunAt = null;

function auditCleanup(action, sessionId, metadata = {}) {
  writeAuditLog({
    actorRole: "system",
    action,
    entityType: "telemedicine_session",
    entityId: sessionId,
    metadata,
  }).catch(() => {});
}

/**
 * @param {import('@prisma/client').TelemedicineSession} session
 * @param {'cancelled'|'failed'} newStatus
 * @param {string} reason
 */
async function finalizeSession(session, newStatus, reason) {
  const now = new Date();
  const updated = await prisma.telemedicineSession.updateMany({
    where: {
      id: session.id,
      status: { in: [...TELEMEDICINE_OPEN_STATUSES] },
    },
    data: {
      status: newStatus,
      endedAt: now,
    },
  });

  if (updated.count !== 1) return false;

  auditCleanup(
    newStatus === "cancelled"
      ? "telemedicine.session.auto_cancelled"
      : "telemedicine.session.auto_failed",
    session.id,
    { reason, previousStatus: session.status },
  );

  const refreshed = await prisma.telemedicineSession.findUnique({
    where: { id: session.id },
  });
  if (refreshed?.patientUserId) {
    await notifyTelemedicineEvent(refreshed, "closed").catch(() => {});
  }

  return true;
}

async function cleanupRevokedLinks(now, limit) {
  const rows = await prisma.telemedicineSession.findMany({
    where: {
      linkRevokedAt: { not: null },
      status: { in: [...TELEMEDICINE_OPEN_STATUSES] },
    },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });

  let count = 0;
  for (const row of rows) {
    const ok = await finalizeSession(row, "cancelled", "link_revoked");
    if (ok) {
      count += 1;
      auditCleanup("telemedicine.link.revoked_cleanup", row.id, {
        practiceProfileId: row.practiceProfileId,
      });
    }
  }
  return count;
}

async function cleanupStaleWaiting(now, limit) {
  const cutoff = new Date(now.getTime() - TELEMEDICINE_WAITING_MAX_MS);
  const rows = await prisma.telemedicineSession.findMany({
    where: {
      status: "waiting",
      updatedAt: { lt: cutoff },
      linkRevokedAt: null,
    },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });

  let count = 0;
  for (const row of rows) {
    if (await finalizeSession(row, "cancelled", "waiting_timeout")) count += 1;
  }
  return count;
}

async function cleanupStalePlanned(now, limit) {
  const graceCutoff = new Date(now.getTime() - TELEMEDICINE_PLANNED_GRACE_MS);
  const rows = await prisma.telemedicineSession.findMany({
    where: {
      status: "planned",
      scheduledEndAt: { not: null, lt: graceCutoff },
      linkRevokedAt: null,
    },
    take: limit,
    orderBy: { scheduledEndAt: "asc" },
  });

  let count = 0;
  for (const row of rows) {
    if (await finalizeSession(row, "failed", "planned_window_passed")) count += 1;
  }
  return count;
}

async function noteStaleActiveSessions(now, limit) {
  const cutoff = new Date(now.getTime() - TELEMEDICINE_ACTIVE_REVIEW_MS);
  const rows = await prisma.telemedicineSession.findMany({
    where: {
      status: "active",
      startedAt: { lt: cutoff },
    },
    take: limit,
    select: { id: true, practiceProfileId: true, startedAt: true },
  });

  for (const row of rows) {
    auditCleanup("telemedicine.session.stale_active_detected", row.id, {
      practiceProfileId: row.practiceProfileId,
      startedAt: row.startedAt?.toISOString(),
    });
  }
  return rows.length;
}

async function cleanupOrphanParticipants(limit) {
  const now = new Date();
  const orphans = await prisma.telemedicineParticipant.findMany({
    where: {
      status: { in: [...PARTICIPANT_OPEN_STATUSES] },
      leftAt: null,
      session: { status: { in: [...TELEMEDICINE_TERMINAL_STATUSES] } },
    },
    select: { id: true, sessionId: true },
    take: limit,
  });

  if (orphans.length === 0) return 0;

  const bySession = new Map();
  for (const row of orphans) {
    bySession.set(row.sessionId, (bySession.get(row.sessionId) || 0) + 1);
  }

  const result = await prisma.telemedicineParticipant.updateMany({
    where: { id: { in: orphans.map((o) => o.id) } },
    data: { status: "left", leftAt: now },
  });

  for (const [sessionId, participantCount] of bySession) {
    auditCleanup("telemedicine.participant.cleaned", sessionId, { participantCount });
  }

  return result.count;
}

/**
 * @param {{ limit?: number }} [opts]
 */
export async function processTelemedicineCleanup(opts = {}) {
  if (!isTelemedicineUiEnabled()) {
    return { skipped: true, reason: "feature_disabled" };
  }

  const now = new Date();
  const batch = opts.limit ?? telemedicineCleanupBatchSize();

  writeAuditLog({
    actorRole: "system",
    action: "telemedicine.session.cleanup_started",
    entityType: "telemedicine_cleanup",
    metadata: { batchSize: batch },
  }).catch(() => {});

  const revokedCancelled = await cleanupRevokedLinks(now, batch);
  const waitingCancelled = await cleanupStaleWaiting(now, batch);
  const plannedFailed = await cleanupStalePlanned(now, batch);
  const participantsCleaned = await cleanupOrphanParticipants(batch);
  const activeStaleNoted = await noteStaleActiveSessions(now, batch);

  lastRunAt = now;

  const stats = {
    revokedCancelled,
    waitingCancelled,
    plannedFailed,
    participantsCleaned,
    activeStaleNoted,
    lastRunAt: lastRunAt.toISOString(),
  };

  return stats;
}

export async function getTelemedicineCleanupStatus() {
  const now = new Date();
  const waitingCutoff = new Date(now.getTime() - TELEMEDICINE_WAITING_MAX_MS);
  const plannedCutoff = new Date(now.getTime() - TELEMEDICINE_PLANNED_GRACE_MS);

  const [waitingStale, plannedStale, revokedOpen, activeLong] = await Promise.all([
    prisma.telemedicineSession.count({
      where: { status: "waiting", updatedAt: { lt: waitingCutoff } },
    }),
    prisma.telemedicineSession.count({
      where: {
        status: "planned",
        scheduledEndAt: { not: null, lt: plannedCutoff },
      },
    }),
    prisma.telemedicineSession.count({
      where: {
        linkRevokedAt: { not: null },
        status: { in: [...TELEMEDICINE_OPEN_STATUSES] },
      },
    }),
    prisma.telemedicineSession.count({
      where: {
        status: "active",
        startedAt: { lt: new Date(now.getTime() - TELEMEDICINE_ACTIVE_REVIEW_MS) },
      },
    }),
  ]);

  return {
    waitingStale,
    plannedStale,
    revokedOpen,
    activeLong,
    lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
    enabled: isTelemedicineUiEnabled(),
  };
}
