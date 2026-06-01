/**
 * Local-only archive for Meda Realtime conversations.
 * All data stays in localStorage on this device.
 * No data is uploaded or sent to any server.
 */

const ARCHIVE_KEY = 'medscoutx_meda_realtime_archive';
const MAX_ENTRIES = 20;

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function readArchive() {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArchive(entries) {
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(entries));
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

/**
 * Returns all archived conversations, newest first.
 * @returns {Array}
 */
export function getArchivedConversations() {
  return readArchive().slice().reverse();
}

/**
 * Builds a storable archive entry from the current session.
 * Only completed turns are kept. No audio, no debug events, no API keys.
 */
export function buildArchiveEntry({
  turns,
  patientInfo,
  practiceInfo,
  patientLanguage,
  practiceLanguage,
  sessionStartedAt,
}) {
  const cleanTurns = (turns ?? [])
    .filter(t => t.isDone && (t.originalText || t.translatedText))
    .map(t => ({
      key:            t.key,
      speakerRole:    t.speakerRole    ?? null,
      sourceLanguage: t.sourceLanguage ?? null,
      targetLanguage: t.targetLanguage ?? null,
      originalText:   t.originalText   ?? null,
      translatedText: t.translatedText ?? null,
      isUnclear:      t.isUnclear      ?? false,
      originalEdited: t.originalEdited ?? false,
      timestamp:      t.timestamp      ?? null,
    }));

  return {
    id:               newId(),
    createdAt:        new Date().toISOString(),
    sessionStartedAt: sessionStartedAt ?? null,
    patientName:      String(patientInfo?.name ?? '').trim() || null,
    practiceName:     String(practiceInfo?.practiceName ?? '').trim() || null,
    patientLanguage:  patientLanguage  ?? null,
    practiceLanguage: practiceLanguage ?? null,
    patientInfo:      patientInfo  ?? {},
    practiceInfo:     practiceInfo ?? {},
    turns:            cleanTurns,
  };
}

/**
 * Saves an archive entry locally.
 * Removes the oldest entry when MAX_ENTRIES is exceeded.
 * @returns {object} The saved entry.
 */
export function saveArchivedConversation(entry) {
  const list = readArchive();
  list.push(entry);
  while (list.length > MAX_ENTRIES) {
    list.shift();
  }
  writeArchive(list);
  return entry;
}

/**
 * Deletes a single archive entry by id.
 */
export function deleteArchivedConversation(id) {
  const list = readArchive().filter(e => e && e.id !== id);
  writeArchive(list);
}

/**
 * Deletes all archived conversations from localStorage.
 */
export function clearArchivedConversations() {
  try {
    localStorage.removeItem(ARCHIVE_KEY);
  } catch {
    /* ignore */
  }
}
