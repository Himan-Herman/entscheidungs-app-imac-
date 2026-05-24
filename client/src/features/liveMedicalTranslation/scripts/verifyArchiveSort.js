/**
 * Unit checks for archive sort order (run with node).
 * node client/src/features/liveMedicalTranslation/scripts/verifyArchiveSort.js
 */
import {
  getArchiveItemSortTime,
  listLiveTranslationArchiveItems,
  LIVE_TRANSLATION_ARCHIVE_KEY,
} from "../session/localLiveTranslationArchive.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const older = {
  id: "older",
  savedAt: "2024-01-01T10:00:00.000Z",
  exportData: { sessionEndedAt: "2024-01-01T10:05:00.000Z", patientName: "A" },
};
const newer = {
  id: "newer",
  savedAt: "2025-06-01T12:00:00.000Z",
  exportData: { sessionEndedAt: "2025-06-01T12:30:00.000Z", patientName: "B" },
};

assert(
  getArchiveItemSortTime(newer) > getArchiveItemSortTime(older),
  "newer sort time after older",
);

const original = globalThis.localStorage;
const store = new Map();

globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
};

store.set(LIVE_TRANSLATION_ARCHIVE_KEY, JSON.stringify([older, newer]));

const listed = listLiveTranslationArchiveItems();
assert(listed[0]?.id === "newer", "newest item listed first");
assert(listed[1]?.id === "older", "older item listed second");

globalThis.localStorage = original;

console.log("verifyArchiveSort: OK");
