/**
 * Practice-issued invitations.
 *
 * An invitation is the temporary proof that lets whoever holds it bind THEIR
 * account to one practice-local entry. It carries no account reference, which is
 * exactly what keeps the practice from ever learning whether an account exists:
 * there is nothing to learn from. Binding happens later, in the claim phase,
 * which is not part of this file.
 *
 * Nothing in here creates a PracticePatientLink.
 */
import { prisma } from "../../lib/prisma.js";
import { writeRequiredAuditLog } from "../auditLogService.js";
import { practiceDisplayName } from "../../utils/practiceBranding.js";
import { INVITABLE_ENTRY_STATUSES } from "./practicePatientEntryService.js";
import {
  MANUAL_CODE_TTL_MINUTES,
  INVITATION_TTL_DAYS,
  canRotateManualCode,
  evaluateInvitationRedeemable,
  evaluateManualCodeUsable,
  generateInvitationToken,
  generateManualCode,
  hashInvitationToken,
  hashManualCode,
  invitationExpiry,
  invitationTokenPrefix,
  manualCodeExpiry,
} from "./invitationTokens.js";

/**
 * Every failure a credential holder can trigger collapses to this one error.
 *
 * Wrong token, expired, already used, revoked, replaced, and pointing at a
 * practice that has been switched off all produce the identical status and the
 * identical body. There is deliberately no distinguishable "this practice is
 * inactive" answer: it would confirm that the credential was genuine, which is
 * exactly the bit worth probing for, and it would say something about a named
 * practice's operational state to someone holding nothing but a string.
 */
const GENERIC_CREDENTIAL_ERROR = "invalid_or_expired_invitation";

/**
 * The complete public face of a practice in an invitation preview.
 *
 * Three fields, and every one of them answers the single question the holder of
 * a link legitimately has: who is inviting me? Name, discipline, place — enough
 * to recognise the practice you were just at, or to realise you were not.
 *
 * WHAT IS ABSENT, AND WHY
 * -----------------------
 * No identifier of any kind. The claim phase derives practice and entry from the
 * invitation server-side, so an id would buy the client nothing while handing an
 * unauthenticated caller a stable key into other APIs.
 *
 * No logo. An external logo URL would make the patient's browser fetch from a
 * third-party server the moment the page renders — an unannounced disclosure of
 * their IP address, user agent and the fact that they are looking at THIS
 * practice's invitation, to a host neither they nor we control. An uploaded logo
 * is not public in the first place: its URL carries the practice id and sits
 * behind requireAuth. A same-origin logo path is a delivery question for the UI
 * phase, not something to improvise into a public contract.
 *
 * No accent colour, no intro text: decoration and free text, not identification.
 *
 * No `expiresAt`. Validity is judged on the server and nowhere else, so the
 * client never needs the date — and publishing it would say something precise
 * about a credential to anyone who merely holds the string.
 *
 * The smaller this contract is, the less there is to withdraw later.
 * [Juristische Prüfung erforderlich] for the exact permitted minimum.
 */
const PUBLIC_PRACTICE_SELECT = {
  practiceName: true,
  displayNameForPatients: true,
  specialty: true,
  city: true,
  isActive: true,
};

/**
 * Optional values stay `null` rather than disappearing, matching the DTOs
 * elsewhere in this codebase: a stable key set means the client never has to
 * distinguish "absent" from "not set".
 *
 * @param {object} row
 */
function publicPracticePreview(row) {
  return {
    displayName: practiceDisplayName(row),
    specialty: row.specialty ? String(row.specialty).trim().slice(0, 160) : null,
    city: row.city ? String(row.city).trim().slice(0, 120) : null,
  };
}

/** Practice-facing shape. Never contains a plaintext credential or a hash. */
export function invitationToJson(row, now = new Date()) {
  const usable = evaluateInvitationRedeemable(row, now).ok;
  const codeUsable = evaluateManualCodeUsable(row, now).ok;
  return {
    id: row.id,
    practicePatientEntryId: row.practicePatientEntryId,
    status: row.status,
    // Derived, never stored: the row stays `pending` after its date passes.
    isExpired: row.status === "pending" && !usable,
    isUsable: usable,
    expiresAt: row.expiresAt,
    tokenPrefix: row.tokenPrefix,
    hasManualCode: Boolean(row.manualCodeHash),
    manualCodeExpiresAt: row.manualCodeExpiresAt,
    manualCodeUsable: codeUsable,
    redeemedAt: row.redeemedAt,
    revokedAt: row.revokedAt,
    supersededAt: row.supersededAt,
    createdAt: row.createdAt,
  };
}

