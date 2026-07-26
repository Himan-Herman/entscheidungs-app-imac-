/**
 * Wearable import service — turns a batch of provider-supplied measurements into
 * VitalEntry rows, idempotently. Documentation only: no diagnosis, triage, or
 * interpretation. Robust by construction: every entry is validated and bounds-checked,
 * one bad entry never aborts the batch, and re-sending the same entry is a no-op.
 */

import { prisma } from "../../lib/prisma.js";
import { DEFAULT_UNITS, validateVital } from "../vitals/vitalConstants.js";

/** Hard cap per import call — protects the DB and keeps requests bounded. */
export const MAX_IMPORT_BATCH = 200;
const MAX_EXTERNAL_ID_LEN = 191;
const MAX_NOTES_LEN = 2000;

/**
 * The only device categories we accept. Anything else — including a raw device
 * name, bundle id or package name — is discarded, so free-text metadata from the
 * phone can never reach the database or the doctor's PDF.
 */
const ALLOWED_SOURCE_DEVICES = new Set([
  "apple_watch", "iphone", "samsung_watch", "manual_entry",
]);

/**
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.provider           provider id (already validated by caller)
 * @param {string[]} params.allowedTypes     vital types the connection is scoped to
 * @param {Array<object>} params.entries      raw provider entries
 * @returns {Promise<{imported:number, duplicates:number, skipped:Array<{index:number, reason:string}>}>}
 */
export async function importVitalEntries({ userId, provider, allowedTypes, entries }) {
  const allowed = new Set(Array.isArray(allowedTypes) ? allowedTypes : []);
  const skipped = [];
  let imported = 0;
  let duplicates = 0;

  // Guard against duplicate externalIds inside the same batch.
  const seenExternalIds = new Set();

  for (let i = 0; i < entries.length; i++) {
    const raw = entries[i] || {};
    const externalId = typeof raw.externalId === "string" ? raw.externalId.trim() : "";

    if (!externalId) { skipped.push({ index: i, reason: "missing_external_id" }); continue; }
    if (externalId.length > MAX_EXTERNAL_ID_LEN) { skipped.push({ index: i, reason: "external_id_too_long" }); continue; }
    if (seenExternalIds.has(externalId)) { skipped.push({ index: i, reason: "duplicate_in_batch" }); continue; }

    const type = raw.type;
    if (!allowed.has(type)) { skipped.push({ index: i, reason: "type_not_in_scope" }); continue; }

    const validationError = validateVital(raw);
    if (validationError) { skipped.push({ index: i, reason: validationError }); continue; }

    seenExternalIds.add(externalId);

    const data = {
      userId,
      type,
      valuePrimary: Number(raw.valuePrimary),
      valueSecondary: type === "blood_pressure" ? Number(raw.valueSecondary) : null,
      unit: (typeof raw.unit === "string" && raw.unit.trim() ? raw.unit.trim() : DEFAULT_UNITS[type] || "").slice(0, 20),
      measuredAt: new Date(raw.measuredAt),
      notes: typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim().slice(0, MAX_NOTES_LEN) : null,
      source: "import",
      sourceProvider: provider,
      sourceDevice: ALLOWED_SOURCE_DEVICES.has(raw.sourceDevice) ? raw.sourceDevice : null,
      externalId,
    };

    try {
      // Idempotent: (userId, sourceProvider, externalId) is unique. A re-sent entry
      // resolves to the existing row and is counted as a duplicate, never duplicated.
      const existing = await prisma.vitalEntry.findUnique({
        where: {
          userId_sourceProvider_externalId: { userId, sourceProvider: provider, externalId },
        },
        select: { id: true, deletedAt: true },
      });

      if (existing) {
        duplicates++;
        continue;
      }

      await prisma.vitalEntry.create({ data });
      imported++;
    } catch (err) {
      // Unique-constraint race (concurrent import of same externalId) → treat as duplicate.
      if (err?.code === "P2002") { duplicates++; continue; }
      skipped.push({ index: i, reason: "write_failed" });
    }
  }

  return { imported, duplicates, skipped };
}
