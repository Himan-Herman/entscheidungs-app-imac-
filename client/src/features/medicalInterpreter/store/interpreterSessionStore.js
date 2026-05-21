/**
 * Medical Interpreter — local-only session store (Phase 1).
 *
 * STORAGE POLICY:
 * - Persists to `medscoutx_interpreter_sessions_v1_{userId}` only (see constants).
 * - No server-side session persistence in Phase 1.
 * - No audio, microphone blobs, or raw recording metadata are stored.
 * - Logout clears auth tokens only (Header.jsx); interpreter keys remain until
 *   the user deletes sessions or clears site data.
 *
 * See `interpreterStoragePolicy.js` for helpers and extended policy notes.
 */

import {
  INTERPRETER_MAX_TURN_CHARS,
  INTERPRETER_STORE_PREFIX,
  INTERPRETER_STORE_VERSION,
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_DRAFT,
  SESSION_STATUS_ENDED,
  SPEAKER_DOCTOR,
  SPEAKER_PATIENT,
  TURN_STATUS_DRAFT,
} from "../constants.js";
import {
  stripForbiddenPersistedFields,
} from "./interpreterStoragePolicy.js";
import { buildAutoSessionTitle } from "../utils/sessionAutoTitle.js";
import {
  isUnsafeSessionTitle,
  sanitizeSessionTitleForStorage,
} from "../utils/sessionTitleSafety.js";

export { hasPendingDraftTurn } from "./interpreterStoragePolicy.js";

/** @typedef {import('../types.js').InterpreterSession} InterpreterSession */
/** @typedef {import('../types.js').InterpreterTurn} InterpreterTurn */
/** @typedef {import('../types.js').InterpreterSessionStore} InterpreterSessionStore */
/** @typedef {import('../types.js').InterpreterProfileSnapshot} InterpreterProfileSnapshot */

const SESSION_STATUSES = new Set([
  SESSION_STATUS_DRAFT,
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_ENDED,
]);

const TURN_STATUSES = new Set([
  "draft",
  "confirmed",
  "translated",
  "blocked",
  "error",
]);

const SPEAKERS = new Set([SPEAKER_PATIENT, SPEAKER_DOCTOR]);

function getUserId() {
  try {
    return localStorage.getItem("medscout_user_id") || "anonymous";
  } catch {
    return "anonymous";
  }
}