/**
 * Issue an invitation for an entry. This is ALSO the resend/regenerate path:
 * "create the first one" and "replace the current one" are the same operation,
 * and giving them two implementations would be two chances to forget the
 * supersede.
 *
 * One transaction:
 *   1. resolve the entry, scoped to the authorized practice
 *   2. supersede EVERY pending invitation of that entry — expired ones included
 *   3. create the new one
 *   4. move a draft entry to invited
 *   5. audit
 *
 * Step 2 is not tidiness. Because expiry is derived, an expired invitation stays
 * technically `pending` and keeps occupying the partial unique index; without
 * superseding it first, "send again" would fail forever on precisely the entries
 * that need it most.
 *
 * Under concurrency the database has the last word: two simultaneous calls both
 * reach step 3, and the partial unique index rejects the loser. The caller sees
 * a conflict, never two live invitations.
 *
 * @param {{ entryId: string, practiceProfileId: string, createdByUserId?: string|null,
 *           req?: import('express').Request }} input
 * @returns {Promise<{ invitation: object, token: string, expiresAt: Date, supersededCount: number }>}
 */
export async function createInvitationForEntry(input) {
  const entryId = String(input.entryId || "").trim();
  const practiceProfileId = String(input.practiceProfileId || "").trim();
  if (!entryId || !practiceProfileId) throw new Error("validation_required");

  const practice = await prisma.practiceProfile.findUnique({
    where: { id: practiceProfileId },
    select: { id: true, isActive: true },
  });
  if (!practice) throw new Error("practice_not_found");
  // An invitation issued by a switched-off practice would resolve to a practice
  // the preview then refuses to show. Refuse at the source instead.
  if (!practice.isActive) throw new Error("practice_inactive");

  const rawToken = generateInvitationToken();
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.practicePatientEntry.findFirst({
      where: { id: entryId, practiceProfileId },
    });
    if (!entry) throw new Error("entry_not_found");
    if (entry.status === "archived") throw new Error("entry_archived");
    if (!INVITABLE_ENTRY_STATUSES.has(entry.status)) {
      // Already linked: the relationship exists, a second invitation would be
      // an invitation to something that has already happened.
      throw new Error("entry_not_invitable");
    }

    const superseded = await tx.practicePatientInvitation.updateMany({
      where: { practicePatientEntryId: entryId, status: "pending" },
      data: { status: "superseded", supersededAt: now, updatedAt: now },
    });

    const created = await tx.practicePatientInvitation.create({
      data: {
        practicePatientEntryId: entryId,
        practiceProfileId,
        tokenHash: hashInvitationToken(rawToken),
        tokenPrefix: invitationTokenPrefix(rawToken),
        status: "pending",
        expiresAt: invitationExpiry(now),
        // `deliveryChannel` is left NULL on purpose. Nothing in this phase
        // delivers anything — no e-mail is sent, no message leaves the server —
        // and a stored "email" would read, to anyone auditing later, as a record
        // that a delivery took place. The column exists for the phase that
        // actually sends something; until then it stays empty rather than
        // carrying an intention that no event backs up.
        createdByUserId: input.createdByUserId ?? null,
      },
    });

    if (entry.status === "draft") {
      await tx.practicePatientEntry.update({
        where: { id: entryId },
        data: { status: "invited", updatedAt: now },
      });
    }

    // Superseding is its own event, not a footnote on the creation. It is the
    // moment previously handed-out credentials stopped working, and somebody
    // reconstructing "why did the link I was given stop opening" needs to find
    // that as a fact of its own — including when it happened silently, because
    // the practice only clicked "send again".
    if (superseded.count > 0) {
      await writeRequiredAuditLog(
        {
          req: input.req,
          userId: input.createdByUserId ?? null,
          actorRole: "practice",
          action: "practice_patient_invitation_superseded",
          entityType: "PracticePatientEntry",
          entityId: entryId,
          practiceProfileId,
          metadata: {
            supersededCount: superseded.count,
            replacedByInvitationId: created.id,
          },
        },
        tx,
      );
    }

    // No token, no hash, no prefix, no personal data. Only that it happened and
    // how many predecessors it replaced.
    await writeRequiredAuditLog(
      {
        req: input.req,
        userId: input.createdByUserId ?? null,
        actorRole: "practice",
        action: "practice_patient_invitation_created",
        entityType: "PracticePatientInvitation",
        entityId: created.id,
        practiceProfileId,
        metadata: {
          practicePatientEntryId: entryId,
          supersededCount: superseded.count,
          ttlDays: INVITATION_TTL_DAYS,
        },
      },
      tx,
    );

    return { created, supersededCount: superseded.count };
  });

  // The plaintext exists only here, only once. It is never persisted, never
  // logged and never put in an audit row.
  return {
    invitation: invitationToJson(result.created, now),
    token: rawToken,
    expiresAt: result.created.expiresAt,
    supersededCount: result.supersededCount,
  };
}

