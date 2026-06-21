/** @typedef {import('@prisma/client').PracticeProfile} PracticeProfile */

export const PRACTICE_BRANDING_SELECT = {
  id: true,
  practiceName: true,
  displayNameForPatients: true,
  logoUrl: true,
  logoStorageKey: true,
  logoMimeType: true,
  accentColor: true,
  patientIntroText: true,
  specialty: true,
};

/**
 * Patient-facing display name (never empty when practiceName exists).
 * @param {Pick<PracticeProfile, 'practiceName' | 'displayNameForPatients'>} row
 */
export function practiceDisplayName(row) {
  const custom = String(row.displayNameForPatients || "").trim();
  if (custom) return custom.slice(0, 200);
  return String(row.practiceName || "").trim();
}

/** Short, non-reversible content version so a replaced logo busts the HTTP cache. */
function shortVersion(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/**
 * Logo URL for clients (uploaded logo uses API path).
 * @param {Pick<PracticeProfile, 'id' | 'logoUrl' | 'logoStorageKey'>} row
 */
export function practiceLogoUrl(row) {
  if (row.logoStorageKey && row.id) {
    return `/api/practice/settings/logo-file?practiceId=${encodeURIComponent(
      row.id,
    )}&v=${shortVersion(row.logoStorageKey)}`;
  }
  const external = String(row.logoUrl || "").trim();
  return external || null;
}

/**
 * @param {Pick<PracticeProfile, keyof typeof PRACTICE_BRANDING_SELECT>} row
 */
export function practiceBrandingJson(row) {
  return {
    id: row.id,
    practiceName: row.practiceName,
    displayName: practiceDisplayName(row),
    logoUrl: practiceLogoUrl(row),
    accentColor: normalizeAccentColor(row.accentColor),
    patientHint: row.patientIntroText ? String(row.patientIntroText).trim().slice(0, 1200) : null,
    specialty: row.specialty ? String(row.specialty).trim().slice(0, 160) : null,
  };
}

/**
 * @param {string | null | undefined} value
 */
export function normalizeAccentColor(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(v)) return null;
  return v.toUpperCase();
}

/**
 * Relative luminance (sRGB) for contrast checks.
 * @param {string} hex #RRGGBB
 */
function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * Accent must be usable as UI chrome (contrast vs white background ≥ 3:1).
 * @param {string | null | undefined} hex
 */
export function isAccentColorAccessible(hex) {
  const normalized = normalizeAccentColor(hex);
  if (!normalized) return false;
  const L1 = luminance(normalized);
  const L2 = luminance("#FFFFFF");
  const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  return ratio >= 3;
}

const FORBIDDEN_MARKETING = [
  /\bbeste\s+praxis\b/i,
  /\bbest(e|er|es)?\s+(clinic|practice|arztpraxis)\b/i,
  /\bheil(t|ung|en|versprechen)\b/i,
  /\bgarantiert(e|er|es)?\s+(heilung|genesung|behandlung)\b/i,
  /\b100\s*%\s*(heilung|erfolg|sicher)\b/i,
  /\bmedizinisch\s+bewiesen\b/i,
  /\bsofortige\s+heilung\b/i,
  /\bcure(s|d)?\s+(all|every)\b/i,
  /\bbest\s+practice\s+in\b/i,
  /\b#1\s+(doctor|clinic|practice)\b/i,
];

/**
 * @param {string} text
 */
export function containsForbiddenMarketingClaims(text) {
  const s = String(text || "");
  if (!s.trim()) return false;
  return FORBIDDEN_MARKETING.some((re) => {
    re.lastIndex = 0;
    return re.test(s);
  });
}
