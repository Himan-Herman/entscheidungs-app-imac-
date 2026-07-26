/**
 * Vitals snapshot for the Pre-Visit document.
 *
 * Data minimisation (Art. 5(1)(c) GDPR) is the whole point of this module:
 * only the MOST RECENT value per measurement type, only within a recent window,
 * and NEVER the free-text `notes` field (it may hold unrelated personal detail).
 *
 * Pure functions — no network, no storage, no side effects. Documentation only:
 * no diagnosis, no assessment, no interpretation.
 */

/** Measurement types that may appear in a snapshot, in stable display order. */
export const SNAPSHOT_TYPE_ORDER = [
  "blood_pressure",
  "heart_rate",
  "glucose",
  "weight",
  "oxygen",
  "temperature",
];

const TYPE_SET = new Set(SNAPSHOT_TYPE_ORDER);

/** Only readings from the last N days are considered relevant for an upcoming visit. */
export const DEFAULT_MAX_AGE_DAYS = 90;

/** Snapshot format version — lets the practice side stay compatible if the shape evolves. */
export const SNAPSHOT_VERSION = 1;

function toTime(value) {
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : NaN;
}

/**
 * Build a data-minimised snapshot: latest reading per type within the age window.
 *
 * @param {Array<object>} entries raw vital entries from /api/patient/vitals
 * @param {{maxAgeDays?: number, now?: number}} [options]
 * @returns {{version:number, createdAt:string, maxAgeDays:number, items:Array<object>}|null}
 *          null when there is nothing worth attaching
 */
export function buildVitalsSnapshot(entries, options = {}) {
  const maxAgeDays = Number.isFinite(options.maxAgeDays) && options.maxAgeDays > 0
    ? options.maxAgeDays
    : DEFAULT_MAX_AGE_DAYS;
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const cutoff = now - maxAgeDays * 86_400_000;

  if (!Array.isArray(entries) || entries.length === 0) return null;

  /** @type {Map<string, object>} */
  const latestByType = new Map();

  for (const e of entries) {
    if (!e || !TYPE_SET.has(e.type)) continue;
    const measured = toTime(e.measuredAt);
    if (!Number.isFinite(measured)) continue;
    if (measured < cutoff || measured > now) continue;
    const primary = Number(e.valuePrimary);
    if (!Number.isFinite(primary)) continue;

    const prev = latestByType.get(e.type);
    if (prev && toTime(prev.measuredAt) >= measured) continue;

    const secondary = Number(e.valueSecondary);
    latestByType.set(e.type, {
      type: e.type,
      valuePrimary: primary,
      valueSecondary: e.type === "blood_pressure" && Number.isFinite(secondary) ? secondary : null,
      unit: typeof e.unit === "string" ? e.unit.slice(0, 20) : "",
      measuredAt: new Date(measured).toISOString(),
      // Provenance so the practice can tell a device reading from a hand-typed one.
      source: e.source === "import" ? "import" : "manual",
      sourceProvider: e.source === "import" && typeof e.sourceProvider === "string"
        ? e.sourceProvider.slice(0, 40)
        : null,
      sourceDevice: typeof e.sourceDevice === "string" ? e.sourceDevice.slice(0, 40) : null,
      // `notes` is deliberately omitted — data minimisation.
    });
  }

  if (latestByType.size === 0) return null;

  const items = SNAPSHOT_TYPE_ORDER
    .filter((t) => latestByType.has(t))
    .map((t) => latestByType.get(t));

  return {
    version: SNAPSHOT_VERSION,
    createdAt: new Date(now).toISOString(),
    maxAgeDays,
    items,
  };
}

/**
 * Format a single reading's value (no unit).
 * @param {object} item
 */
export function formatSnapshotValue(item) {
  if (!item) return "";
  if (item.type === "blood_pressure" && Number.isFinite(item.valueSecondary)) {
    return `${Math.round(item.valuePrimary)}/${Math.round(item.valueSecondary)}`;
  }
  const v = item.valuePrimary;
  return String(Number.isInteger(v) ? v : Number(v.toFixed(1)));
}

/**
 * Render the snapshot as plain text lines (used by the PDF and the on-screen preview).
 *
 * @param {object|null} snapshot
 * @param {{typeLabels?: Record<string,string>, locale?: string, importedLabel?: string}} [labels]
 * @returns {string[]}
 */
export function formatSnapshotLines(snapshot, labels = {}) {
  if (!snapshot || !Array.isArray(snapshot.items)) return [];
  const typeLabels = labels.typeLabels || {};
  const locale = labels.locale || "de";
  const originLabels = labels.originLabels || {};

  return snapshot.items.map((item) => {
    const name = typeLabels[item.type] || item.type;
    const value = formatSnapshotValue(item);
    const unit = item.unit ? ` ${item.unit}` : "";

    // The real measurement time — never the sync time. Date AND time are shown so a
    // doctor can tell a morning reading from an evening one.
    let when = String(item.measuredAt).slice(0, 16).replace("T", " ");
    try {
      when = new Date(item.measuredAt).toLocaleString(locale, {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { /* keep the ISO fallback */ }

    const origin = resolveOriginLabel(item, originLabels);
    return `${name}: ${value}${unit}\n${labels.measuredAtWord || "Gemessen"}: ${when}` +
           (origin ? `\n${labels.sourceWord || "Quelle"}: ${origin}` : "");
  });
}

/**
 * Human-readable origin. A device is only ever named when the platform metadata
 * positively identified it; otherwise we fall back to the platform, and never to a
 * guess like "Apple Watch".
 */
export function resolveOriginLabel(item, originLabels = {}) {
  if (!item) return "";
  if (item.source !== "import") return originLabels.manual || "";

  const platform = originLabels[item.sourceProvider] || "";
  const device = item.sourceDevice ? originLabels[item.sourceDevice] : "";
  if (platform && device) return `${platform} – ${device}`;
  return device || platform || "";
}

/**
 * Defensive shape check — used before trusting a snapshot that came from storage.
 * @param {unknown} snapshot
 */
export function isValidSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (!Array.isArray(snapshot.items) || snapshot.items.length === 0) return false;
  return snapshot.items.every(
    (i) => i && TYPE_SET.has(i.type) && Number.isFinite(Number(i.valuePrimary))
  );
}