/**
 * Withdraw a pending invitation.
 *
 * Revoking also ends any manual code on it, without touching a second column:
 * every credential check demands `status = 'pending'` first, so one state change
 * closes both doors.
 *
 * @param {{ invitationId: string, practiceProfileId: string, actorUserId?: string|null, req?: import('express').Request }} input
 */
export async function revokeInvitation(input) {
  const id = String(input.invitationId || "").trim();
  const practiceProfileId = String(input.practiceProfileId || "").trim();
  if (!id || !practiceProfileId) throw new Error("validation_required");

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.practicePatientInvitation.findFirst({
      where: { id, practiceProfileId },
    });
    if (!existing) throw new Error("invitation_not_found");

    // Already revoked is not an error. The practice asked for it to be gone and
    // it is gone; making the second click fail would only invite a retry loop.
    // Any OTHER terminal state is a real conflict, because "revoke" would be
    // claiming something that did not happen.
    if (existing.status === "revoked") {
      return { invitation: invitationToJson(existing, now), alreadyRevoked: true };
    }
    if (existing.status !== "pending") throw new Error("invitation_not_pending");

    const row = await tx.practicePatientInvitation.update({
      where: { id },
      data: {
        status: "revoked",
        revokedAt: now,
        revokedByUserId: input.actorUserId ?? null,
        updatedAt: now,
      },
    });

    await writeRequiredAuditLog(
      {
        req: input.req,
        userId: input.actorUserId ?? null,
        actorRole: "practice",
        action: "practice_patient_invitation_revoked",
        entityType: "PracticePatientInvitation",
        entityId: id,
        practiceProfileId,
        metadata: {
          practicePatientEntryId: existing.practicePatientEntryId,
          hadManualCode: Boolean(existing.manualCodeHash),
        },
      },
      tx,
    );

    return { invitation: invitationToJson(row, now), alreadyRevoked: false };
  });
}

/**
 * Issue a fresh on-site code on an EXISTING invitation.
 *
 * This does not create an invitation, does not supersede anything, and does not
 * move `expiresAt`. It overwrites `manualCodeHash`, and that overwrite is what
 * kills the previous code — the old hash simply stops existing, so the old code
 * can no longer match a row.
 *
 * The update is conditional on the invitation still being live, so a rotation
 * racing a revoke or a supersede loses cleanly instead of reviving a dead
 * invitation.
 *
 * @param {{ invitationId: string, practiceProfileId: string, actorUserId?: string|null, req?: import('express').Request }} input
 * @returns {Promise<{ invitation: object, manualCode: string, manualCodeExpiresAt: Date }>}
 */
export async function rotateManualCode(input) {
  const id = String(input.invitationId || "").trim();
  const practiceProfileId = String(input.practiceProfileId || "").trim();
  if (!id || !practiceProfileId) throw new Error("validation_required");

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.practicePatientInvitation.findFirst({
      where: { id, practiceProfileId },
    });
    if (!existing) throw new Error("invitation_not_found");

    const verdict = canRotateManualCode(existing, now);
    if (!verdict.ok) throw new Error("invitation_not_pending");

    // Retry on the astronomically unlikely hash collision, mirroring the
    // existing connect-code service rather than inventing a new approach.
    let rawCode = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateManualCode();
      const clash = await tx.practicePatientInvitation.findUnique({
        where: { manualCodeHash: hashManualCode(candidate) },
        select: { id: true },
      });
      if (!clash) { rawCode = candidate; break; }
    }
    if (!rawCode) throw new Error("request_failed");

    const updated = await tx.practicePatientInvitation.updateMany({
      where: { id, status: "pending", expiresAt: { gt: now } },
      data: {
        manualCodeHash: hashManualCode(rawCode),
        manualCodeExpiresAt: manualCodeExpiry(now),
        updatedAt: now,
      },
    });
    // Lost a race against revoke or supersede between the read and the write.
    if (updated.count !== 1) throw new Error("invitation_not_pending");

    const row = await tx.practicePatientInvitation.findUnique({ where: { id } });

    await writeRequiredAuditLog(
      {
        req: input.req,
        userId: input.actorUserId ?? null,
        actorRole: "practice",
        action: "practice_patient_invitation_manual_code_rotated",
        entityType: "PracticePatientInvitation",
        entityId: id,
        practiceProfileId,
        metadata: {
          practicePatientEntryId: existing.practicePatientEntryId,
          replacedPreviousCode: Boolean(existing.manualCodeHash),
          ttlMinutes: MANUAL_CODE_TTL_MINUTES,
        },
      },
      tx,
    );

    return { row, rawCode };
  });

  return {
    invitation: invitationToJson(result.row, now),
    manualCode: result.rawCode,
    manualCodeExpiresAt: result.row.manualCodeExpiresAt,
  };
}

