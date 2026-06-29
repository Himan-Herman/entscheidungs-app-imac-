/**
 * Billing plausibility persistence service.
 *
 * Handles creation, listing, and dismissal of BillingPlausibilitySession records.
 * All role checks use the existing getPracticeAccess / hasPracticePermission pattern.
 * No AI. No patient-identifying data stored. Append-only audit trail.
 *
 * IMPORTANT: Sessions represent plausibility HINTS only — not legal billing decisions.
 */

import { PrismaClient } from "@prisma/client";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { hasPracticePermission, PERMISSIONS } from "../../utils/practicePermissions.js";
import { validateGoaeRows } from "./goaeCatalogueService.js";
import { GOAE_CATALOGUE_META } from "../../data/goaeCatalogue.js";

const prisma = new PrismaClient();

/** Current disclaimer semver — bump when the disclaimer text changes. */
const DISCLAIMER_VERSION = "1.0.0";

/** Maximum number of rows accepted per session. */
const MAX_ROWS_PER_SESSION = 30;

/** Maximum number of sessions returned in a list query. */
const MAX_SESSIONS_LIST = 50;

/**
 * @param {string} role
 * @returns {boolean}
 */
function canAccessBilling(role) {
  // Billing-1.1: owner / admin / practice_manager (SETTINGS_MANAGE).
  return hasPracticePermission(role, PERMISSIONS.SETTINGS_MANAGE);
}

/**
 * Serialize a session row for API responses.
 * Excludes internal fields not needed by the client.
 * @param {object} s — Prisma BillingPlausibilitySession row
 * @param {object[]} [items] — optional BillingPlausibilityItem rows
 * @returns {object}
 */
function serializeSession(s, items) {
  const base = {
    id: s.id,
    status: s.status,
    sourceType: s.sourceType,
    rowCount: s.inputSummaryJson?.rowCount ?? 0,
    ziffern: s.inputSummaryJson?.ziffern ?? [],
    resultSummaryJson: s.resultSummaryJson ?? null,
    disclaimerVersion: s.disclaimerVersion,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    dismissedAt: s.dismissedAt ?? null,
  };
  if (items) {
    base.items = items.map((item) => ({
      id: item.id,
      ziffer: item.ziffer,
      factor: item.factor,
      count: item.count,
      catalogueMatchJson: item.catalogueMatchJson,
      warningsJson: item.warningsJson,
    }));
  }
  return base;
}

/**
 * List plausibility sessions for a practice.
 * @param {string} practiceId
 * @param {{ userId: string }} actor
 * @returns {Promise<{ ok: true, sessions: object[] } | { ok: false, error: string }>}
 */
export async function listSessionsForPractice(practiceId, actor) {
  const access = await getPracticeAccess(actor.userId, practiceId);
  if (!access) return { ok: false, error: "practice_not_found" };
  if (!canAccessBilling(access.role)) return { ok: false, error: "forbidden" };

  const rows = await prisma.billingPlausibilitySession.findMany({
    where: { practiceProfileId: practiceId },
    orderBy: { createdAt: "desc" },
    take: MAX_SESSIONS_LIST,
  });

  return { ok: true, sessions: rows.map((r) => serializeSession(r)) };
}

/**
 * Create a new plausibility session with items and audit log entry.
 * Runs inside a transaction to keep session + items + audit atomic.
 * @param {string} practiceId
 * @param {{ userId: string }} actor
 * @param {{ rows: Array<{ ziffer: string, factor: string, count: string | number, contextText?: string }>, context?: string }} payload
 * @returns {Promise<{ ok: true, session: object } | { ok: false, error: string }>}
 */
