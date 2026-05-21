import {
  listSessions,
  updateSessionMetadata,
} from "../store/interpreterSessionStore.js";

/** Clear local cloud sync markers after all cloud data was deleted. */
export function clearAllLocalCloudSyncFlags() {
  for (const session of listSessions()) {
    if (session.cloudSyncStatus !== "none" || session.cloudSyncedAt) {
      updateSessionMetadata(session.sessionId, {
        cloudSyncStatus: "none",
        cloudSyncedAt: undefined,
      });
    }
  }
}
