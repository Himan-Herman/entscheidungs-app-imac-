import { authFetch } from "../../../api/authFetch.js";

const BASE = "/api/user/doctor-contacts";

/** List the patient's saved doctor contacts (Ärztebuch). */
export async function fetchDoctorContacts() {
  const res = await authFetch(BASE);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/**
 * Email a patient-generated PDF to one doctor contact.
 * Reuses the existing consent-gated, rate-limited send endpoint; nothing is
 * stored server-side after the email is sent.
 *
 * @param {string} contactId
 * @param {Blob}   pdfBlob
 * @param {string} filename
 * @param {string} locale  ("de" | "en" — server normalizes)
 */
export async function sendMedicationPdfToContact(contactId, pdfBlob, filename, locale) {
  const fd = new FormData();
  fd.append("pdf", pdfBlob, filename);
  fd.append("emailSendConsent", "true");
  fd.append("locale", String(locale || "de"));
  const res = await authFetch(
    `${BASE}/${encodeURIComponent(contactId)}/send-previsit-pdf`,
    { method: "POST", body: fd },
  );
  const data = await res.json().catch(() => ({}));
  return { res, data };
}