/**
 * Invitations of one entry, newest first. Practice-scoped.
 * @param {string} entryId
 * @param {string} practiceProfileId
 */
export async function listInvitationsForEntry(entryId, practiceProfileId) {
  const id = String(entryId || "").trim();
  const pid = String(practiceProfileId || "").trim();
  if (!id || !pid) throw new Error("validation_required");

  const entry = await prisma.practicePatientEntry.findFirst({
    where: { id, practiceProfileId: pid },
    select: { id: true },
  });
  if (!entry) throw new Error("entry_not_found");

  const rows = await prisma.practicePatientInvitation.findMany({
    where: { practicePatientEntryId: id, practiceProfileId: pid },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const now = new Date();
  return { invitations: rows.map((r) => invitationToJson(r, now)) };
}

/**
 * Resolve a link token for the public preview page.
 *
 * READ ONLY. This function writes nothing — no status flip, no "seen" marker, no
 * counter. Expiry is decided by comparing dates, never by updating a row, so the
 * preview cannot mutate anything even indirectly.
 *
 * The token arrives in a request BODY, never in a path or a query string. It is
 * a real claim credential in the phase after this one, and a path parameter ends
 * up in access logs, proxy logs, browser history, Referer headers and tracing
 * spans — five copies nobody is guarding.
 *
 * What comes back is only the practice, and only its public face. No patient
 * name, no date of birth, no e-mail, no local record number, nothing medical, no
 * identifier of any kind, and no hint about whether an account exists. Whoever
 * holds the link learns who is inviting them and nothing about the person being
 * invited.
 *
 * An unusable credential and an inactive practice are the SAME answer.
 *
 * @param {string} rawToken
 * @returns {Promise<{ practice: object }>}
 */
export async function previewInvitationByToken(rawToken) {
  const token = String(rawToken || "").trim();
  if (!token) throw new Error(GENERIC_CREDENTIAL_ERROR);

  const row = await prisma.practicePatientInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      status: true,
      expiresAt: true,
      practiceProfile: { select: PUBLIC_PRACTICE_SELECT },
    },
  });

  const now = new Date();
  if (!evaluateInvitationRedeemable(row, now).ok) throw new Error(GENERIC_CREDENTIAL_ERROR);
  // Folded into the generic answer on purpose: distinguishing it would confirm
  // the credential is real and would disclose a practice's operational state.
  if (!row.practiceProfile?.isActive) throw new Error(GENERIC_CREDENTIAL_ERROR);

  // The expiry decided this call and is not reported: the server judges validity,
  // the client only learns that it was granted.
  return { practice: publicPracticePreview(row.practiceProfile) };
}

/**
 * Resolve a typed on-site code.
 *
 * Also strictly read-only, and also not a redeem: it answers "is this code good
 * right now" so the claim phase has something to build on. Both clocks are
 * checked — the invitation's seven days AND the code's own sixty minutes.
 *
 * @param {string} rawCode
 * @returns {Promise<{ practice: object }>}
 */
export async function previewInvitationByManualCode(rawCode) {
  const code = String(rawCode || "").trim();
  if (!code) throw new Error(GENERIC_CREDENTIAL_ERROR);

  const row = await prisma.practicePatientInvitation.findUnique({
    where: { manualCodeHash: hashManualCode(code) },
    select: {
      status: true, expiresAt: true,
      manualCodeHash: true, manualCodeExpiresAt: true,
      practiceProfile: { select: PUBLIC_PRACTICE_SELECT },
    },
  });

  const now = new Date();
  if (!evaluateManualCodeUsable(row, now).ok) throw new Error(GENERIC_CREDENTIAL_ERROR);
  if (!row.practiceProfile?.isActive) throw new Error(GENERIC_CREDENTIAL_ERROR);

  // Neither clock is reported. Both were checked here, which is the only place
  // either of them means anything.
  return { practice: publicPracticePreview(row.practiceProfile) };
}

export { GENERIC_CREDENTIAL_ERROR };