export async function createSessionForPractice(practiceId, actor, payload) {
  const access = await getPracticeAccess(actor.userId, practiceId);
  if (!access) return { ok: false, error: "practice_not_found" };
  if (!canAccessBilling(access.role)) return { ok: false, error: "forbidden" };

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (rows.length === 0) return { ok: false, error: "rows_required" };
  if (rows.length > MAX_ROWS_PER_SESSION) {
    return { ok: false, error: "too_many_rows" };
  }

  const { rowResults } = validateGoaeRows(rows);

  const inputSummary = {
    rowCount: rows.length,
    ziffern: rows.map((r) => String(r.ziffer ?? "").trim()),
  };

  const resultSummary = {
    catalogueMeta: GOAE_CATALOGUE_META,
    rowResults: rowResults.map((r) => ({
      ziffer: r.ziffer,
      warnings: r.warnings,
      catalogueFound: r.match.found,
      catalogueTitle: r.match.title ?? null,
      // G3b-2: expose catalogue verification quality in summary
      completenessStatus: r.match.completenessStatus ?? null,
      sourceLineOrReference: r.match.sourceLineOrReference ?? null,
    })),
    hasWarnings: rowResults.some((r) => r.warnings.length > 0),
    generatedAt: new Date().toISOString(),
    note: "Deterministic plausibility hints only — no AI, no legal opinion, no reimbursement decision.",
  };

  const auditMeta = {
    rowCount: rows.length,
    ziffern: inputSummary.ziffern,
    hasWarnings: resultSummary.hasWarnings,
  };

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.billingPlausibilitySession.create({
      data: {
        practiceProfileId: practiceId,
        createdByUserId: actor.userId,
        status: "pending",
        sourceType: "manual",
        inputSummaryJson: inputSummary,
        resultSummaryJson: resultSummary,
        disclaimerVersion: DISCLAIMER_VERSION,
      },
    });

    const itemData = rows.map((row, idx) => {
      const result = rowResults[idx];
      return {
        sessionId: created.id,
        ziffer: String(row.ziffer ?? "").trim(),
        factor: String(row.factor ?? "").trim(),
        count: parseInt(String(row.count ?? "1"), 10) || 1,
        contextText: row.contextText ? String(row.contextText).slice(0, 600) : null,
        catalogueMatchJson: result.match,
        warningsJson: result.warnings,
      };
    });

    await tx.billingPlausibilityItem.createMany({ data: itemData });

    await tx.billingPlausibilityAuditLog.create({
      data: {
        sessionId: created.id,
        actorUserId: actor.userId,
        action: "created",
        metadataJson: auditMeta,
      },
    });

    return created;
  });

  const items = await prisma.billingPlausibilityItem.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
  });

  return { ok: true, session: serializeSession(session, items) };
}

/**
 * Dismiss a plausibility session (marks it as archived, non-destructive).
 * @param {string} practiceId
 * @param {string} sessionId
 * @param {{ userId: string }} actor
 * @returns {Promise<{ ok: true, session: object } | { ok: false, error: string }>}
 */
export async function dismissSessionForPractice(practiceId, sessionId, actor) {
  const access = await getPracticeAccess(actor.userId, practiceId);
  if (!access) return { ok: false, error: "practice_not_found" };
  if (!canAccessBilling(access.role)) return { ok: false, error: "forbidden" };

  const existing = await prisma.billingPlausibilitySession.findFirst({
    where: { id: sessionId, practiceProfileId: practiceId },
  });
  if (!existing) return { ok: false, error: "session_not_found" };
  if (existing.status === "dismissed") return { ok: false, error: "already_dismissed" };

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.billingPlausibilitySession.update({
      where: { id: sessionId },
      data: { status: "dismissed", dismissedAt: new Date() },
    });
    await tx.billingPlausibilityAuditLog.create({
      data: {
        sessionId,
        actorUserId: actor.userId,
        action: "dismissed",
        metadataJson: { previousStatus: existing.status },
      },
    });
    return s;
  });

  return { ok: true, session: serializeSession(updated) };
}

/**
 * Get a single session with items (for detail view).
 * @param {string} practiceId
 * @param {string} sessionId
 * @param {{ userId: string }} actor
 * @returns {Promise<{ ok: true, session: object } | { ok: false, error: string }>}
 */
