/**
 * Patient-generated practice connection code (Phase 1 — backend).
 *
 * Flow: a patient deliberately generates a short-lived, single-use code with the
 * consent scopes they choose. A practice redeems the code, which creates (or reuses)
 * a PracticePatientLink and applies exactly those scopes as active consent. The
 * practice can NEVER link a patient without this deliberate patient action.
 *
 * Security: plaintext code shown to the patient ONCE (only the SHA-256 hash is
 * stored); short TTL; single use; revocable; generic redemption errors (no
 * enumeration); the practice may only act for its own practiceProfileId; consent
 * scopes come solely from the code (no auto-grant of everything). Organizational
 * only — no clinical content.
 */
import { PrismaClient } from "@prisma/client";
import {
  generateConnectCode,
  hashConnectCode,
  connectCodePrefix,
  connectCodeExpiry,
  evaluateConnectCodeRedeemable,
  CONNECT_CODE_TTL_MINUTES,
} from "../../utils/connectCodeTokens.js";
import { CARE_CONSENT_VERSION, normalizeConsentScopes } from "./consentScopes.js";
import {
  createPracticePatientLink,
  acceptPracticePatientLinkConsent,
} from "./practicePatientLinkService.js";

const prisma = new PrismaClient();

/** A link is reusable for a fresh code if it is still in an active-like state. */
const REUSABLE_LINK_STATUSES = ["invited", "active"];

/** Public-safe metadata for a code — never exposes the plaintext or the hash. */
function codeMetaJson(row) {
  return {
    id: row.id,
    status: row.status,
    tokenPrefix: row.tokenPrefix,
    consentScopes: Array.isArray(row.consentScopesJson) ? row.consentScopesJson : [],
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    usedAt: row.usedAt ?? null,
  };
}

/**
 * Generate a fresh connect code for a patient. Any prior still-active code for the
 * same patient is revoked first (one active code at a time). The plaintext `code`
 * is returned ONCE — only its hash is persisted.
 * @param {{ patientUserId: string, scopes: unknown }} input
 */
export async function createConnectCode({ patientUserId, scopes }) {
  const uid = String(patientUserId || "").trim();
  if (!uid) throw new Error("validation_required");

  const normScopes = normalizeConsentScopes(scopes);
  if (normScopes.length === 0) throw new Error("validation_consent_scopes_required");

  const now = new Date();

  // One active code at a time: supersede any prior active code.
  await prisma.patientPracticeConnectCode.updateMany({
    where: { patientUserId: uid, status: "active" },
    data: { status: "revoked", revokedAt: now },
  });

  // Generate a unique code (retry on the astronomically unlikely hash collision).
  let raw = null;
  let tokenHash = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateConnectCode();
    const candidateHash = hashConnectCode(candidate);
    const clash = await prisma.patientPracticeConnectCode.findUnique({
      where: { tokenHash: candidateHash },
    });
    if (!clash) {
      raw = candidate;
      tokenHash = candidateHash;
      break;
    }
  }
  if (!raw) throw new Error("request_failed");

  const row = await prisma.patientPracticeConnectCode.create({
    data: {
      patientUserId: uid,
      tokenHash,
      tokenPrefix: connectCodePrefix(raw),
      consentScopesJson: normScopes,
      status: "active",
      expiresAt: connectCodeExpiry(now),
    },
  });

  return { code: raw, ttlMinutes: CONNECT_CODE_TTL_MINUTES, ...codeMetaJson(row) };
}

/**
 * Return metadata for the patient's current active, unexpired code (or null).
 * Never returns the plaintext code or its hash.
 * @param {string} patientUserId
 */
export async function getActiveConnectCode(patientUserId) {
  const uid = String(patientUserId || "").trim();
  if (!uid) throw new Error("validation_required");

  const row = await prisma.patientPracticeConnectCode.findFirst({
    where: { patientUserId: uid, status: "active", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return row ? codeMetaJson(row) : null;
}

/**
 * Revoke an active code that belongs to the patient.
 * @param {{ patientUserId: string, codeId: string }} input
 */
export async function revokeConnectCode({ patientUserId, codeId }) {
  const uid = String(patientUserId || "").trim();
  const id = String(codeId || "").trim();
  if (!uid || !id) throw new Error("validation_required");

  const existing = await prisma.patientPracticeConnectCode.findFirst({
    where: { id, patientUserId: uid },
  });
  if (!existing) throw new Error("connect_code_not_found");
  if (existing.status !== "active") throw new Error("connect_code_not_active");

  const row = await prisma.patientPracticeConnectCode.update({
    where: { id },
    data: { status: "revoked", revokedAt: new Date() },
  });
  return codeMetaJson(row);
}

/**
 * Redeem a code on behalf of a practice. Creates or reuses the PracticePatientLink
 * and applies the patient-chosen consent scopes (active consent). The code is then
 * marked used (single use). All non-redeemable cases throw a single generic error.
 * @param {{ practiceProfileId: string, code: string }} input
 */
export async function redeemConnectCode({ practiceProfileId, code }) {
  const practiceId = String(practiceProfileId || "").trim();
  const raw = String(code || "").trim();
  if (!practiceId || !raw) throw new Error("validation_required");

  const tokenHash = hashConnectCode(raw);
  const row = await prisma.patientPracticeConnectCode.findUnique({ where: { tokenHash } });

  const now = new Date();
  const verdict = evaluateConnectCodeRedeemable(row, now);
  if (!verdict.ok) {
    // Lazily flip a genuinely-expired (but still 'active') row to 'expired'.
    if (row && row.status === "active" && verdict.reason === "expired") {
      await prisma.patientPracticeConnectCode
        .update({ where: { id: row.id }, data: { status: "expired" } })
        .catch(() => {});
    }
    // Generic error — a practice cannot tell wrong / expired / used / revoked apart.
    throw new Error("invalid_or_expired_code");
  }

  const patientUserId = row.patientUserId;
  const scopes = normalizeConsentScopes(row.consentScopesJson);

  // Create a fresh link (status 'invited') or reuse an existing active-like link.
  let linkId;
  try {
    const created = await createPracticePatientLink({
      practiceProfileId: practiceId,
      patientUserId,
      status: "invited",
    });
    linkId = created.id;
  } catch (err) {
    if (err?.message !== "link_already_exists") throw err;
    const existing = await prisma.practicePatientLink.findFirst({
      where: {
        practiceProfileId: practiceId,
        patientUserId,
        status: { in: REUSABLE_LINK_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!existing) throw err;
    linkId = existing.id;
  }

  // Apply the patient's consent (scopes + version), flipping the link to active and
  // granting the matching ConsentRecord rows. patientUserId is taken from the trusted
  // code row, so the practice cannot consent on behalf of a different patient.
  const link = await acceptPracticePatientLinkConsent({
    linkId,
    patientUserId,
    scopes,
    consentVersion: CARE_CONSENT_VERSION,
  });

  // Single use: mark the code consumed.
  await prisma.patientPracticeConnectCode.update({
    where: { id: row.id },
    data: { status: "used", usedAt: now, usedByPracticeProfileId: practiceId },
  });

  return { link, consentScopes: scopes };
}
