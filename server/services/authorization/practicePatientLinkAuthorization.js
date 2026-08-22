/**
 * Central authorization for patient-scoped practice routes
 * (`/api/practice/patients/:linkId/...`).
 *
 * SECURITY MODEL — the link is the anchor, never the client:
 *
 *   linkId (URL path)
 *     -> load PracticePatientLink server-side
 *     -> derive practiceProfileId FROM THE LINK
 *     -> verify the actor has an ACTIVE practice access (owner or active member)
 *     -> verify role holds the required permission
 *     -> verify link status
 *     -> verify the required patient consent
 *     -> only then may the caller touch medical data
 *
 * A `practiceId` supplied by the client is NEVER used to determine the tenant.
 * It is accepted only for backwards compatibility and must match the practice
 * derived from the link; a mismatch is rejected.
 *
 * Information disclosure: "link does not exist" and "you have no access to this
 * link" return the SAME `link_not_found` result, so a caller cannot probe for
 * the existence of another practice's links.
 */

import { prisma } from "../../lib/prisma.js";
import { getPracticeAccess, accessHasPermission } from "../../utils/practiceAccess.js";
import { linkHasConsentType } from "../consent/consentRecordService.js";
import { logSecurityEvent } from "../security/securityEventService.js";

/** Link states that may still be used for practice access. */
export const LINK_USABLE_STATES = new Set(["invited", "active"]);

/**
 * Denial reasons, mapped to HTTP status codes.
 * `link_not_found` deliberately covers both "missing" and "not yours".
 */
export const DENIAL_STATUS = Object.freeze({
  invalid_request: 400,
  link_not_found: 404,
  forbidden: 403,
  link_inactive: 403,
  consent_required: 403,
});

/**
 * Normalizes a "one or many required things" input to a clean list.
 * `null`, `undefined`, `""` and blank entries all mean "nothing required", so a
 * misspelled or absent option can never silently satisfy a requirement.
 *
 * @param {string | string[] | null | undefined} value
 * @returns {string[]}
 */
export function normalizeRequiredList(value) {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => String(v || "").trim()).filter(Boolean);
}

/**
 * Pure authorization decision — no database, no I/O, fully unit-testable.
 *
 * @param {{
 *   actorUserId?: string | null,
 *   link?: { id: string, practiceProfileId: string, patientUserId: string, status: string } | null,
 *   access?: { role: string, effectivePermissions?: Set<string>, isOwner?: boolean } | null,
 *   requiredPermission?: string | string[] | null,
 *   requiredConsentType?: string | string[] | null,
 *   hasConsent?: boolean,
 *   clientPracticeId?: string | null,
 * }} input
 * @returns {{ ok: true, link: object, practiceProfileId: string, patientUserId: string, role: string }
 *          | { ok: false, reason: keyof typeof DENIAL_STATUS, status: number }}
 */
export function evaluatePracticePatientLinkAccess(input) {
  const deny = (reason) => ({ ok: false, reason, status: DENIAL_STATUS[reason] });

  const actorUserId = String(input?.actorUserId || "").trim();
  if (!actorUserId) return deny("invalid_request");

  const link = input?.link;
  // Missing link and forbidden link are indistinguishable to the caller.
  if (!link || !link.id || !link.practiceProfileId) return deny("link_not_found");

  // The tenant comes from the link. A client-supplied practiceId may only agree.
  const clientPracticeId = String(input?.clientPracticeId || "").trim();
  if (clientPracticeId && clientPracticeId !== link.practiceProfileId) {
    return deny("link_not_found");
  }

  // No active practice access -> same answer as a non-existent link.
  const access = input?.access;
  if (!access || !access.role) return deny("link_not_found");

  // A route may demand several permissions at once (e.g. the AI summary needs
  // both the clinical read right AND the separate processing right). ALL must
  // be held — never any-of.
  //
  // Checked against the EFFECTIVE permissions (owner allowlist ∪ active
  // membership allowlist), so an owner who is also an active doctor is
  // evaluated on both, while ownership alone never yields clinical rights.
  const requiredList = normalizeRequiredList(input?.requiredPermission);
  for (const permission of requiredList) {
    if (!accessHasPermission(access, permission)) {
      return deny("forbidden");
    }
  }

  if (!LINK_USABLE_STATES.has(link.status)) return deny("link_inactive");

  // A route may demand several consents at once (e.g. the AI draft needs the
  // messaging consent AND the separate consent to involve an external AI
  // processor). ALL must be held — never any-of, mirroring the permission rule
  // above. `hasConsent` is the caller's aggregated answer for the whole list.
  if (normalizeRequiredList(input?.requiredConsentType).length > 0 && input?.hasConsent !== true) {
    return deny("consent_required");
  }

  return {
    ok: true,
    link,
    practiceProfileId: link.practiceProfileId,
    patientUserId: link.patientUserId,
    role: access.role,
    // Passed on so a route can ASK about a permission it did not require —
    // e.g. a read route deciding whether to offer a write control. Reporting a
    // permission is not granting one; every write still goes through a guard
    // that demands it.
    access,
  };
}