function storageKey() {
  return `${INTERPRETER_STORE_PREFIX}_${getUserId()}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `interp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function generateTurnId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `turn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function emptyStore() {
  return {
    version: INTERPRETER_STORE_VERSION,
    activeSessionId: null,
    sessions: [],
  };
}

function readStoreRaw() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyStore();

    if (parsed.version !== INTERPRETER_STORE_VERSION) {
      const sessions = (Array.isArray(parsed.sessions) ? parsed.sessions : [])
        .map((s) => {
          if (s && typeof s === "object") {
            stripForbiddenPersistedFields(/** @type {Record<string, unknown>} */ (s));
          }
          return normalizeSession(s);
        })
        .filter(Boolean);
      let activeSessionId =
        typeof parsed.activeSessionId === "string" ? parsed.activeSessionId : null;
      if (
        activeSessionId &&
        !sessions.some((s) => s.sessionId === activeSessionId)
      ) {
        activeSessionId = sessions[0]?.sessionId ?? null;
      }
      return {
        version: INTERPRETER_STORE_VERSION,
        activeSessionId,
        sessions,
      };
    }

    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(store));
  } catch {
    /* quota, private mode, or disabled storage */
  }
}

/**
 * Strip profile and invalid fields; never retain audio-related keys.
 * @param {unknown} raw
 * @returns {InterpreterSession|null}
 */
export function normalizeSession(raw) {
  if (!raw || typeof raw !== "object") return null;

  const o = /** @type {Record<string, unknown>} */ (raw);
  stripForbiddenPersistedFields(o);
  const sessionId = typeof o.sessionId === "string" ? o.sessionId.trim() : "";
  if (!sessionId) return null;

  const patientLanguage =
    typeof o.patientLanguage === "string" ? o.patientLanguage.trim().slice(0, 12) : "";
  const doctorLanguage =
    typeof o.doctorLanguage === "string" ? o.doctorLanguage.trim().slice(0, 12) : "";
  if (!patientLanguage || !doctorLanguage) return null;

  let status =
    typeof o.status === "string" && SESSION_STATUSES.has(o.status)
      ? o.status
      : SESSION_STATUS_DRAFT;

  const profileConsentUsed = o.profileConsentUsed === true;
  const storageConsent = o.storageConsent === true;

  /** @type {InterpreterProfileSnapshot|undefined} */
  let profileSnapshot;
  if (profileConsentUsed && o.profileSnapshot && typeof o.profileSnapshot === "object") {
    const p = /** @type {Record<string, unknown>} */ (o.profileSnapshot);
    profileSnapshot = {
      firstName: typeof p.firstName === "string" ? p.firstName.trim().slice(0, 120) : undefined,
      lastName: typeof p.lastName === "string" ? p.lastName.trim().slice(0, 120) : undefined,
      dateOfBirth:
        typeof p.dateOfBirth === "string" ? p.dateOfBirth.trim().slice(0, 32) : undefined,
      email: typeof p.email === "string" ? p.email.trim().slice(0, 254) : undefined,
      phone: typeof p.phone === "string" ? p.phone.trim().slice(0, 40) : undefined,
    };
    const hasField = Object.values(profileSnapshot).some((v) => v);
    if (!hasField) profileSnapshot = undefined;
  }

  /** @type {import('../types.js').InterpreterInviteContext|undefined} */
  let inviteContext;
  if (o.inviteContext && typeof o.inviteContext === "object") {
    const ic = /** @type {Record<string, unknown>} */ (o.inviteContext);
    stripForbiddenPersistedFields(ic);
    const practiceDisplayName = String(ic.practiceDisplayName || "")
      .trim()
      .slice(0, 120);
    if (practiceDisplayName) {
      inviteContext = {
        practiceDisplayName,
        linkedAt:
          typeof ic.linkedAt === "string" ? ic.linkedAt.trim().slice(0, 40) : nowIso(),
        source: "practice_invite",
        sharingConsentGranted: false,
      };
    }
  }

  const turnsRaw = Array.isArray(o.turns) ? o.turns : [];
  const turns = turnsRaw
    .map((t) => normalizeTurn(t))
    .filter(Boolean);

  const createdAt =
    typeof o.createdAt === "string" ? o.createdAt : nowIso();
  const updatedAt =
    typeof o.updatedAt === "string" ? o.updatedAt : createdAt;

  return {
    sessionId,
    createdAt,
    updatedAt,
    endedAt: typeof o.endedAt === "string" ? o.endedAt : undefined,
    status,
    patientLanguage,
    doctorLanguage,
    conversationTitle:
      typeof o.conversationTitle === "string"
        ? o.conversationTitle.trim().slice(0, 200)
        : undefined,
    doctorName:
      typeof o.doctorName === "string" ? o.doctorName.trim().slice(0, 200) : undefined,
    practiceName:
      typeof o.practiceName === "string" ? o.practiceName.trim().slice(0, 200) : undefined,
    specialty:
      typeof o.specialty === "string" ? o.specialty.trim().slice(0, 120) : undefined,
    appointmentDateTime:
      typeof o.appointmentDateTime === "string"
        ? o.appointmentDateTime.trim().slice(0, 40)
        : undefined,
    profileConsentUsed,
    storageConsent,
    profileSnapshot,
    cloudSyncStatus:
      o.cloudSyncStatus === "synced" || o.cloudSyncStatus === "stale"
        ? o.cloudSyncStatus
        : "none",
    cloudSyncedAt:
      typeof o.cloudSyncedAt === "string" ? o.cloudSyncedAt : undefined,
    inviteContext,
    turns,
  };
}

/**
 * @param {unknown} raw
 * @returns {InterpreterTurn|null}
 */
function normalizeTurn(raw) {
  if (!raw || typeof raw !== "object") return null;
  const t = /** @type {Record<string, unknown>} */ (raw);
  stripForbiddenPersistedFields(t);
  const turnId = typeof t.turnId === "string" ? t.turnId.trim() : "";
  if (!turnId) return null;

  const speaker =
    typeof t.speaker === "string" && SPEAKERS.has(t.speaker) ? t.speaker : SPEAKER_PATIENT;
  const sourceLanguage =
    typeof t.sourceLanguage === "string" ? t.sourceLanguage.trim().slice(0, 12) : "";
  const targetLanguage =
    typeof t.targetLanguage === "string" ? t.targetLanguage.trim().slice(0, 12) : "";
  const originalText =
    typeof t.originalText === "string"
      ? t.originalText.trim().slice(0, INTERPRETER_MAX_TURN_CHARS)
      : "";

  const status =
    typeof t.status === "string" && TURN_STATUSES.has(t.status) ? t.status : TURN_STATUS_DRAFT;

  return {
    turnId,
    speaker,
    sourceLanguage,
    targetLanguage,
    originalText,
    translatedText:
      typeof t.translatedText === "string"
        ? t.translatedText.trim().slice(0, INTERPRETER_MAX_TURN_CHARS)
        : undefined,
    simplifiedText:
      typeof t.simplifiedText === "string"
        ? t.simplifiedText.trim().slice(0, INTERPRETER_MAX_TURN_CHARS)
        : undefined,
    confidence:
      t.confidence === "high" ||
      t.confidence === "medium" ||
      t.confidence === "low"
        ? t.confidence
        : undefined,
    translationDirection:
      typeof t.translationDirection === "string"
        ? t.translationDirection.trim().slice(0, 24)
        : undefined,
    translationUncertain: t.translationUncertain === true ? true : undefined,
    terminologyWarning: t.terminologyWarning === true ? true : undefined,
    unclearSource: t.unclearSource === true ? true : undefined,
    createdAt: typeof t.createdAt === "string" ? t.createdAt : nowIso(),
    editedAt: typeof t.editedAt === "string" ? t.editedAt : undefined,
    status,
  };
}

function readStore() {
  const raw = readStoreRaw();
  const sessions = (Array.isArray(raw.sessions) ? raw.sessions : [])
    .map((s) => normalizeSession(s))
    .filter(Boolean);
  const activeSessionId =
    typeof raw.activeSessionId === "string" &&
    sessions.some((s) => s.sessionId === raw.activeSessionId)
      ? raw.activeSessionId
      : sessions[0]?.sessionId ?? null;

  return {
    version: INTERPRETER_STORE_VERSION,
    activeSessionId,
    sessions,
  };
}

function persistSessions(sessions, activeSessionId) {
  writeStore({
    version: INTERPRETER_STORE_VERSION,
    activeSessionId: activeSessionId ?? null,
    sessions,
  });
}

function touchSession(session, patch = {}) {
  const next = normalizeSession({
    ...session,
    ...patch,
    updatedAt: nowIso(),
  });
  return next;
}

/**
 * @param {Partial<InterpreterSession>} [seed]
 * @returns {InterpreterSession|null}
 */
export function createSession(seed = {}) {
  const createdAt = nowIso();
  const session = normalizeSession({
    sessionId: generateSessionId(),
    createdAt,
    updatedAt: createdAt,
    status: SESSION_STATUS_DRAFT,
    patientLanguage: seed.patientLanguage ?? "",
    doctorLanguage: seed.doctorLanguage ?? "",
    profileConsentUsed: seed.profileConsentUsed === true,
    storageConsent: seed.storageConsent === true,
    turns: [],
    ...seed,
  });
  if (!session) return null;

  const store = readStore();
  const sessions = [...store.sessions, session];
  persistSessions(sessions, session.sessionId);
  return session;
}

/**
 * @param {string} sessionId
 * @returns {InterpreterSession|null}
 */
export function getSession(sessionId) {
  if (!sessionId) return null;
  const store = readStore();
  return store.sessions.find((s) => s.sessionId === sessionId) ?? null;
}

/**
 * Active session pointer, or null.
 * @returns {InterpreterSession|null}
 */
export function getCurrentSession() {
  const store = readStore();
  if (!store.activeSessionId) return null;
  return getSession(store.activeSessionId);
}

/**
 * Most recently updated session.
 * @returns {InterpreterSession|null}
 */
export function getLatestSession() {
  const store = readStore();
  if (store.sessions.length === 0) return null;
  return [...store.sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];
}

/**
 * @returns {boolean}
 */
export function hasActiveSession() {
  const current = getCurrentSession();
  return (
    current != null &&
    (current.status === SESSION_STATUS_DRAFT || current.status === SESSION_STATUS_ACTIVE)
  );
}

/**
 * @param {string} sessionId
 * @param {Partial<InterpreterSession>} patch
 * @returns {InterpreterSession|null}
 */
export function updateSessionMetadata(sessionId, patch = {}) {
  const store = readStore();
  const idx = store.sessions.findIndex((s) => s.sessionId === sessionId);
  if (idx < 0) return null;

  const merged = { ...store.sessions[idx], ...patch };
  if (merged.profileConsentUsed !== true) {
    delete merged.profileSnapshot;
  }

  const next = touchSession(merged);
  if (!next) return null;

  const sessions = [...store.sessions];
  sessions[idx] = next;
  persistSessions(sessions, store.activeSessionId);
  return next;
}

/**
 * @param {string} sessionId
 * @param {Partial<InterpreterTurn>} [seed]
 * @returns {InterpreterTurn|null}
 */
export function addTurn(sessionId, seed = {}) {
  const session = getSession(sessionId);
  if (!session) return null;

  const turn = normalizeTurn({
    turnId: generateTurnId(),
    speaker: seed.speaker ?? SPEAKER_PATIENT,
    sourceLanguage: seed.sourceLanguage ?? session.patientLanguage,
    targetLanguage: seed.targetLanguage ?? session.doctorLanguage,
    originalText: seed.originalText ?? "",
    status: TURN_STATUS_DRAFT,
    createdAt: nowIso(),
    ...seed,
  });
  if (!turn) return null;

  const turns = [...session.turns, turn];
  const status =
    session.status === SESSION_STATUS_DRAFT ? SESSION_STATUS_ACTIVE : session.status;

  updateSessionMetadata(sessionId, { turns, status });
  return turn;
}

/**
 * @param {string} sessionId
 * @param {string} turnId
 * @param {Partial<InterpreterTurn>} patch
 * @returns {InterpreterTurn|null}
 */
export function updateTurn(sessionId, turnId, patch = {}) {
  const session = getSession(sessionId);
  if (!session) return null;

  const idx = session.turns.findIndex((t) => t.turnId === turnId);
  if (idx < 0) return null;

  const merged = {
    ...session.turns[idx],
    ...patch,
    editedAt: nowIso(),
  };
  const nextTurn = normalizeTurn(merged);
  if (!nextTurn) return null;

  const turns = [...session.turns];
  turns[idx] = nextTurn;
  updateSessionMetadata(sessionId, { turns });
  return nextTurn;
}

/**
 * @param {string} sessionId
 * @param {string} turnId
 * @returns {boolean}
 */
export function deleteTurn(sessionId, turnId) {
  const session = getSession(sessionId);
  if (!session) return false;

  const turns = session.turns.filter((t) => t.turnId !== turnId);
  if (turns.length === session.turns.length) return false;

  updateSessionMetadata(sessionId, { turns });
  return true;
}

/**
 * @param {string} sessionId
 * @param {string} conversationTitle
 * @returns {InterpreterSession|null}
 */
/**
 * Apply deterministic title when user has not set a manual name.
 * @param {string} sessionId
 * @param {object} [labels] — medicalInterpreter i18n for buildAutoSessionTitle
 * @param {string} [uiLanguage]
 */
export function maybeApplyAutoSessionTitle(sessionId, labels, uiLanguage = "de") {
  const session = getSession(sessionId);
  if (!session || session.conversationTitle?.trim()) return session;

  const autoTitle = buildAutoSessionTitle(session, labels ?? { history: {} }, uiLanguage);
  const safe = sanitizeSessionTitleForStorage(autoTitle);
  if (!safe) return session;

  return updateSessionMetadata(sessionId, { conversationTitle: safe });
}

/**
 * @param {string} sessionId
 * @param {string} conversationTitle
 * @returns {InterpreterSession|null}
 */
export function renameSession(sessionId, conversationTitle) {
  const trimmed = String(conversationTitle ?? "").trim().slice(0, 200);
  if (!trimmed || isUnsafeSessionTitle(trimmed)) return null;
  return updateSessionMetadata(sessionId, { conversationTitle: trimmed });
}

/**
 * @param {string} sessionId
 * @returns {InterpreterSession|null}
 */
export function endSession(sessionId, labels, uiLanguage) {
  const ended = updateSessionMetadata(sessionId, {
    status: SESSION_STATUS_ENDED,
    endedAt: nowIso(),
  });
  if (ended && labels) {
    maybeApplyAutoSessionTitle(sessionId, labels, uiLanguage);
    return getSession(sessionId);
  }
  return ended;
}

/**
 * @param {string} sessionId
 * @returns {boolean}
 */
export function deleteSession(sessionId) {
  const store = readStore();
  const sessions = store.sessions.filter((s) => s.sessionId !== sessionId);
  if (sessions.length === store.sessions.length) return false;

  let activeSessionId = store.activeSessionId;
  if (activeSessionId === sessionId) {
    activeSessionId = sessions[0]?.sessionId ?? null;
  }
  persistSessions(sessions, activeSessionId);
  return true;
}

/**
 * All normalized sessions (newest first).
 * @returns {InterpreterSession[]}
 */
export function listSessions() {
  const store = readStore();
  return [...store.sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/**
 * Sessions the user opted to keep on this device (storageConsent).
 * @returns {InterpreterSession[]}
 */
export function listSavedSessions() {
  return listSessions().filter((s) => s.storageConsent === true);
}

/**
 * Remove every interpreter session for the current user.
 */
export function clearAllInterpreterSessions() {
  const key = storageKey();
  if (!key.startsWith(INTERPRETER_STORE_PREFIX)) {
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode or disabled storage */
  }
}

/**
 * @param {string|null} sessionId
 */
export function setCurrentSessionId(sessionId) {
  const store = readStore();
  if (sessionId != null && !store.sessions.some((s) => s.sessionId === sessionId)) {
    return;
  }
  persistSessions(store.sessions, sessionId);
}

/** @returns {string} */
export function getInterpreterStorageKey() {
  return storageKey();
}