export async function getSessionForPractice(practiceId, sessionId, actor) {
  const access = await getPracticeAccess(actor.userId, practiceId);
  if (!access) return { ok: false, error: "practice_not_found" };
  if (!canAccessBilling(access.role)) return { ok: false, error: "forbidden" };

  const session = await prisma.billingPlausibilitySession.findFirst({
    where: { id: sessionId, practiceProfileId: practiceId },
  });
  if (!session) return { ok: false, error: "session_not_found" };

  const items = await prisma.billingPlausibilityItem.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  return { ok: true, session: serializeSession(session, items) };
}

/**
 * Serialize a billing plausibility session for GDPR account/data export (Phase D3).
 *
 * Privacy-safe whitelist serializer — distinct from serializeSession():
 *  - includes items + audit log (export needs the full record, not the API view)
 *  - EXCLUDES the raw `contextText` value (conservative D3 policy — see below);
 *    a boolean `contextTextPresent` flag is emitted instead for Art. 15 transparency
 *  - includes resultSummaryJson as-is: the billing AI service only ever persists the
 *    validated, truncated, non-binding review there — raw OpenAI prompts/responses
 *    are NEVER stored in the database, so they cannot leak into this export
 *
 * contextText policy: the data-protection doc classifies `contextText` as HIGH RISK
 * (free-text that may, despite UI warnings, contain accidental patient data) and
 * already excludes it from all standard GET API responses. To avoid propagating
 * potentially-accidental personal data into a portable, downloadable JSON file
 * before legal sign-off, the raw value is omitted here. Flipping to full inclusion
 * (for stronger Art. 20 portability) is a one-line change once legal approves.
 *
 * @param {object} s — Prisma BillingPlausibilitySession row with items + auditLog included
 * @returns {object}
 */
function serializeSessionForExport(s) {
  return {
    id: s.id,
    practiceProfileId: s.practiceProfileId,
    createdByUserId: s.createdByUserId,
    status: s.status,
    sourceType: s.sourceType,
    disclaimerVersion: s.disclaimerVersion,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    dismissedAt: s.dismissedAt ?? null,
    inputSummaryJson: s.inputSummaryJson ?? null,
    resultSummaryJson: s.resultSummaryJson ?? null,
    items: (s.items || []).map((item) => ({
      id: item.id,
      ziffer: item.ziffer,
      factor: item.factor,
      count: item.count,
      // Raw contextText intentionally omitted (D3 conservative policy). Presence
      // flag only — see serializeSessionForExport docblock.
      contextTextPresent:
        typeof item.contextText === "string" && item.contextText.trim().length > 0,
      catalogueMatchJson: item.catalogueMatchJson ?? null,
      warningsJson: item.warningsJson ?? null,
      createdAt: item.createdAt,
    })),
    auditLog: (s.auditLog || []).map((a) => ({
      id: a.id,
      action: a.action,
      // actorUserId is in scope: sessions are limited to the exporting user's own
      // records or records owned by practices the user owns.
      actorUserId: a.actorUserId ?? null,
      metadataJson: a.metadataJson ?? null,
      createdAt: a.createdAt,
    })),
  };
}

/**
 * Collect all billing plausibility data belonging to a user for account export (Phase D3).
 *
 * Scope (mirrors the D2 account-deletion scope for symmetry): sessions the user
 * created OR sessions owned by any practice profile the user owns. Practice IDs are
 * resolved here so the helper is self-contained and unit-testable.
 *
 * @param {string} userId
 * @returns {Promise<object[]>} array of export-safe session objects (may be empty)
 */
export async function getBillingPlausibilityExportForUser(userId) {
  if (typeof userId !== "string" || !userId) return [];

  const ownedPractices = await prisma.practiceProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  const ownedPracticeIds = ownedPractices.map((p) => p.id);

  const sessions = await prisma.billingPlausibilitySession.findMany({
    where: {
      OR: [
        { createdByUserId: userId },
        ...(ownedPracticeIds.length
          ? [{ practiceProfileId: { in: ownedPracticeIds } }]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      items: { orderBy: { createdAt: "asc" } },
      auditLog: { orderBy: { createdAt: "asc" } },
    },
  });

  return sessions.map(serializeSessionForExport);
}
