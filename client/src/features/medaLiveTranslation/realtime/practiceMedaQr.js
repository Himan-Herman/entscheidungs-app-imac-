/**
 * Helpers for the practice Meda start-page QR code.
 *
 * This QR code opens the protected practice Meda start page only. It must not
 * contain patient data, transcript data, PDF content, or medical content.
 * The encoded value is purely the start URL with the practiceId query param.
 */

/**
 * Build the absolute URL to the practice Meda start page for a given practice.
 * @param {string} practiceId
 * @returns {string} e.g. https://host/practice/meda-realtime?practiceId=abc
 */
export function buildPracticeMedaUrl(practiceId) {
  const url = new URL('/practice/meda-realtime', window.location.origin);
  url.searchParams.set('practiceId', practiceId);
  return url.toString();
}

/** Lowercase ASCII slug for filenames; falls back to '' when nothing usable. */
function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '')           // trim hyphens
    .slice(0, 40);
}

/**
 * Filename for the downloaded QR PNG. Prefers a practice-name slug, otherwise
 * falls back to the practiceId, otherwise a generic name.
 * @param {string} practiceId
 * @param {string} [practiceName]
 * @returns {string}
 */
export function practiceMedaQrFileName(practiceId, practiceName) {
  const slug = slugify(practiceName) || slugify(practiceId);
  return `medscoutx-praxis-meda-qr-${slug || 'praxis'}.png`;
}
