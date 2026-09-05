/**
 * The claim: a patient binds THEIR account to one practice-local entry.
 *
 * This is the only place a PracticePatientLink comes into existence from an
 * invitation, and it is deliberately the narrowest thing that can work:
 *
 *   it creates the technical relationship and NOTHING else.
 *
 * No ConsentRecord, no scope, no access. The link is born `invited`, which
 * every consent-guarded route already refuses. Consent is a separate, later,
 * explicit act by the patient — that separation is the whole reason the
 * fail-closed consent fix holds.
 *
 * The practice never learns whether an account exists: it learns that somebody
 * redeemed the credential it handed out, which the patient chose to do.
 */
import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import { writeRequiredAuditLog } from "../auditLogService.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { practiceDisplayName } from "../../utils/practiceBranding.js";
import { lockEntryForUpdate } from "./practicePatientEntryService.js";
import {
  evaluateInvitationRedeemable,
  evaluateManualCodeUsable,
  hashInvitationToken,
  hashManualCode,
} from "./invitationTokens.js";

/**
 * Recorded in the audit so a later reader knows WHICH server-side claim flow a
 * request went through. It says nothing about what text was on the screen — a
 * rendering proof would need versioned, immutable consent copy referenced from
 * the audit row, which is a separate design.
 */
export const CLAIM_FLOW_VERSION = "1";

/** Link states that still count as a live relationship. */
const ACTIVE_LIKE = new Set(["invited", "active"]);

/**
 * Every credential failure collapses to this. Unknown, expired, spent, revoked,
 * replaced, belonging to a switched-off practice, or presented by somebody who
 * works at the issuing practice — one answer, so none of them can be told apart.
 */
export const GENERIC_CLAIM_ERROR = "invalid_or_expired_invitation";

/**
 * Normalise and validate the subject.
 *
 * The caller must SAY who the relationship is for. There is deliberately no
 * default to `self`: somebody connecting on behalf of their child who forgets
 * the field would otherwise silently create a relationship about themselves,
 * and that cannot be undone without touching the practice's records.
 *
 * @param {unknown} subject
 * @returns {{ type: "self" } | { type: "patient_profile", patientProfileId: string }}
 */
export function parseSubject(subject) {
  if (!subject || typeof subject !== "object") throw new Error("validation_subject_required");
  const type = String(subject.type || "").trim();
  if (type === "self") return { type: "self" };
  if (type === "patient_profile") {
    const id = String(subject.patientProfileId || "").trim();
    if (!id) throw new Error("validation_subject_required");
    return { type: "patient_profile", patientProfileId: id };
  }
  throw new Error("validation_subject_invalid");
}

/**
 * Resolve the subject to the profile id the link will carry.
 *
 * A profile that belongs to somebody else, one that is archived, and one that
 * never existed all fail identically — the account holder must not be able to
 * probe for other people's profile ids.
 *
 * @param {object} tx
 * @param {string} userId
 * @param {ReturnType<typeof parseSubject>} subject
 * @returns {Promise<string|null>} patientProfileId, or null for `self`
 */
async function resolveSubject(tx, userId, subject) {
  if (subject.type === "self") return null;
  const profile = await tx.patientProfile.findFirst({
    where: { id: subject.patientProfileId, userId, isArchived: false },
    select: { id: true },
  });
  if (!profile) throw new Error("validation_subject_invalid");
  return profile.id;
}

/** A stable 64-bit key for one (practice, account, subject) relationship slot. */
function relationshipLockKey(practiceProfileId, patientUserId, patientProfileId) {
  // Joined on an escape, not a literal separator byte: a NUL written straight
  // into the source makes the whole file read as binary to grep, diff and
  // editors. The delimiter still cannot occur inside a cuid, which is the
  // property that matters -- two different triples can never collide.
  const material = [practiceProfileId, patientUserId, patientProfileId ?? ""]
    .join("\u0000");
  // Two 32-bit halves of a SHA-256 make the pair pg_advisory_xact_lock takes.
  const digest = crypto.createHash("sha256").update(material).digest();
  return [digest.readInt32BE(0), digest.readInt32BE(4)];
}

/** The response shape. Deliberately tiny: an id to navigate with, and a name. */
function claimResponse(link, practice) {
  return {
    link: { id: link.id, status: link.status },
    practice: { displayName: practiceDisplayName(practice) },
  };
}

/**
 * Claim an invitation.
 *
 * @param {{ token?: string|null, code?: string|null, subject: unknown,
 *           userId: string, req?: import('express').Request }} input
 */
