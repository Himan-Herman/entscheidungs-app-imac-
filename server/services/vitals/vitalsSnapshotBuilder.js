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
 * @param {{now?: number, maxAgeDays?: number}} [options]
 * @returns {Promise<object|null>} null when the user has no usable recent readings
 */
export async function buildSnapshotForUser(userId, options = {}) {
  if (typeof userId !== "string" || !userId) return null;

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
 * Replace any client-supplied `answers.vitalsSnapshot` with a server-derived one.
 * Absent key → answers pass through untouched (no consent, no snapshot).
 *
 * @param {unknown} answers
 * @param {string} userId
 * @returns {Promise<unknown>}
 */
export async function withServerDerivedSnapshot(answers, userId) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return answers;
  if (!("vitalsSnapshot" in answers)) return answers;

  // The presence of the key is the consent signal; its contents are discarded.
  const snapshot = await buildSnapshotForUser(userId);
  const next = { ...answers };
  if (snapshot) next.vitalsSnapshot = snapshot;
  else delete next.vitalsSnapshot;
  return next;
}
