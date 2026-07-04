/**
 * Encode/decode a patient medication list into a URL fragment payload.
 *
 * The data is carried in the URL hash (`#d=...`), which the browser never sends
 * to the server. So a QR code built from this URL lets anyone (e.g. a doctor
 * with no MedScoutX account) open a read-only view of the list — while the
 * server never receives or stores the health data. No login, no backend.
 *
 * Payload keys are short to keep the QR small:
 *   v = schema version, l = language, n = patient name, g = generated ISO,
 *   m = [{ n:name, d:dosage, s:schedule, b:startDate, e:endDate, i:instructions,
 *          c:createdAt }]
 */

const SHARE_PATH = "/m";
const HASH_PREFIX = "#d=";

function toBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  const b64 = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/** @param {object} payload */
export function encodeSharePayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return toBase64Url(bytes);
}

/** @param {string} encoded @returns {object|null} */
export function decodeSharePayload(encoded) {
  try {
    const bytes = fromBase64Url(encoded);
    const json = new TextDecoder().decode(bytes);
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

/**
 * Build the compact payload from own-medication entries.
 * @param {{ entries: Array, patientName?: string, generatedAt?: Date, lang?: string }} args
 */
export function buildSharePayload({ entries, patientName, generatedAt, lang }) {
  return {
    v: 1,
    l: String(lang || "de").toLowerCase().slice(0, 5),
    n: (patientName || "").trim().slice(0, 120) || undefined,
    g: (generatedAt instanceof Date ? generatedAt : new Date()).toISOString(),
    m: (Array.isArray(entries) ? entries : []).map((e) => ({
      n: String(e.name || "").slice(0, 160),
      d: e.dosage ? String(e.dosage).slice(0, 120) : undefined,
      s: e.schedule ? String(e.schedule).slice(0, 120) : undefined,
      b: e.startDate || undefined,
      e: e.endDate || undefined,
      i: e.instructions ? String(e.instructions).slice(0, 240) : undefined,
      c: e.createdAt || undefined,
    })),
  };
}

/** Full shareable URL (origin + public route + data fragment). */
export function buildShareUrl(payload, origin) {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${SHARE_PATH}${HASH_PREFIX}${encodeSharePayload(payload)}`;
}

/** Read + decode the payload from the current location hash (viewer side). */
export function readSharePayloadFromHash(hash) {
  const raw = String(hash || "");
  const idx = raw.indexOf(HASH_PREFIX);
  if (idx === -1) return null;
  return decodeSharePayload(raw.slice(idx + HASH_PREFIX.length));
}

export { SHARE_PATH };
