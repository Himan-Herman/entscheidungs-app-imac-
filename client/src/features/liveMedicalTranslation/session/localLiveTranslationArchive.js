/** Local-only archive for live translation sessions (consent-based, no audio). */

export const LIVE_TRANSLATION_ARCHIVE_KEY = "medscoutx_live_translation_archive";

function readArchiveArray() {
  try {
    const raw = localStorage.getItem(LIVE_TRANSLATION_ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArchiveArray(items) {
  localStorage.setItem(LIVE_TRANSLATION_ARCHIVE_KEY, JSON.stringify(items));
}

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * @param {{ savedAt?: string; exportData?: { sessionEndedAt?: string; sessionStartedAt?: string } }} item
 */
export function getArchiveItemSortTime(item) {
  const ended = item?.exportData?.sessionEndedAt;
  const saved = item?.savedAt;
  const started = item?.exportData?.sessionStartedAt;
  const candidate = ended || saved || started;
  const time = candidate ? new Date(candidate).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

/**
 * @param {Array<{ id?: string; savedAt?: string; exportData?: object }>} items
 */
function sortArchiveItemsNewestFirst(items) {
  return [...items].sort((a, b) => getArchiveItemSortTime(b) - getArchiveItemSortTime(a));
}

/**
 * @param {ReturnType<typeof import("../utils/sessionMetadata.js").buildExportMetadata>} exportData
 */
export function saveLiveTranslationArchiveItem(exportData) {
  if (!exportData || typeof exportData !== "object") {
    throw new Error("saveLiveTranslationArchiveItem: exportData required");
  }

  const item = {
    id: newId(),
    savedAt: new Date().toISOString(),
    exportData: JSON.parse(JSON.stringify(exportData)),
  };

  const list = readArchiveArray();
  list.unshift(item);
  writeArchiveArray(list);
  return item;
}

/** @returns {Array<{ id: string; savedAt: string; exportData: object }>} */
export function listLiveTranslationArchiveItems() {
  return sortArchiveItemsNewestFirst(readArchiveArray());
}

export function getLiveTranslationArchiveItem(id) {
  return readArchiveArray().find((x) => x && x.id === id) || null;
}

export function deleteLiveTranslationArchiveItem(id) {
  writeArchiveArray(readArchiveArray().filter((x) => x && x.id !== id));
}

export function clearLiveTranslationArchive() {
  try {
    localStorage.removeItem(LIVE_TRANSLATION_ARCHIVE_KEY);
  } catch {
    /* ignore */
  }
}
