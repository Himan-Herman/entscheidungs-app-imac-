/**
 * What a patient may still do with a care relationship, and what they may not.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE RULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   PracticePatientLink.status === "revoked"
 *
 *     means:      the active treatment and communication relationship has ended
 *     NOT:        the patient's own history disappears
 *
 *   So, for the patient, on their OWN link:
 *
 *     historical READ            allowed
 *     new WRITE / interaction    denied
 *
 * ── Why it is drawn here and not at the door ────────────────────────────────
 * Ownership and permission are two different questions, and this helper answers
 * only the first: is this care relationship yours? A revoked relationship is
 * still yours. What has ended is the right to act inside it.
 *
 * Reading it the other way — refusing everything the moment a link is revoked —
 * would take a patient's own correspondence, their own prescriptions and their
 * own reports away from them as a consequence of exercising a choice. That is
 * the wrong direction: withdrawing a grant given to a practice is not a request
 * to be locked out of one's own record. Access and retention are separate
 * questions, and this is the access one.
 *
 * ── What "historical" does and does not mean ────────────────────────────────
 * It means: artefacts of THIS link that were already visible to this patient
 * before the revocation. It does NOT mean "once visible, visible forever".
 *
 * A resource that carries its own access control keeps it, and that control
 * wins. A PracticeDocumentShareGrant that has been revoked still refuses; a
 * SecureDocumentAccessToken that has expired still refuses. The rule in this
 * file must never be used to reach around a resource-level withdrawal — it
 * governs the relationship, not the individual artefact.
 *
 * ── What the link id still fences off ───────────────────────────────────────
 * Everything. `revoked` relaxes nothing about scope:
 *
 *     A1 revoked  ->  still cannot see A2, the same practice's other link
 *     A1 revoked  ->  still cannot see practice B
 *
 * The exact PracticePatientLink.id remains the boundary, before and after.
 *
 * ── Where the write side lives ──────────────────────────────────────────────
 * Not here. Refusing a new interaction is each feature's own job, because each
 * one knows what counts as acting: sending a message, issuing a share, joining
 * a session. Several already do it through consent — `linkHasConsentType`
 * returns false for a link that is not in a usable state, which closes writing
 * without touching reading. A feature with a stricter rule of its own keeps it;
 * nothing here loosens anything.
 *
 * The tests that hold this in place are in verifySameLinkHttpMatrix.test.js,
 * one read case and one write case per domain.
 */
import { prisma } from "../../lib/prisma.js";

/** Link states in which a patient may still ACT inside the relationship. */
export const ACTIVE_LINK_STATUSES = Object.freeze(new Set(["invited", "active"]));

/**
 * The care relationship, if it belongs to this patient.
 *
 * Answers ownership only — see the rule above. A revoked link is returned like
 * any other, with its `status`, so a caller that needs to refuse an ACTION can
 * ask; a caller reading history does not have to.
 *
 * A link belonging to somebody else is reported exactly like one that does not
 * exist, so the error cannot be used to probe whose it is.
 *
 * @param {string} linkId
 * @param {string} patientUserId
 * @returns {Promise<{ id: string, patientUserId: string, practiceProfileId: string, status: string }>}
 * @throws {Error} `validation_required` | `link_not_found`
 */
export async function assertPatientOwnsLink(linkId, patientUserId) {
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
 * True when the patient may still act inside this relationship.
 *
 * Reading does not consult this. It exists so that a feature refusing a WRITE
 * can say why in the same words everywhere, rather than each one inventing its
 * own notion of "still active".
 *
 * @param {{ status: string }} link
 */
export function linkAllowsNewInteraction(link) {
  return ACTIVE_LINK_STATUSES.has(String(link?.status ?? ""));
}

/**
 * Refuses a new interaction inside a relationship that has ended.
 *
 * Deliberately NOT called from `assertPatientOwnsLink`: a read must not pay for
 * a write's rule. A caller that is about to change something calls this; one
 * that is showing history does not.
 *
 * @param {{ status: string }} link
 * @throws {Error} `link_not_active`
 */
export function assertLinkAllowsNewInteraction(link) {
  if (!linkAllowsNewInteraction(link)) throw new Error("link_not_active");
  return link;
}