export async function claimInvitation(input) {
  const userId = String(input.userId || "").trim();
  if (!userId) throw new Error("validation_required");

  const token = String(input.token ?? "").trim();
  const code = String(input.code ?? "").trim();
  // Exactly one credential. Accepting both would leave it ambiguous which one
  // was actually spent, and accepting neither is simply an incomplete request.
  if (Boolean(token) === Boolean(code)) throw new Error("validation_credential_required");

  const subject = parseSubject(input.subject);
  const tokenHash = token ? hashInvitationToken(token) : null;
  const manualCodeHash = code ? hashManualCode(code) : null;

  /*
   * A NON-AUTHORITATIVE locator read. Its only job is to find which entry to
   * lock — the entry id is not derivable from the credential any other way.
   * Every single condition it touches is checked again inside the transaction,
   * because the invitation can be revoked, replaced or redeemed between this
   * statement and the lock.
   */
  const locator = await prisma.practicePatientInvitation.findUnique({
    where: tokenHash ? { tokenHash } : { manualCodeHash },
    select: { id: true, practicePatientEntryId: true, practiceProfileId: true },
  });
  if (!locator) throw new Error(GENERIC_CLAIM_ERROR);

  /*
   * Separation of duties, checked before the transaction because it needs no
   * lock and cannot change under us in any way that matters: whoever can issue
   * and regenerate a credential must not also redeem it as a patient. This is
   * NOT a statement about account classes — there are none — it is about the
   * two roles meeting on one specific practice. The same person may be a
   * patient of every other practice.
   */
  const access = await getPracticeAccess(userId, locator.practiceProfileId);
  if (access) throw new Error(GENERIC_CLAIM_ERROR);

  /*
   * A LOST RACE IS RETRIED ONCE, and only a lost race.
   *
   * The advisory lock serialises claim against claim, but not against the older
   * link writers — `redeemConnectCode` reaches createPracticePatientLink without
   * it. When such a writer wins, our INSERT hits a partial unique index and
   * PostgreSQL aborts the whole transaction, so the reuse branch cannot simply
   * catch it: every later statement in an aborted transaction fails too.
   *
   * Retrying the transaction from the top is the honest answer. Nothing from the
   * failed attempt persisted, and on the second pass the winner's link is
   * visible, so the ordinary reuse rule applies. Only P2002 on this model is
   * retried; every other failure is final, and a second collision means
   * something is wrong that a third attempt would not fix.
   */
  const MAX_ATTEMPTS = 2; // one attempt, one retry
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await claimOnce({ input, userId, subject, tokenHash, manualCodeHash, locator });
    } catch (err) {
      const lostRace = err?.code === "P2002" && err?.meta?.modelName === "PracticePatientLink";
      if (!lostRace) throw err;
    }
  }
  // Two collisions in a row: report the domain conflict, never a raw Prisma error.
  throw new Error("link_already_exists");
}

