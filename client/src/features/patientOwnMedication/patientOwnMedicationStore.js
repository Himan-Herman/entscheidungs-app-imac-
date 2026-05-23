/**
 * B2C patient-owned medication entries — device-local storage only.
 */

const STORAGE_PREFIX = "medscoutx_patient_own_meds_v1";

function storageKey() {
  try {
    const userId = localStorage.getItem("medscout_user_id") || "anonymous";
    return `${STORAGE_PREFIX}_${userId}`;
  } catch {
    return `${STORAGE_PREFIX}_anonymous`;
  }
}

function emptyStore() {
  return {
    version: 1,
    reminderConsent: false,
    entries: [],
  };
}

function readRaw() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyStore();
    return {
      version: 1,
      reminderConsent: parsed.reminderConsent === true,
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.filter((e) => e && typeof e.id === "string")
        : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function generateOwnMedicationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `med_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function listOwnMedications() {
  return readRaw().entries.sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
  );
}

export function getReminderConsent() {
  return readRaw().reminderConsent === true;
}

export function setReminderConsent(enabled) {
  const store = readRaw();
  store.reminderConsent = enabled === true;
  writeStore(store);
  return store.reminderConsent;
}

export function upsertOwnMedication(entry) {
  const store = readRaw();
  const idx = store.entries.findIndex((e) => e.id === entry.id);
  const next = { ...entry, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    store.entries[idx] = { ...store.entries[idx], ...next };
  } else {
    store.entries.push({
      ...next,
      createdAt: next.createdAt || new Date().toISOString(),
    });
  }
  writeStore(store);
  return next;
}

export function deleteOwnMedication(id) {
  const store = readRaw();
  const before = store.entries.length;
  store.entries = store.entries.filter((e) => e.id !== id);
  writeStore(store);
  return store.entries.length < before;
}

export function daysUntilEnd(endDateIso) {
  if (!endDateIso) return null;
  try {
    const end = new Date(endDateIso);
    end.setHours(23, 59, 59, 999);
    const diff = end.getTime() - Date.now();
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  } catch {
    return null;
  }
}
