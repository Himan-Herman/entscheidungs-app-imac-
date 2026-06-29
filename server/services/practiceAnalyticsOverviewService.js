import { prisma } from "../lib/prisma.js";
import { hashAnalyticsId } from "./analyticsService.js";


const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

/**
 * Conservative, clearly-labelled estimate: minutes saved per digitally prepared
 * case (anamnesis submission or completed pre-visit). NOT a billing figure and
 * NOT a medical-quality claim — surfaced in the UI as an estimate only.
 */
export const MINUTES_SAVED_PER_PREPARATION = 5;

/**
 * Aggregated, privacy-safe practice usage / ROI overview.
 *
 * Uses COUNTS ONLY from existing models — never selects or includes patient
 * data, free-text, answers, images, PDFs or chat. AnalyticsEvent is queried by
 * salted practiceHash only (no raw identities).
 *
 * @param {string} practiceProfileId
 * @param {{ days?: number }} opts
 */
export async function getPracticeAnalyticsOverview(practiceProfileId, opts = {}) {
  const pid = String(practiceProfileId || "").trim();
  if (!pid) throw new Error("practiceId_required");

  const days = Math.min(
    Math.max(Number.isFinite(opts.days) ? Number(opts.days) : DEFAULT_DAYS, 1),
    MAX_DAYS,
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const practiceHash = hashAnalyticsId(pid);

  // Owner is implicit (PracticeProfile.userId); counted as one active member.
  const practice = await prisma.practiceProfile.findUnique({
    where: { id: pid },
    select: { userId: true },
  });
  const ownerUserId = practice?.userId || null;

  const [
    preVisitTotal,
    preVisitWindow,
    preVisitCompletedWindow,
    templatesTotal,
    templatesActive,
    submissionsTotal,
    submissionsWindow,
    activeMembersExclOwner,
    pendingInvites,
    trackedEventsTotal,
    trackedEventsWindow,
  ] = await Promise.all([
    prisma.preVisitSession.count({ where: { practiceProfileId: pid } }),
    prisma.preVisitSession.count({
      where: { practiceProfileId: pid, createdAt: { gte: since } },
    }),
    prisma.preVisitSession.count({
      where: { practiceProfileId: pid, practiceStatus: "completed", updatedAt: { gte: since } },
    }),
    prisma.practiceAnamnesisTemplate.count({ where: { practiceProfileId: pid } }),
    prisma.practiceAnamnesisTemplate.count({
      where: { practiceProfileId: pid, status: "active" },
    }),
    prisma.practiceAnamnesisSubmission.count({
      where: { practiceProfileId: pid, deletedAt: null },
    }),
    prisma.practiceAnamnesisSubmission.count({
      where: { practiceProfileId: pid, deletedAt: null, createdAt: { gte: since } },
    }),
    prisma.practiceMember.count({
      where: { practiceProfileId: pid, status: "active", userId: { not: ownerUserId } },
    }),
    prisma.practiceMember.count({ where: { practiceProfileId: pid, status: "invited" } }),
    practiceHash
      ? prisma.analyticsEvent.count({ where: { practiceHash } })
      : Promise.resolve(0),
    practiceHash
      ? prisma.analyticsEvent.count({ where: { practiceHash, createdAt: { gte: since } } })
      : Promise.resolve(0),
  ]);

  // ROI estimate basis: digitally completed preparations in the window.
  const completedPreparations = submissionsWindow + preVisitCompletedWindow;
  const hasBasis = completedPreparations > 0;
  const estimatedMinutesSaved = completedPreparations * MINUTES_SAVED_PER_PREPARATION;

  return {
    windowDays: days,
    sinceIso: since.toISOString(),
    preVisit: {
      total: preVisitTotal,
      window: preVisitWindow,
      completedWindow: preVisitCompletedWindow,
    },
    anamnesis: {
      templatesTotal,
      templatesActive,
      submissionsTotal,
      submissionsWindow,
    },
    team: {
      activeMembers: activeMembersExclOwner + (ownerUserId ? 1 : 0),
      pendingInvites,
    },
    usage: {
      trackedEventsTotal,
      trackedEventsWindow,
    },
    roi: {
      completedPreparations,
      minutesPerPreparation: MINUTES_SAVED_PER_PREPARATION,
      estimatedMinutesSaved,
      estimatedHoursSaved: Math.round((estimatedMinutesSaved / 60) * 10) / 10,
      hasBasis,
    },
  };
}
