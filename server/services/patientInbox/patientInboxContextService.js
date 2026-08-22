/**
 * Patient inbox inside ONE care relationship (Phase 2G.1).
 *
 * WHAT AN INBOX ITEM IS
 * ---------------------
 * `PatientInboxItem` is a PERSISTED notice, not a view over other tables. Every
 * producer writes a neutral title and, at most, a neutral summary — never a
 * message body, a diagnosis, a dosage or a document's contents. That property
 * is preserved here rather than re-derived.
 *
 * SCOPE
 * -----
 * `practicePatientLinkId` is nullable. Items that carry it belong to exactly
 * one care relationship; items that carry only `practiceProfileId` belong to a
 * practice but to no determinable relationship — an appointment or a data
 * request created outside a link, for instance. Those are NOT forced into a
 * context: a notice about the wrong relationship is worse than one the patient
 * has to find in the cross-practice list.
 *
 * So the scope is the link and nothing else:
 *
 *     practicePatientLinkId = link.id  AND  patientUserId = link.patientUserId
 *
 * Both conditions are load-bearing and fail independently.
 */
import { prisma } from "../../lib/prisma.js";
import { writeAuditLog } from "../auditLogService.js";

/** Mirrors the cross-practice list: archived items are hidden unless asked for. */
const STATUSES = new Set(["unread", "read", "archived"]);

/**
 * Where an item leads, inside THIS context.
 *
 * Deliberately NOT the stored `targetUrl`. Those were written before practice
 * contexts existed and are patient-global paths with no link in them — one of
 * them (`/patient/medication-plans/<id>`) does not even match a route any more.
 * Rebuilding the destination from the item's own relationship is the only way a
 * notice cannot send the patient into a different practice's context.
 *
 * An item whose kind has no scoped page yields null; the client then shows it
 * without a link rather than inventing a destination.
 *
 * @param {string} linkId the AUTHORIZED link — never the item's stored value
 * @param {{ sourceRefType: string | null }} row
 */
function scopedTargetPath(linkId, row) {
  const base = `/patient/practice/${encodeURIComponent(linkId)}`;
  switch (row.sourceRefType) {
    case "patient_thread":
      return `${base}/messages`;
    case "appointment":
    case "appointment_reminder":
      return `${base}/appointments`;
    case "practice_document":
      return `${base}/documents`;
    case "medication_plan":
      return `${base}/medication-plans`;
    case "telemedicine_session":
      // Phase 2G.2 gave consultations a scoped page. A notice only reaches this
      // function when its own session named THIS relationship, so pointing at
      // the context list is correct — and the list itself is scoped again
      // server-side, so a stale notice cannot surface a foreign session.
      return `${base}/telemedicine`;
    default:
      // data_request and practice_patient_link: real kinds with no
      // practice-scoped page of their own yet.
      return null;
  }
}

/**
 * The item as the context page needs it.
 *
 * Omitted on purpose: `patientUserId`, `practiceProfileId`,
 * `practicePatientLinkId` and the practice branding (the context bar already
 * names the practice), the stored `targetUrl` (replaced above), and
 * `sourceRefId` — an internal id the page has no use for and that would hand
 * out a handle into another feature's namespace.
 */
function contextItemJson(row, linkId) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    titleKey: row.titleKey,
    summary: row.summary,
    summaryKey: row.summaryKey,
    status: row.status,
    targetPath: scopedTargetPath(linkId, row),
    lastActivityAt: row.lastActivityAt,
    createdAt: row.createdAt,
    readAt: row.readAt,
    archivedAt: row.archivedAt,
  };
}

/**
 * The link, only if it belongs to the session patient.
 *
 * A missing link and someone else's link both raise `link_not_found`.
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

/** The one scope clause. */
function contextWhere(link) {
  return { practicePatientLinkId: link.id, patientUserId: link.patientUserId };
}

