import { geocodeAddress } from "./geocoding.js";

/** Common country names → ISO 3166-1 alpha-2 (for Google region/components bias). */
const COUNTRY_TO_ISO = {
  de: "DE",
  deu: "DE",
  deutschland: "DE",
  germany: "DE",
  at: "AT",
  aut: "AT",
  österreich: "AT",
  oesterreich: "AT",
  austria: "AT",
  ch: "CH",
  che: "CH",
  schweiz: "CH",
  switzerland: "CH",
  fr: "FR",
  fra: "FR",
  france: "FR",
  frankreich: "FR",
  nl: "NL",
  nld: "NL",
  netherlands: "NL",
  niederlande: "NL",
  be: "BE",
  bel: "BE",
  belgium: "BE",
  belgien: "BE",
  it: "IT",
  ita: "IT",
  italy: "IT",
  italien: "IT",
  es: "ES",
  esp: "ES",
  spain: "ES",
  spanien: "ES",
  gb: "GB",
  gbr: "GB",
  uk: "GB",
  "united kingdom": "GB",
  england: "GB",
  großbritannien: "GB",
  grossbritannien: "GB",
  us: "US",
  usa: "US",
  "united states": "US",
  "vereinigte staaten": "US",
};

function normalizeCountryKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * @param {string} country
 * @returns {string | null} ISO region code (e.g. DE)
 */
export function resolveCountryCode(country) {
  const raw = String(country || "").trim();
  if (!raw) return null;
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  return COUNTRY_TO_ISO[normalizeCountryKey(raw)] || null;
}

function buildLocationQuery({ country, postalCode, city, addressLine }) {
  return [addressLine, postalCode, city, country].filter(Boolean).join(", ");
}

/**
 * Ordered geocode query variants — try most specific first, then simpler fallbacks.
 * @param {{ country: string, postalCode?: string, city?: string, addressLine?: string }} input
 * @returns {string[]}
 */
export function buildGeocodeCandidates(input) {
  const c = String(input.country || "").trim();
  const pc = String(input.postalCode || "").trim();
  const cityT = String(input.city || "").trim();
  const addr = String(input.addressLine || "").trim();
  const seen = new Set();
  const out = [];

  const add = (q) => {
    const s = String(q || "").trim();
    if (!s || s === c || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  if (addr && pc && cityT) add(`${addr}, ${pc} ${cityT}, ${c}`);
  if (addr && cityT) add(`${addr}, ${cityT}, ${c}`);
  if (pc && cityT) add(`${pc} ${cityT}, ${c}`);
  if (pc && cityT) add(`${pc}, ${cityT}, ${c}`);
  if (pc) add(`${pc}, ${c}`);
  if (cityT) add(`${cityT}, ${c}`);
  add(buildLocationQuery({ country: c, postalCode: pc, city: cityT, addressLine: addr }));

  return out;
}

export function hasManualLocationFields(input) {
  return !!(
    String(input.postalCode || "").trim() ||
    String(input.city || "").trim() ||
    String(input.addressLine || "").trim()
  );
}

/**
 * Geocode manual address with country bias and fallback queries.
 * @param {object} input
 * @param {string} language
 */
export async function geocodeManualLocation(input, language) {
  const country = String(input.country || "").trim();
  const region = resolveCountryCode(country);
  const candidates = buildGeocodeCandidates({
    country,
    postalCode: input.postalCode,
    city: input.city,
    addressLine: input.addressLine,
  });

  if (!candidates.length) {
    throw new Error("validation_location_required");
  }

  let lastError = null;
  for (let i = 0; i < candidates.length; i++) {
    const query = candidates[i];
    const isLast = i === candidates.length - 1;
    const opts = region && !isLast ? { region } : {};
    try {
      return await geocodeAddress(query, language, opts);
    } catch (err) {
      lastError = err;
      if (err?.message !== "geocode_zero") throw err;
    }
  }
  throw lastError || new Error("geocode_zero");
}
