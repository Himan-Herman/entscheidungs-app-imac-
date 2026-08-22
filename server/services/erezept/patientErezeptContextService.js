/**
 * Patient e-prescriptions inside ONE care relationship (Phase 2F.1).
 *
 * SCOPE
 * -----
 * `ErezeptEntry.linkId` is a plain NOT NULL string with NO foreign key on
 * `PracticePatientLink`. Everything here is written as if that string could be
 * anything, because as far as the database is concerned it can:
 *
 *   - the link is resolved first, from the session user's own relationships,
 *   - the entry is then matched on `linkId = <that link's id>` inside the
 *     query, so a value that names nothing simply matches nothing,
 *   - `patientUserId` is asserted as well, so an entry whose link and patient
 *     disagree stays unreadable from either side.
 *
 * A string that is not a real link id therefore cannot surface anywhere, and it
 * is never interpreted as a practice id or anything else. See
 * scripts/checkErezeptLinkIntegrity.js for the data-side preflight.
 *
 * This deliberately does NOT reuse the cross-practice patient list, which is
 * scoped by `patientUserId` alone and spans every practice.
 */
import { prisma } from "../../lib/prisma.js";

/** What a patient may set. Unchanged from the cross-practice route. */
export const PATIENT_ALLOWED_STATUSES = new Set(["at_pharmacy", "redeemed"]);

/** Statuses nothing may move away from. Unchanged from the cross-practice route. */
const FINAL_STATUSES = new Set(["redeemed", "expired", "cancelled"]);

/**
 * The link, only if it belongs to the session patient.
 *
 * A missing link and someone else's link both raise `link_not_found`, so
 * neither can be used to probe what exists.
 */
async function assertPatientOwnsLink(linkId, patientUserId) {
  const lid = String(linkId || "").trim();
  const uid = String(patientUserId || "").trim();
  if (!lid || !uid) throw new Error("validation_required");

  const link = await prisma.practicePatientLink.findFirst({
    where: { id: lid, patientUserId: uid },
    select: { id: true, patientUserId: true, practiceProfileId: true, status: true },
  });
  if (!link) throw new Error("link_not_found");
  return link;
}

/**
 * The one scope clause. Both conditions are load-bearing and fail
 * independently: the link says which relationship, the patient says whose.
 */
function contextWhere(link) {
  return { linkId: link.id, patientUserId: link.patientUserId, deletedAt: null };
}

/** Nothing internal travels: no linkId, no issuer, no deletedAt. */
function toJson(r) {
  return {
    id: r.id,
    medicationName: r.medicationName,
    icdCode: r.icdCode,
    dosage: r.dosage,
    instructions: r.instructions,
    tokenCode: r.tokenCode,
    status: r.status,
    issuedAt: r.issuedAt,
    validUntil: r.validUntil,
    redeemedAt: r.redeemedAt,
    notes: r.notes,
    createdAt: r.createdAt,
  };
}

/**
 * Prescriptions of ONE care relationship.
 *
 * The cross-practice list expires stale prescriptions as a side effect of
 * reading. That behaviour is kept — a prescription past its validity must not
 * keep looking live — but confined to this context: a page about one practice
 * has no business writing to another practice's rows.
 *
 * Two queries, whatever the number of entries: one for the link, one for the
 * rows. The expiry update only runs when something actually expired, and it is
 * itself scoped.
 */
export async function listPatientLinkErezept(linkId, patientUserId) {
  const link = await assertPatientOwnsLink(linkId, patientUserId);

  const rows = await prisma.erezeptEntry.findMany({
    where: contextWhere(link),
    orderBy: { issuedAt: "desc" },
  });

  const now = new Date();
  const expired = rows.filter((e) => e.status === "issued" && new Date(e.validUntil) < now);
  if (expired.length > 0) {
    await prisma.erezeptEntry
      .updateMany({
        // Scoped again rather than by id alone: the ids came from a scoped read,
        // but a write must not depend on the caller of a previous query.
        where: { ...contextWhere(link), id: { in: expired.map((e) => e.id) }, status: "issued" },
        data: { status: "expired" },
      })
      .catch(() => {});
    for (const e of expired) e.status = "expired";
  }

  return rows.map(toJson);
}

/**
 * One prescription, but only if it lives in THIS context.
 *
 * The scope is part of the query rather than a comparison on a row already
 * fetched by id: `findUnique({ id })` followed by a check would still have read
 * the foreign row, and the check is what a later refactor drops.
 */
export async function getPatientLinkErezept(linkId, entryId, patientUserId) {
  const link = await assertPatientOwnsLink(linkId, patientUserId);
  const eid = String(entryId || "").trim();
  if (!eid) throw new Error("validation_required");

  const row = await prisma.erezeptEntry.findFirst({
    where: { id: eid, ...contextWhere(link) },
  });
  if (!row) throw new Error("entry_not_found");
  return { link, row, json: toJson(row) };
}

/**
 * The patient marks a prescription as taken to the pharmacy or redeemed.
 *
 * Exactly the right the cross-practice page already grants — same two target
 * statuses, same rule that final states do not move. Nothing is widened; only
 * the scope narrows.
 */
export async function updatePatientLinkErezeptStatus(linkId, entryId, patientUserId, status) {
  const next = String(status || "").trim();
  if (!PATIENT_ALLOWED_STATUSES.has(next)) throw new Error("invalid_status");

  const { link, row } = await getPatientLinkErezept(linkId, entryId, patientUserId);
  if (FINAL_STATUSES.has(row.status)) throw new Error("already_final");

  const updated = await prisma.erezeptEntry.update({
    // Safe to address by id here: the row was resolved through the context
    // above, and its id is not caller-supplied at this point.
    where: { id: row.id },
    data: {
      status: next,
      redeemedAt: next === "redeemed" ? new Date() : row.redeemedAt,
    },
  });

  return { link, json: toJson(updated) };
}
