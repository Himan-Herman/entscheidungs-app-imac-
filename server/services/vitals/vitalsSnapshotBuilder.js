/**
 * Server-side construction of the Pre-Visit vitals snapshot.
 *
 * Why this exists: the client used to hand us a finished snapshot and we merely
 * sanitised its shape. That let a tampered client put plausible-looking numbers in
 * front of a doctor. The snapshot is now DERIVED from the patient's own stored
 * VitalEntry rows, so the practice can only ever see readings that really exist in
 * MedScoutX for that user.
 *
 * The client's payload is used for exactly one thing: as the patient's consent
 * signal that a snapshot may be attached at all. Its values are discarded.
 *
 * Data minimisation: newest reading per type, bounded age, no notes, no external
 * ids, no raw platform metadata.
 */

import { prisma } from "../../lib/prisma.js";
import { VALID_TYPES } from "./vitalConstants.js";

/** Link states in which a practice may act on a patient's data at all. */
const LINK_USABLE = ["invited", "active"];

/** Only readings from this window are relevant for an upcoming appointment. */
export const SNAPSHOT_MAX_AGE_DAYS = 90;

/** Display order, matching the patient UI. */
const TYPE_ORDER = [
  "blood_pressure", "heart_rate", "glucose", "weight", "oxygen", "temperature",
];

/** Device categories we are willing to show. Anything else becomes null. */
const ALLOWED_SOURCE_DEVICES = new Set([
  "apple_watch", "iphone", "samsung_watch", "manual_entry",
]);

/**
 * Build the snapshot from what is actually stored for this user.
 *
 * @param {string} userId
 * @param {{now?: number, maxAgeDays?: number, practiceProfileId?: string|null}} [options]
 * @returns {Promise<object|null>} null when the user has no usable recent readings
 */
export async function buildSnapshotForUser(userId, options = {}) {
  if (typeof userId !== "string" || !userId) return null;

  // Which of this patient's readings may go to THIS practice.
  //
  // Global readings always may — the patient is attaching them deliberately.
  // Contextual readings may only travel back to the care relationship they were
  // recorded in: a value from cardiology must not reach the GP through a
  // pre-visit form the patient filled in for the GP.
  //
  // When the session has no practice context (a walk-in QR that resolved to
  // nothing, or a preparation the patient does for themselves), the snapshot is
  // global-only. The practice is never guessed from a date, an appointment or a
  // specialty.
  const contextWhere = await buildSnapshotContextWhere(userId, options.practiceProfileId);

  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const maxAgeDays = Number.isFinite(options.maxAgeDays) && options.maxAgeDays > 0
    ? options.maxAgeDays
    : SNAPSHOT_MAX_AGE_DAYS;
  const since = new Date(now - maxAgeDays * 86_400_000);

  let rows;
  try {
    rows = await prisma.vitalEntry.findMany({
      where: {
        userId,                       // ownership is enforced here, not by the client
        deletedAt: null,
        type: { in: VALID_TYPES },
        measuredAt: { gte: since, lte: new Date(now) },
        ...contextWhere,
      },
      orderBy: { measuredAt: "desc" },
      select: {
        type: true, valuePrimary: true, valueSecondary: true, unit: true,
        measuredAt: true, source: true, sourceProvider: true, sourceDevice: true,
        // notes and externalId are deliberately NOT selected.
      },
      take: 500,
    });
  } catch (err) {
    console.error("[vitals-snapshot] query failed", err?.code || err?.message || "error");
    return null;
  }

  /** Newest row wins — the query is already sorted descending. */
  const newestByType = new Map();
  for (const r of rows) {
    if (!newestByType.has(r.type)) newestByType.set(r.type, r);
  }
  if (newestByType.size === 0) return null;

  const items = TYPE_ORDER.filter((t) => newestByType.has(t)).map((t) => {
    const r = newestByType.get(t);
    return {
      type: r.type,
      valuePrimary: r.valuePrimary,
      valueSecondary: r.type === "blood_pressure" ? r.valueSecondary ?? null : null,
      unit: r.unit || "",
      measuredAt: r.measuredAt.toISOString(),   // the real measurement time, never the sync time
      source: r.source === "import" ? "import" : "manual",
      sourceProvider: r.source === "import" ? r.sourceProvider ?? null : null,
      sourceDevice: ALLOWED_SOURCE_DEVICES.has(r.sourceDevice) ? r.sourceDevice : null,
    };
  });

  return {
    version: 2,
    createdAt: new Date(now).toISOString(),
    maxAgeDays,
    items,
  };
}

/**
 * The scope filter for one snapshot, resolved from the patient's OWN link to
 * the target practice.
 *
 * Returns the two shapes a practice may ever receive:
 *   patient_global      + no context      — the patient's own readings
 *   practice_contextual + this link only  — recorded in this care relationship
 *
 * Deny by default: with no practice, or no link to it, only global readings
 * match. Unclassified legacy rows match neither branch, exactly as on the
 * practice read paths.
 *
 * @param {string} userId
 * @param {string|null|undefined} practiceProfileId
 */
async function buildSnapshotContextWhere(userId, practiceProfileId) {
  const globalOnly = { dataScope: "patient_global", contextPracticePatientLinkId: null };
  const pid = String(practiceProfileId || "").trim();
  if (!pid) return globalOnly;

  let link = null;
  try {
    link = await prisma.practicePatientLink.findFirst({
      where: { practiceProfileId: pid, patientUserId: userId, status: { in: LINK_USABLE } },
      select: { id: true },
    });
  } catch (err) {
    // A failed lookup must narrow, never widen.
    console.error("[vitals-snapshot] link lookup failed", err?.code || err?.message || "error");
    return globalOnly;
  }
  if (!link) return globalOnly;

  return {
    OR: [
      globalOnly,
      { dataScope: "practice_contextual", contextPracticePatientLinkId: link.id },
    ],
  };
}

/**
 * Replace any client-supplied `answers.vitalsSnapshot` with a server-derived one.
 * Absent key → answers pass through untouched (no consent, no snapshot).
 *
 * @param {unknown} answers
 * @param {string} userId
 * @returns {Promise<unknown>}
 */
export async function withServerDerivedSnapshot(answers, userId, practiceProfileId = null) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return answers;
  if (!("vitalsSnapshot" in answers)) return answers;

  // The presence of the key is the consent signal; its contents are discarded.
  const snapshot = await buildSnapshotForUser(userId, { practiceProfileId });
  const next = { ...answers };
  if (snapshot) next.vitalsSnapshot = snapshot;
  else delete next.vitalsSnapshot;
  return next;
}
