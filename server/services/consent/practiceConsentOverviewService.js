import { prisma } from "../../lib/prisma.js";


const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Derive the effective status without writing to the DB.
 * A "granted" consent whose expiry has passed is reported as "expired".
 * @param {{ status: string, expiresAt: Date | null }} row
 * @param {number} now epoch ms
 * @returns {"granted" | "revoked" | "expired"}
 */
function effectiveStatus(row, now) {
  if (
    row.status === "granted" &&
    row.expiresAt &&
    new Date(row.expiresAt).getTime() <= now
  ) {
    return "expired";
  }
  return row.status;
}

/**
 * Practice-side consent overview — minimal, read-only, organizational metadata only.
 *
 * Returns ONLY non-medical consent metadata. No patient free-text, no medical
 * content, no metadataJson, no IP/device/source, no patientUserId. The practice
 * relationship is referenced via practicePatientLinkId only (already used across
 * the practice UI), never via raw patient identity.
 *
 * @param {string} practiceProfileId
 * @param {{ limit?: number, offset?: number }} opts
 */
export async function listPracticeConsentOverview(practiceProfileId, opts = {}) {
  const pid = String(practiceProfileId || "").trim();
  if (!pid) throw new Error("practiceId_required");

  const limit = Math.min(
    Math.max(Number.isFinite(opts.limit) ? Number(opts.limit) : DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(Number.isFinite(opts.offset) ? Number(opts.offset) : 0, 0);

  const where = { practiceProfileId: pid };

  const [total, rows] = await Promise.all([
    prisma.consentRecord.count({ where }),
    prisma.consentRecord.findMany({
      where,
      // Explicit minimal selection — no includes, no medical content.
      select: {
        id: true,
        consentType: true,
        status: true,
        grantedAt: true,
        revokedAt: true,
        expiresAt: true,
        version: true,
        practicePatientLinkId: true,
      },
      orderBy: [{ grantedAt: "desc" }, { id: "asc" }],
      take: limit,
      skip: offset,
    }),
  ]);

  const now = Date.now();
  const items = rows.map((r) => ({
    id: r.id,
    consentType: r.consentType,
    status: effectiveStatus(r, now),
    grantedAt: r.grantedAt,
    revokedAt: r.revokedAt,
    expiresAt: r.expiresAt,
    version: r.version,
    practicePatientLinkId: r.practicePatientLinkId,
  }));

  return { items, total, limit, offset };
}
