import {
  createCloudSession,
  updateCloudSession,
} from "../api/interpreterCloudApi.js";
import { updateSessionMetadata } from "../store/interpreterSessionStore.js";
import { sessionToCloudPayload } from "./interpreterCloudPayload.js";

/**
 * @param {import('../types.js').InterpreterSession} session
 * @param {{ alreadyOnCloud: boolean }} opts
 */
export async function saveSessionToCloud(session, opts) {
  const payload = sessionToCloudPayload(session, { cloudStorageConsent: true });
  const result = opts.alreadyOnCloud
    ? await updateCloudSession(session.sessionId, payload)
    : await createCloudSession(payload);

  if (!result.ok) {
    return result;
  }

  const syncedAt = new Date().toISOString();
  updateSessionMetadata(session.sessionId, {
    cloudSyncedAt: syncedAt,
    cloudSyncStatus: "synced",
  });

  return { ok: true, syncedAt };
}

/**
 * @param {import('../types.js').InterpreterSession} session
 * @param {Set<string>} cloudSessionIds
 */
export function resolveCloudSyncStatus(session, cloudSessionIds) {
  const onCloud = cloudSessionIds.has(session.sessionId);
  if (!onCloud) {
    if (session.cloudSyncStatus === "synced" || session.cloudSyncStatus === "stale") {
      return "stale";
    }
    return "none";
  }
  if (!session.cloudSyncedAt) return "synced";
  const localMs = new Date(session.updatedAt).getTime();
  const cloudMs = new Date(session.cloudSyncedAt).getTime();
  if (Number.isFinite(localMs) && Number.isFinite(cloudMs) && localMs > cloudMs) {
    return "stale";
  }
  return "synced";
}
