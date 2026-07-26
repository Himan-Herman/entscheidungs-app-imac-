/**
 * Foreground sync: device health store → MedScoutX server.
 *
 * Deliberately manual only. The patient presses "jetzt synchronisieren"; there is no
 * background sync in this first store-safe version.
 *
 * Layering: this orchestrates the native bridge and the existing wearables API. It adds
 * no new transport, no new storage, and no interpretation of the values.
 */

import {
  getHealthProvider,
  checkHealthReadAccess,
  readHealthEntries,
  resolveSyncStart,
} from "./healthBridge.js";
/**
 * Loaded lazily so this module stays importable without the API/auth layer
 * (unit tests inject their own `importEntries`). Production behaviour is unchanged.
 */
async function defaultImportEntries(payload) {
  const { importWearableEntries } = await import("../api/wearablesApi.js");
  return importWearableEntries(payload);
}

/** Sync outcome codes — the UI maps these to translated messages. */
/**
 * Upload chunk size. Must stay <= the server's MAX_IMPORT_BATCH, otherwise a sync
 * with a full 30-day window is rejected wholesale with 413.
 */
export const MAX_UPLOAD_CHUNK = 200;

export const SYNC_RESULT = Object.freeze({
  OK: "ok",
  NO_PLATFORM: "no_platform",
  NO_PERMISSION: "no_permission",
  NOTHING_NEW: "nothing_new",
  SERVER_ERROR: "server_error",
  OFFLINE: "offline",
});

/**
 * Read the granted types from the device and push them to the server.
 *
 * The OS permission alone is never enough: the caller must already hold an active,
 * consented MedScoutX connection for this provider — the server enforces that and
 * answers 409 `not_connected` / `consent_required` otherwise.
 *
 * @param {object} params
 * @param {string[]} params.scopes vital types the MedScoutX connection is scoped to
 * @param {string|null} params.lastSyncedAt ISO timestamp of the previous successful sync
 * @param {object} [params.deps] injection seam for tests
 * @returns {Promise<{result: string, imported: number, duplicates: number, skipped: number,
 *                    deniedTypes: string[], failedTypes: string[]}>}
 */
export async function syncHealthData({ scopes, lastSyncedAt, checkpoints, deps } = {}) {
  const {
    getProvider = getHealthProvider,
    checkAccess = checkHealthReadAccess,
    readEntries = readHealthEntries,
    importEntries = defaultImportEntries,
    now = () => Date.now(),
  } = deps || {};

  const empty = { imported: 0, duplicates: 0, skipped: 0, deniedTypes: [], failedTypes: [], truncatedTypes: [] };

  const provider = getProvider();
  if (!provider) return { result: SYNC_RESULT.NO_PLATFORM, ...empty };

  // Intersect what MedScoutX is allowed to import with what the OS actually granted.
  const requested = Array.isArray(scopes) && scopes.length ? scopes : undefined;
  const access = await checkAccess(requested);
  const granted = (access?.authorized || []).filter(
    (t) => !requested || requested.includes(t),
  );
  const deniedTypes = access?.denied || [];

  if (granted.length === 0) {
    return { result: SYNC_RESULT.NO_PERMISSION, ...empty, deniedTypes };
  }

  const { entries, failedTypes, truncatedTypes, lastReadAt } = await readEntries({
    vitalTypes: granted,
    startDate: resolveSyncStart(lastSyncedAt, now()),
    checkpoints,
  });

  /**
   * A truncated type keeps a resume point; a type read to the end has its checkpoint
   * cleared (null). lastSyncedAt may only advance when nothing is left over — otherwise
   * the next sync would start after the readings we did not fetch.
   */
  const nextCheckpoints = {};
  for (const t of truncatedTypes || []) {
    if (lastReadAt?.[t]) nextCheckpoints[t] = lastReadAt[t];
  }
  for (const t of granted) {
    if (!(t in nextCheckpoints) && checkpoints?.[t]) nextCheckpoints[t] = null; // done → clear
  }
  const fullyComplete = Object.values(nextCheckpoints).every((v) => v === null);

  if (entries.length === 0) {
    return { result: SYNC_RESULT.NOTHING_NEW, ...empty, deniedTypes, failedTypes, truncatedTypes: truncatedTypes || [] };
  }

  // The server caps one import call; a 30-day window across six types easily exceeds
  // it, so the batch is uploaded in chunks and the counts are accumulated.
  const totals = { imported: 0, duplicates: 0, skipped: 0 };
  try {
    for (let i = 0; i < entries.length; i += MAX_UPLOAD_CHUNK) {
      const chunk = entries.slice(i, i + MAX_UPLOAD_CHUNK);
      const isLast = i + MAX_UPLOAD_CHUNK >= entries.length;
      // lastSyncedAt may only advance once every chunk has landed.
      const { res, data } = await importEntries({
        provider, entries: chunk,
        finalizeSync: isLast, checkpoints: isLast ? nextCheckpoints : undefined,
        complete: isLast ? fullyComplete : undefined,
      });
      if (!res?.ok || !data?.ok) {
        // Keep what already made it through — a later chunk failing must not
        // discard earlier successes, and the next sync will pick up the rest.
        return { result: SYNC_RESULT.SERVER_ERROR, ...totals, deniedTypes, failedTypes, truncatedTypes: truncatedTypes || [] };
      }
      totals.imported += data.imported || 0;
      totals.duplicates += data.duplicates || 0;
      totals.skipped += Array.isArray(data.skipped) ? data.skipped.length : 0;
    }
    return { result: SYNC_RESULT.OK, ...totals, deniedTypes, failedTypes, truncatedTypes: truncatedTypes || [] };
  } catch (err) {
    if (err?.message === "SESSION_EXPIRED") throw err;
    // Network failure — the device is offline or the API is unreachable.
    return { result: SYNC_RESULT.OFFLINE, ...totals, deniedTypes, failedTypes, truncatedTypes: truncatedTypes || [] };
  }
}