/**
 * Notices of ONE care relationship.
 *
 * Keeps the cross-practice list's paging (limit/offset, capped at 100) and its
 * ordering, plus a tie-breaker: two notices written in the same millisecond
 * would otherwise come back in whatever order the database chose, and a list
 * that reshuffles between renders is its own kind of bug.
 *
 * @param {string} linkId
 * @param {string} patientUserId
 * @param {{ status?: string, limit?: number, offset?: number }} [opts]
 */
export async function listPatientLinkInboxItems(linkId, patientUserId, opts = {}) {
  const link = await assertPatientOwnsLink(linkId, patientUserId);

  const statusFilter = opts.status && STATUSES.has(opts.status) ? opts.status : undefined;
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
  const offset = Math.max(0, Number(opts.offset) || 0);

  const where = {
    ...contextWhere(link),
    ...(statusFilter ? { status: statusFilter } : { status: { not: "archived" } }),
  };

  const [rows, total] = await Promise.all([
    prisma.patientInboxItem.findMany({
      where,
      orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.patientInboxItem.count({ where }),
  ]);

  return { items: rows.map((r) => contextItemJson(r, link.id)), total, limit, offset };
}

/** Unread notices of this relationship — a count, never content. */
export async function countPatientLinkInboxUnread(linkId, patientUserId) {
  const link = await assertPatientOwnsLink(linkId, patientUserId);
  return prisma.patientInboxItem.count({
    where: { ...contextWhere(link), status: "unread" },
  });
}

/**
 * One notice, but only if it lives in THIS context.
 *
 * The scope is part of the query rather than a check on a row already fetched
 * by id: reading the foreign row first and comparing afterwards is what a later
 * refactor drops.
 */
async function loadInContext(linkId, itemId, patientUserId) {
  const link = await assertPatientOwnsLink(linkId, patientUserId);
  const id = String(itemId || "").trim();
  if (!id) throw new Error("validation_required");

  const row = await prisma.patientInboxItem.findFirst({
    where: { id, ...contextWhere(link) },
  });
  if (!row) throw new Error("item_not_found");
  return { link, row };
}

/**
 * Applies one status change, scoped.
 *
 * Reading the list does NOT mark anything read — the cross-practice inbox has
 * always used explicit acknowledgement endpoints, and that semantics is kept
 * rather than replaced by the messaging rule.
 */
async function transition(linkId, itemId, patientUserId, next, ctx = {}) {
  const { link, row } = await loadInContext(linkId, itemId, patientUserId);
  const now = new Date();

  if (next === "read" && row.status === "archived") throw new Error("item_archived");
  if (next === "restore" && row.status !== "archived") throw new Error("item_not_archived");

  const data =
    next === "read"
      ? { status: "read", readAt: row.readAt || now, lastActivityAt: now }
      : next === "archived"
        ? { status: "archived", archivedAt: now, lastActivityAt: now }
        : { status: row.readAt ? "read" : "unread", archivedAt: null, lastActivityAt: now };

  const updated = await prisma.patientInboxItem.update({
    // Safe by id here: the row was resolved through the context above.
    where: { id: row.id },
    data,
  });

  writeAuditLog({
    req: ctx.req,
    userId: link.patientUserId,
    actorRole: "patient",
    action: "patient_inbox_item_updated",
    entityType: "patient_inbox_item",
    entityId: updated.id,
    practicePatientLinkId: link.id,
    metadata: { itemId: updated.id, status: updated.status },
  });

  return contextItemJson(updated, link.id);
}

export function markPatientLinkInboxItemRead(linkId, itemId, patientUserId, ctx) {
  return transition(linkId, itemId, patientUserId, "read", ctx);
}

export function archivePatientLinkInboxItem(linkId, itemId, patientUserId, ctx) {
  return transition(linkId, itemId, patientUserId, "archived", ctx);
}

export function restorePatientLinkInboxItem(linkId, itemId, patientUserId, ctx) {
  return transition(linkId, itemId, patientUserId, "restore", ctx);
}
