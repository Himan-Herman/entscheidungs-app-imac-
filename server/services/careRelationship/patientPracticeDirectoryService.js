import { prisma } from "../../lib/prisma.js";
import { practiceDisplayName, practiceLogoUrl } from "../../utils/practiceBranding.js";

/**
 * The patient's own care relationships, in the shape the practice chooser needs.
 *
 * SCOPE
 * -----
 * Only relationships of the SESSION's patient. No patientId is accepted from the
 * client, and this is not a practice search: a practice the patient is not
 * connected to can never appear here.
 *
 * DATA MINIMISATION
 * -----------------
 * Display metadata and counts only. No message bodies and no thread subjects —
 * a subject is user-authored free text that may carry health information
 * (Phase 2A), so it must never travel just to render a badge.
 *
 * QUERY COUNT
 * -----------
 * Bounded and constant at THREE queries regardless of how many practices the
 * patient has: links, their channels, and one grouped unread count. Deliberately
 * not squeezed into a single query — three readable statements beat one fragile
 * one, and the requirement is "no N+1", not "exactly one".
 */

/** Relationship states the chooser shows at all. `declined` is not a relationship. */
const VISIBLE_STATUSES = ["invited", "active", "revoked", "archived"];

/** States presented as live. Mirrors isContextActive() on the client. */
const ACTIVE_STATUSES = new Set(["invited", "active"]);

/**
 * @param {string} patientUserId
 * @returns {Promise<{ contexts: object[] }>}
 */
export async function listPatientPracticeContexts(patientUserId) {
  const uid = String(patientUserId || "").trim();
  if (!uid) throw new Error("validation_required");

  // 1/3 — the relationships themselves, with the practice fields we display.
  const links = await prisma.practicePatientLink.findMany({
    where: { patientUserId: uid, status: { in: VISIBLE_STATUSES } },
    include: {
      practiceProfile: {
        select: {
          id: true,
          practiceName: true,
          displayNameForPatients: true,
          logoUrl: true,
          logoStorageKey: true,
          specialty: true,
          city: true,
        },
      },
      // Only the display name, and only to tell two relationships with the SAME
      // practice apart. `userId` comes along solely to prove the profile is the
      // session user's own before its name is shown (see below) — it never
      // leaves this function.
      patientProfile: { select: { displayName: true, userId: true } },
    },
  });

  if (links.length === 0) return { contexts: [] };

  const linkIds = links.map((l) => l.id);

  // 2/3 — one channel per link since Phase 2A, so this is a flat lookup.
  //       patientArchivedAt is the PATIENT's own view state (Phase 2A.2); the
  //       practice's archive is none of this list's business.
  const channels = await prisma.practicePatientThread.findMany({
    where: { practicePatientLinkId: { in: linkIds } },
    select: {
      id: true,
      practicePatientLinkId: true,
      updatedAt: true,
      patientArchivedAt: true,
    },
  });

  const channelByLink = new Map(channels.map((c) => [c.practicePatientLinkId, c]));

  // 3/3 — unread practice messages per channel, grouped in ONE query.
  const unreadRows = channels.length
    ? await prisma.practicePatientMessage.groupBy({
        by: ["threadId"],
        where: {
          threadId: { in: channels.map((c) => c.id) },
          senderType: "practice",
          readAt: null,
        },
        _count: { _all: true },
      })
    : [];

  const unreadByThread = new Map(unreadRows.map((r) => [r.threadId, r._count._all]));

  const contexts = links.map((link) => {
    const channel = channelByLink.get(link.id) ?? null;
    const practice = link.practiceProfile;

    /*
     * WHICH PERSON this relationship is for.
     *
     * `patientProfileId` is NULL when the relationship is the account holder's
     * own; a PatientProfile row exists only for a family profile. So a name
     * here means "this relationship is not about you", and its absence means
     * it is.
     *
     * The name is checked against the session user before it is returned. Link
     * ownership already implies it, so this can only fire on a data fault — but
     * the whole point of this field is to tell people apart, and a label naming
     * the wrong person is worse than no label at all.
     */
    const profile = link.patientProfile;
    const patientProfileName =
      profile && profile.userId === uid ? profile.displayName : null;

    return {
      // Identity is ALWAYS the link id, never the display name: two practices
      // may legitimately share a name, and two links may point at the same
      // practice through different patient profiles.
      linkId: link.id,
      status: link.status,
      isActive: ACTIVE_STATUSES.has(link.status),
      // null = the account holder in person. The client supplies its own
      // wording for that case, so no translated string is invented here.
      patientProfileName,
      practice: practice
        ? {
            displayName: practiceDisplayName(practice),
            specialty: practice.specialty ? String(practice.specialty).trim().slice(0, 160) : null,
            city: practice.city ? String(practice.city).trim().slice(0, 120) : null,
            logoUrl: practiceLogoUrl(practice),
          }
        : null,
      // Counts and timestamps only — never content.
      unreadCount: channel ? (unreadByThread.get(channel.id) ?? 0) : 0,
      lastActivityAt: channel?.updatedAt ?? null,
      hasChannel: Boolean(channel),
      // The patient's own archive of this conversation, for presentation.
      patientArchived: Boolean(channel?.patientArchivedAt),
    };
  });

  return { contexts };
}
