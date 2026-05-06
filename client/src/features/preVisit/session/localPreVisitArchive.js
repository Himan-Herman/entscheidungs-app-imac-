export const PREVISIT_ARCHIVE_KEY = "medscoutx_previsit_archive";

function readArchiveArray() {
  try {
    const raw = localStorage.getItem(PREVISIT_ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArchiveArray(items) {
  localStorage.setItem(PREVISIT_ARCHIVE_KEY, JSON.stringify(items));
}

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Appends one archive snapshot (local only, no network).
 * @param {object} session — shape like medscoutx_previsit_session (needs answers)
 * @returns {{ id: string, createdAt: string, patientLanguage: string, doctorLanguage: string, answers: object }}
 */
export function savePreVisitArchiveItem(session) {
  if (!session?.answers || typeof session.answers !== "object") {
    throw new Error("savePreVisitArchiveItem: session with answers required");
  }

  const patientLanguage = session.patientLanguage || "de";
  const doctorLanguage =
    session.doctorLanguage || session.patientLanguage || "de";

  const item = {
    id: newId(),
    createdAt: new Date().toISOString(),
    patientLanguage,
    doctorLanguage,
    answers: JSON.parse(JSON.stringify(session.answers)),
  };

  const list = readArchiveArray();
  list.push(item);
  writeArchiveArray(list);
  return item;
}

/** @returns {Array<{ id, createdAt, patientLanguage, doctorLanguage, answers }>} */
export function listPreVisitArchiveItems() {
  return readArchiveArray();
}

export function deletePreVisitArchiveItem(id) {
  const list = readArchiveArray().filter((x) => x && x.id !== id);
  writeArchiveArray(list);
}

export function clearPreVisitArchive() {
  try {
    localStorage.removeItem(PREVISIT_ARCHIVE_KEY);
  } catch {
    /* ignore */
  }
}
