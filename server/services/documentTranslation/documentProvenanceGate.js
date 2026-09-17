/**
 * Provenance gate for patient-facing document translation.
 *
 * This is the single security boundary of the feature. Everything downstream —
 * extraction, segmentation, masking, and later any model call — runs only on a
 * document that passed here.
 *
 * ── Why this exists next to loadSharedDocumentForPatient, not inside it ──────
 * loadSharedDocumentForPatient() is the shared read gate behind four live
 * endpoints (list, detail, download, secure token). It does NOT check the
 * underlying PracticePatientLink: a document stays readable after the practice
 * relationship is revoked, because revokeLink() does not cascade to
 * PracticeDocumentShare. Whether that should change is a product and data
 * protection decision about already-delivered documents, and it is explicitly
 * out of scope here — tightening it would silently change four endpoints.
 *
 * So this module reuses that loader unchanged for the checks it does perform,
 * and adds the missing ones on top. It deliberately does NOT issue its own
 * PracticeDocument query: a second, more convenient lookup is exactly how an
 * access filter drifts out of sync with the one it was meant to mirror.
 *
 * ── The nine cumulative conditions ──────────────────────────────────────────
 *   1 document belongs to the logged-in patient      (loadSharedDocumentForPatient)
 *   2 document status is "shared"                    (loadSharedDocumentForPatient)
 *   3 an active, unexpired PracticeDocumentShare     (loadSharedDocumentForPatient)
 *   4 document is not deleted                        (loadSharedDocumentForPatient)
 *   5 practicePatientLinkId is present               (here)
 *   6 the link belongs to the same patient AND the same origin practice (here)
 *   7 the link status is valid for this use case     (here)
 *   8 fileId belongs to exactly this document        (here)
 *   9 the document type is on the translation allowlist (here)
 *
 * Deny-by-default: every path that is not an explicit success throws.
 */

import { prisma } from "../../lib/prisma.js";
import { isDocumentTranslationEnabled } from "../../config/featureFlags.js";
import { loadSharedDocumentForPatient } from "../practiceDocument/practiceDocumentService.js";
import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
  assertTranslationRequestAllowed,
} from "./documentTranslationPolicy.js";

/**
 * Link states accepted for translation.
 *
 * Deliberately narrower than the document module's LINK_ACTIVE
 * ({invited, active}) and the secure-link module's PRACTICE_LINK_USABLE.
 * "invited" means the patient has not accepted the practice relationship yet;
 * running an AI transformation over a document under an unaccepted relationship
 * is precisely the case to refuse. Being stricter in a NEW path is safe —
 * loosening the existing ones would not be, and is not done here.
 */
export const TRANSLATION_LINK_STATUSES = Object.freeze(new Set(["active"]));

/**
 * File types V1 can extract. Everything else is refused before any I/O.
 * Images and legacy .doc have no local text path and are not guessed at.
 */
export const TRANSLATABLE_MIME_TYPES = Object.freeze(
  new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
);

/**
 * Resolve and authorise a document + file for translation.
 *
 * @param {object} input
 * @param {string} input.documentId
 * @param {string} input.fileId
 * @param {string} input.patientUserId  from the verified session, never from the body
 * @param {unknown} input.mode
 * @param {unknown} input.targetLanguage
 * @returns {Promise<{
 *   document: import('@prisma/client').PracticeDocument,
 *   file: import('@prisma/client').PracticeDocumentFile,
 *   link: { id: string, status: string, practiceProfileId: string, patientUserId: string },
 *   mode: string,
 *   targetLanguage: string,
 * }>}
 */
export async function assertTranslatableDocumentForPatient(input) {
  if (!isDocumentTranslationEnabled()) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.FEATURE_DISABLED);
  }

  const documentId = requiredId(input?.documentId);
  const fileId = requiredId(input?.fileId);
  const patientUserId = requiredId(input?.patientUserId);

  if (!documentId || !fileId || !patientUserId) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.DOCUMENT_NOT_FOUND);
  }

  // ── 1-4: ownership, shared status, active share, not deleted ──────────────
  // Reused verbatim. Its `where: { id, patientUserId }` puts ownership in the
  // query, so a foreign document never reaches this process.
  let document;
  try {
    document = await loadSharedDocumentForPatient(documentId, patientUserId);
  } catch (err) {
    throw mapSharedLoaderError(err);
  }

  // ── 9: type allowlist + mode + target language ────────────────────────────
  // Before any link lookup: a non-translatable type must not even cause a
  // relationship query to run.
  const { mode, targetLanguage } = assertTranslationRequestAllowed({
    type: document.type,
    mode: input?.mode,
    targetLanguage: input?.targetLanguage,
  });

  // ── 5: the document must be bound to a practice relationship ─────────────
  // practicePatientLinkId is nullable: the Meda PDF-QR flow stores practice
  // owned PDFs with no link and no patient. Those are unreachable through the
  // patient loader anyway, but this is asserted rather than assumed.
  const linkId = requiredId(document.practicePatientLinkId);
  if (!linkId) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.DOCUMENT_UNAVAILABLE, {
      reason: "no_practice_link",
    });
  }

  // ── 6 + 7: the link is this patient's, at the ORIGIN practice, and valid ──
  // All three identity conditions are in the query. A link belonging to another
  // patient or another practice simply does not match.
  const link = await prisma.practicePatientLink.findFirst({
    where: {
      id: linkId,
      patientUserId,
      practiceProfileId: document.practiceProfileId,
    },
    select: {
      id: true,
      status: true,
      practiceProfileId: true,
      patientUserId: true,
    },
  });

  if (!link) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.DOCUMENT_UNAVAILABLE, {
      reason: "link_mismatch",
    });
  }

  if (!TRANSLATION_LINK_STATUSES.has(link.status)) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.LINK_NOT_ACTIVE, {
      status: link.status,
    });
  }

  // ── 8: the file belongs to exactly this document ─────────────────────────
  // Taken from the already-loaded relation rather than a fresh query, so the
  // document scope cannot be lost between two lookups.
  const file = (document.files || []).find((f) => f.id === fileId);
  if (!file) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.FILE_NOT_FOUND);
  }

  if (!TRANSLATABLE_MIME_TYPES.has(String(file.mimeType || "").toLowerCase())) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.UNSUPPORTED_FILE_TYPE, {
      mimeType: file.mimeType,
    });
  }

  return { document, file, link, mode, targetLanguage };
}

/* ------------------------------------------------------------- internals */

/**
 * Identifiers must already be canonical — they are NOT normalised here.
 *
 * Trimming or lowercasing a security-relevant id is how one layer ends up
 * comparing a different string than the next one. These ids are machine
 * generated (cuid) and never legitimately contain whitespace, a path separator
 * or a dot, so anything outside this class is a manipulated value, not a typo.
 *
 * @param {unknown} v
 */
function requiredId(v) {
  if (typeof v !== "string") return null;
  return /^[A-Za-z0-9_-]{1,128}$/.test(v) ? v : null;
}

/**
 * Translate the shared loader's error vocabulary into ours without widening it.
 * An unrecognised message becomes document_not_found rather than leaking.
 * @param {unknown} err
 */
function mapSharedLoaderError(err) {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "document_unavailable") {
    return new DocumentTranslationError(TRANSLATION_ERRORS.DOCUMENT_UNAVAILABLE);
  }
  return new DocumentTranslationError(TRANSLATION_ERRORS.DOCUMENT_NOT_FOUND);
}
