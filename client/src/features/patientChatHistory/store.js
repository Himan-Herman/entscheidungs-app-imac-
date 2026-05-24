import {
  CHAT_KIND_BODY_MAP,
  CHAT_KIND_SYMPTOM_CHECK,
  HISTORY_STORE_PREFIX,
  HISTORY_STORE_VERSION,
  SESSION_STATUS_DRAFT,
} from "./constants.js";
import { deriveSessionStatus, newSessionId } from "./sessionUtils.js";

/** @typedef {import('./types.js').PatientChatSession} PatientChatSession */
/** @typedef {import('./types.js').PatientChatStore} PatientChatStore */

function getUserId() {
  try {
    return localStorage.getItem("medscout_user_id") || "anonymous";
  } catch {
    return "anonymous";
  }
}

function storageKey() {
  return `${HISTORY_STORE_PREFIX}_${getUserId()}`;
}

function readStore() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== HISTORY_STORE_VERSION) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function emptyStore() {
  return {
    version: HISTORY_STORE_VERSION,
    bodyMap: { activeId: null, items: [] },
    symptomCheck: { activeId: null, items: [] },
  };
}

function writeStore(store) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

function bucketKey(kind) {
  return kind === CHAT_KIND_BODY_MAP ? "bodyMap" : "symptomCheck";
}

/**
 * @param {string} kind
 */
export function listSessions(kind, { organFilter } = {}) {
  const store = readStore();
  const bucket = store[bucketKey(kind)];
  let items = [...(bucket.items || [])];
  if (organFilter && kind === CHAT_KIND_BODY_MAP) {
    items = items.filter((s) => s.organ === organFilter);
  }
  return items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/**
 * @param {string} kind
 * @param {string} id
 */
export function getSession(kind, id) {
  const store = readStore();
  return (store[bucketKey(kind)].items || []).find((s) => s.id === id) || null;
}

export function getActiveSessionId(kind) {
  return readStore()[bucketKey(kind)].activeId;
}

/**
 * @param {PatientChatSession} session
 */
export function upsertSession(session) {
  const store = readStore();
  const key = bucketKey(session.kind);
  const items = [...(store[key].items || [])];
  const idx = items.findIndex((s) => s.id === session.id);
  const existing = idx >= 0 ? items[idx] : null;
  const next = {
    ...existing,
    ...session,
    status: deriveSessionStatus({ ...existing, ...session }),
    updatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt || session.createdAt || new Date().toISOString(),
  };
  if (idx >= 0) items[idx] = next;
  else items.push(next);
  store[key] = { ...store[key], items };
  writeStore(store);
  return next;
}

/**
 * @param {string} kind
 * @param {string} id
 */
export function setActiveSession(kind, id) {
  const store = readStore();
  const key = bucketKey(kind);
  store[key] = { ...store[key], activeId: id };
  writeStore(store);
}

/**
 * @param {string} kind
 * @param {string} id
 */
export function deleteSession(kind, id) {
  const store = readStore();
  const key = bucketKey(kind);
  const bucket = store[key];
  const items = (bucket.items || []).filter((s) => s.id !== id);
  let activeId = bucket.activeId;
  if (activeId === id) {
    activeId = items[0]?.id || null;
  }
  store[key] = { activeId, items };
  writeStore(store);
  return activeId;
}

/**
 * @param {string} kind
 * @param {Partial<PatientChatSession>} seed
 */
export function createSession(kind, seed = {}) {
  const now = new Date().toISOString();
  const session = {
    id: newSessionId(),
    kind,
    createdAt: now,
    updatedAt: now,
    title: "",
    status: SESSION_STATUS_DRAFT,
    threadId: null,
    verlauf: [],
    summary: null,
    language: "de",
    ...seed,
  };
  session.status = deriveSessionStatus(session);
  const store = readStore();
  const key = bucketKey(kind);
  store[key] = {
    activeId: session.id,
    items: [...(store[key].items || []), session],
  };
  writeStore(store);
  return session;
}

/**
 * Migrate legacy single-chat localStorage into first session if store empty.
 * @param {string} kind
 * @param {{ legacy: object, buildSession: (id: string) => PatientChatSession }} opts
 */
export function migrateLegacyIfNeeded(kind, { legacy, buildSession }) {
  const store = readStore();
  const key = bucketKey(kind);
  if ((store[key].items || []).length > 0) return store[key].activeId;

  const hasLegacy =
    (legacy.verlauf && legacy.verlauf.length > 0) ||
    legacy.threadId ||
    legacy.summary;

  if (!hasLegacy) return null;

  const id = newSessionId();
  const session = buildSession(id);
  session.status = deriveSessionStatus(session);
  store[key] = {
    activeId: id,
    items: [session],
  };
  writeStore(store);
  return id;
}

/**
 * Remove legacy keys after migration (optional cleanup).
 */
export function clearLegacyKeys(keys) {
  try {
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