/** One attempt of the claim transaction. */
async function claimOnce({ input, userId, subject, tokenHash, manualCodeHash, locator }) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // ---------------------------------------------------------------- L1
    const entryLock = await lockEntryForUpdate(
      tx, locator.practicePatientEntryId, locator.practiceProfileId,
    ).catch(() => { throw new Error(GENERIC_CLAIM_ERROR); });

    // Re-read the invitation under the lock. This is the authoritative read.
    const invitation = await tx.practicePatientInvitation.findFirst({
      where: tokenHash ? { tokenHash } : { manualCodeHash },
    });
    if (!invitation) throw new Error(GENERIC_CLAIM_ERROR);
    if (invitation.id !== locator.id) throw new Error(GENERIC_CLAIM_ERROR);

    const practice = await tx.practiceProfile.findUnique({
      where: { id: invitation.practiceProfileId },
      select: { id: true, isActive: true, practiceName: true, displayNameForPatients: true },
    });
    if (!practice) throw new Error(GENERIC_CLAIM_ERROR);

    const entry = await tx.practicePatientEntry.findFirst({
      where: { id: invitation.practicePatientEntryId },
    });
    if (!entry) throw new Error(GENERIC_CLAIM_ERROR);

    // The invitation, the entry and the locked row must all name one practice.
    if (invitation.practiceProfileId !== entry.practiceProfileId
        || entry.practiceProfileId !== entryLock.practiceProfileId) {
      throw new Error(GENERIC_CLAIM_ERROR);
    }

    const subjectProfileId = await resolveSubject(tx, userId, subject);

    /* ------------------------------------------------- idempotent retry ---
     * The second click on "confirm" is the normal case, not an error. It is
     * answered as success ONLY when everything about the earlier claim matches
     * this one — same user, same subject, and an entry still pointing at the
     * link that was created. Anything else is not a repeat of this claim.
     */
    if (invitation.status === "redeemed") {
      if (invitation.redeemedByUserId !== userId) throw new Error(GENERIC_CLAIM_ERROR);
      const existing = entry.practicePatientLinkId
        ? await tx.practicePatientLink.findUnique({ where: { id: entry.practicePatientLinkId } })
        : null;
      if (!existing || existing.patientUserId !== userId) throw new Error(GENERIC_CLAIM_ERROR);
      if ((existing.patientProfileId ?? null) !== subjectProfileId) {
        // Same person, DIFFERENT subject. Answering 200 would claim a
        // relationship for the child that was in fact made for the parent.
        throw new Error("claim_subject_mismatch");
      }
      return claimResponse(existing, practice);
    }

    if (!practice.isActive) throw new Error(GENERIC_CLAIM_ERROR);

    // Credential still good? Both clocks for the typed code.
    const verdict = manualCodeHash
      ? evaluateManualCodeUsable(invitation, now)
      : evaluateInvitationRedeemable(invitation, now);
    if (!verdict.ok) throw new Error(GENERIC_CLAIM_ERROR);

    // The entry must still be claimable. Three conditions, not one: the frozen
    // model lets `linkedAt` outlive the link row, and such an entry is a
    // historical fact, never a fresh draft.
    if (entry.status !== "invited" || entry.linkedAt || entry.practicePatientLinkId) {
      throw new Error("entry_not_claimable");
    }

    /* ---------------------------------------------------------------- L2
     * Winner election. Conditional, so of two simultaneous claims exactly one
     * updates a row; the loser sees count 0 and stops before any link exists.
     */
    const won = await tx.practicePatientInvitation.updateMany({
      where: { id: invitation.id, status: "pending", expiresAt: { gt: now } },
      data: {
        status: "redeemed",
        redeemedAt: now,
        redeemedByUserId: userId,
        updatedAt: now,
      },
    });
    if (won.count !== 1) throw new Error(GENERIC_CLAIM_ERROR);

    /* ---------------------------------------------------------------- L3
     * The relationship slot. Two claims on DIFFERENT entries of the same
     * practice for the same person never touch the same entry row, so L1 does
     * not serialise them — this does. The partial unique indexes are the last
     * line behind it.
     */
    const [k1, k2] = relationshipLockKey(practice.id, userId, subjectProfileId);
    // $executeRaw, not $queryRaw: the function returns void, and Prisma cannot
    // deserialize a void column out of a result set.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${k1}::int, ${k2}::int)`;

    /* ---------------------------------------------------------------- L4 */
    const live = await tx.practicePatientLink.findFirst({
      where: {
        practiceProfileId: practice.id,
        patientUserId: userId,
        patientProfileId: subjectProfileId,
        status: { in: [...ACTIVE_LIKE] },
      },
      include: { practicePatientEntry: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    });

    let link;
    let reused = false;
    if (live) {
      // Rule B: the relationship exists and another local record already owns
      // it. Merging two practice records is a decision for the practice, never
      // a side effect of a patient's click.
      if (live.practicePatientEntry) throw new Error("link_already_bound_to_entry");
      // Rule A: reuse, and NEVER change its status. A claim does not promote an
      // invited link to active — only consent does — and it does not demote an
      // active one either.
      link = live;
      reused = true;
    } else {
      // Rules C and D: only terminal links, or none at all. A withdrawn
      // relationship is not resurrected; a new one begins, `invited`.
      link = await tx.practicePatientLink.create({
        data: {
          practiceProfileId: practice.id,
          patientUserId: userId,
          patientProfileId: subjectProfileId,
          status: "invited",
          linkedAt: now,
        },
      });
    }

    await tx.practicePatientEntry.update({
      where: { id: entry.id },
      data: {
        status: "linked",
        linkedAt: now,
        practicePatientLinkId: link.id,
        updatedAt: now,
      },
    });

    // Two events, both inside this transaction: a relationship that exists
    // without a record of how it came about is exactly what an audit is for.
    // No token, no code, no hash, no name, no date of birth, no e-mail.
    const auditBase = {
      req: input.req,
      userId,
      actorRole: "patient",
      practiceProfileId: practice.id,
      patientUserId: userId,
      practicePatientLinkId: link.id,
    };
    await writeRequiredAuditLog({
      ...auditBase,
      action: "practice_patient_invitation_redeemed",
      entityType: "PracticePatientInvitation",
      entityId: invitation.id,
      metadata: {
        credential: manualCodeHash ? "manual_code" : "link_token",
        subjectType: subject.type,
        claimFlowVersion: CLAIM_FLOW_VERSION,
      },
    }, tx);
    await writeRequiredAuditLog({
      ...auditBase,
      action: "practice_patient_entry_linked",
      entityType: "PracticePatientEntry",
      entityId: entry.id,
      metadata: {
        linkReused: reused,
        linkStatus: link.status,
        subjectType: subject.type,
        claimFlowVersion: CLAIM_FLOW_VERSION,
      },
    }, tx);

    return claimResponse(link, practice);
  });
}
