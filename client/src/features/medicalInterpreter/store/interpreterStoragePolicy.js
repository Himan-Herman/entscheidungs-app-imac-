/**
 * Medical Interpreter — Phase 1 local storage policy (documentation + helpers).
 *
 * STORAGE:
 * - Sessions live in localStorage under `medscoutx_interpreter_sessions_v1_{userId}` only.
 * - No server persistence in Phase 1.
 * - No audio, microphone blobs, or raw recording metadata are stored.
 *
 * LOGOUT (matches existing MedScoutX pattern in Header.jsx):
 * - Logout clears auth tokens (`medscout_token`, `medscout_user_id`) but does NOT remove
 *   interpreter session keys. Conversations remain on this device until the user deletes
 *   them or clears site data. A future account-wide wipe may include interpreter keys.
 *
 * BROWSER / DEVICE:
 * - Clearing site data removes localStorage including interpreter sessions.
 * - Private browsing may discard storage when the session ends.
 */

import { TURN_STATUS_DRAFT } from "../constants.js";

/** Keys that must never be persisted (defensive strip if present in legacy JSON). */
export const FORBIDDEN_PERSISTED_KEYS = new Set([
  "audio",
  "audioBlob",
  "audioUrl",
  "recording",
  "microphone",
  "rawAudio",
  "mediaRecorder",
  "chunks",
  "inviteToken",
  "rawInviteToken",
  "token",
  "tokenHash",
]);

/**
 * @param {import('../types.js').InterpreterSession | null | undefined} session
 * @returns {boolean}
 */
export function hasPendingDraftTurn(session) {
  if (!session?.turns?.length) return false;
  return session.turns.some(
    (t) => t.status === TURN_STATUS_DRAFT && String(t.originalText || "").trim().length > 0,
  );
}

/**
 * @param {Record<string, unknown>} o
 */
export function stripForbiddenPersistedFields(o) {
  if (!o || typeof o !== "object") return;
  for (const key of FORBIDDEN_PERSISTED_KEYS) {
    if (key in o) delete o[key];
  }
}
