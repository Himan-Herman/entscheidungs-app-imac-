import { INTERPRETER_ACK_STORAGE_KEY } from "../constants.js";

/**
 * @returns {boolean}
 */
export function hasInterpreterAck() {
  try {
    const raw = localStorage.getItem(INTERPRETER_ACK_STORAGE_KEY);
    if (!raw) return false;
    if (raw === "1") return true;
    const parsed = JSON.parse(raw);
    return typeof parsed?.acceptedAt === "string" && parsed.acceptedAt.length > 0;
  } catch {
    return false;
  }
}

/**
 * Persists acknowledgement timestamp only (no session or medical data).
 */
export function setInterpreterAck() {
  try {
    localStorage.setItem(
      INTERPRETER_ACK_STORAGE_KEY,
      JSON.stringify({ acceptedAt: new Date().toISOString() }),
    );
  } catch {
    /* private mode / quota */
  }
}

/**
 * @returns {string|null}
 */
export function getInterpreterAckTimestamp() {
  try {
    const raw = localStorage.getItem(INTERPRETER_ACK_STORAGE_KEY);
    if (!raw) return null;
    if (raw === "1") return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.acceptedAt === "string" ? parsed.acceptedAt : null;
  } catch {
    return null;
  }
}