/**
 * Database-backed authorization for a patient-scoped practice route.
 *
 * @param {{
 *   actorUserId: string,
 *   linkId: string,
 *   requiredPermission?: string | string[] | null,
 *   requiredConsentType?: string | string[] | null,
 *   clientPracticeId?: string | null,
 *   req?: import('express').Request,
 * }} params
 * @returns {Promise<ReturnType<typeof evaluatePracticePatientLinkAccess>>}
 */
export async function authorizePracticePatientLink(params) {
  const actorUserId = String(params?.actorUserId || "").trim();
  const linkId = String(params?.linkId || "").trim();
  if (!actorUserId || !linkId) {
    return { ok: false, reason: "invalid_request", status: DENIAL_STATUS.invalid_request };
  }

  // 1) Load the link WITHOUT any client-supplied tenant filter.
  const link = await prisma.practicePatientLink.findUnique({
    where: { id: linkId },
    include: {
      practiceProfile: {
        select: { id: true, practiceName: true, publicSlug: true, specialty: true },
      },
      patientProfile: {
        select: { id: true, displayName: true, relationLabel: true, userId: true },
      },
    },
  });

  // 2) Practice access is resolved against the practice ON THE LINK.
  const access = link
    ? await getPracticeAccess(actorUserId, link.practiceProfileId)
    : null;

  // 3) Consent is only evaluated once membership stands, to avoid needless writes.
  //    ALL required consents must be held; the first missing one decides.
  const requiredConsents = normalizeRequiredList(params?.requiredConsentType);
  let hasConsent = false;
  if (link && access && requiredConsents.length > 0) {
    hasConsent = true;
    for (const consentType of requiredConsents) {
      if (!(await linkHasConsentType(link, consentType))) {
        hasConsent = false;
        break;
      }
    }
  }

  const decision = evaluatePracticePatientLinkAccess({
    actorUserId,
    link,
    access,
    requiredPermission: params?.requiredPermission ?? null,
    requiredConsentType: params?.requiredConsentType ?? null,
    hasConsent,
    clientPracticeId: params?.clientPracticeId ?? null,
  });

  if (!decision.ok) {
    // Cross-tenant probing and permission failures are security-relevant.
    logSecurityEvent({
      req: params?.req,
      userId: actorUserId,
      actorRole: access?.role || "unknown",
      eventType:
        decision.reason === "consent_required"
          ? "consent_access_denied"
          : "practice_link_access_denied",
      practiceProfileId: link?.practiceProfileId,
      practicePatientLinkId: link?.id,
      metadata: {
        reason: decision.reason,
        requiredPermission: params?.requiredPermission || null,
        requiredConsentType: params?.requiredConsentType || null,
        // Flags a client that sent a practiceId not matching the link.
        practiceIdMismatch: Boolean(
          params?.clientPracticeId &&
            link?.practiceProfileId &&
            String(params.clientPracticeId).trim() !== link.practiceProfileId,
        ),
      },
    });
  }

  return decision;
}

/**
 * Express middleware factory. On success it populates `req.linkAccess` with the
 * authorized link, the server-derived practiceProfileId and the actor role.
 *
 * Both `permission` and `consentType` accept a single value or an array; when an
 * array is given, EVERY entry must be held (never any-of).
 *
 * @param {{ permission?: string | string[] | null, consentType?: string | string[] | null }} [options]
 */
export function requirePracticePatientLinkAccess(options = {}) {
  return async function practicePatientLinkAccessMiddleware(req, res, next) {
    try {
      const decision = await authorizePracticePatientLink({
        actorUserId: req.user?.userId,
        linkId: req.params?.linkId,
        requiredPermission: options.permission ?? null,
        requiredConsentType: options.consentType ?? null,
        // Tolerated for compatibility, but must match the link's practice.
        clientPracticeId: req.query?.practiceId ?? req.body?.practiceId ?? null,
        req,
      });

      if (!decision.ok) {
        return res.status(decision.status).json({ ok: false, error: decision.reason });
      }

      req.linkAccess = {
        link: decision.link,
        // Server-derived: the id of the link that was actually authorized, never
        // the raw path segment. Routes must use this, not req.params.linkId.
        linkId: decision.link.id,
        practiceProfileId: decision.practiceProfileId,
        patientUserId: decision.patientUserId,
        role: decision.role,
        access: decision.access ?? null,
        actorUserId: req.user.userId,
      };
      return next();
    } catch (err) {
      console.error("[practicePatientLinkAuthorization]", err?.message ?? err);
      return res.status(500).json({ ok: false, error: "request_failed" });
    }
  };
}
