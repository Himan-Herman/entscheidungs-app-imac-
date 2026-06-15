import { authFetch } from '../../../api/authFetch.js';

/**
 * Upload a rendered Meda session PDF blob and obtain a time-limited, token-only
 * download link from the backend (POST /api/practice/meda/pdf-link).
 *
 * Only the practice id, a generic filename and the explicit consent flag travel
 * with the PDF blob as multipart/form-data. No patient data and no conversation
 * content are sent as JSON. The returned `url` is the secure token link the QR
 * code encodes — it contains no patient data or conversation content.
 *
 * @param {{
 *   practiceId: string,
 *   blob: Blob,
 *   fileName?: string,
 *   sessionStartedAt?: string|null,
 *   patientLanguage?: string,
 *   practiceLanguage?: string,
 * }} input
 * @returns {Promise<{ url: string, expiresAt: string, tokenId: string, documentId: string }>}
 * @throws {Error} with `.code` (e.g. 'feature_disabled', 'consent_required', 'forbidden')
 */
export async function createMedaPdfLink({
  practiceId,
  blob,
  fileName,
  sessionStartedAt,
  patientLanguage,
  practiceLanguage,
}) {
  const name = fileName || 'meda-protokoll.pdf';
  const fd = new FormData();
  fd.set('practiceId', practiceId);
  fd.set('consentPdfQr', 'true');
  fd.set('fileName', name);
  if (sessionStartedAt)  fd.set('sessionStartedAt', sessionStartedAt);
  if (patientLanguage)   fd.set('patientLanguage', patientLanguage);
  if (practiceLanguage)  fd.set('practiceLanguage', practiceLanguage);
  fd.set('pdf', blob, name); // Content-Type boundary is set by the browser

  const res = await authFetch('/api/practice/meda/pdf-link', { method: 'POST', body: fd });
  let body = {};
  try { body = await res.json(); } catch { /* non-JSON error */ }

  if (!res.ok || !body.ok) {
    const code = body.error || `http_${res.status}`;
    const err = new Error(code);
    err.code = code;
    err.status = res.status;
    throw err;
  }
  return {
    url:        body.url,
    expiresAt:  body.expiresAt,
    tokenId:    body.tokenId,
    documentId: body.documentId,
  };
}
