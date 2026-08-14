/**
 * Request shape contract for the (phase 2B) translation endpoint.
 *
 * The single most important property of this feature is that it can only ever
 * translate a document that already exists inside MedScoutX and was released by
 * an authorised practice to this patient. That property is destroyed the moment
 * the request body can carry a document itself — as raw text, as a URL, as an
 * upload, or as a "content" field someone adds later for convenience.
 *
 * So the body is parsed against a closed allowlist: exactly three keys, nothing
 * else. An unknown key is a hard rejection rather than something ignored,
 * because silently ignoring `text` is indistinguishable from accepting it when
 * someone later wires it up.
 *
 * The document identity itself (documentId) is NOT taken from the body at all —
 * it comes from the route path, and the patient identity comes from the
 * verified session.
 */

import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
} from "./documentTranslationPolicy.js";

/** The only keys the endpoint will ever read. */
export const ALLOWED_REQUEST_KEYS = Object.freeze(["fileId", "mode", "targetLanguage"]);

/**
 * Keys that must never appear. Any of these means someone is trying to supply a
 * document source instead of referencing an existing one.
 *
 * This list is belt-and-braces: the allowlist above already rejects them. It
 * exists so the failure is explicit and greppable, and so the test suite can
 * assert on the exact names rather than on "some unknown key".
 */
export const FORBIDDEN_SOURCE_KEYS = Object.freeze([
  "text",
  "content",
  "url",
  "file",
  "upload",
  "externalUrl",
  "documentText",
  "html",
  "base64",
  "buffer",
  "sourceUrl",
  "fileUrl",
  "attachment",
  "body",
  "prompt",
  "systemPrompt",
]);

const ALLOWED = new Set(ALLOWED_REQUEST_KEYS);
const FORBIDDEN = new Set(FORBIDDEN_SOURCE_KEYS.map((k) => k.toLowerCase()));

/**
 * Parse and validate a translation request body.
 *
 * @param {unknown} body
 * @returns {{ fileId: string, mode: unknown, targetLanguage: unknown }}
 *   mode and targetLanguage are returned unvalidated on purpose — policy owns
 *   their vocabulary (assertTranslationRequestAllowed), this owns the shape.
 */
export function parseTranslationRequestBody(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.INVALID_MODE, {
      reason: "body_not_object",
    });
  }

  // Own enumerable keys only; a prototype-polluted object cannot smuggle a key
  // past the allowlist this way.
  for (const key of Object.keys(body)) {
    if (FORBIDDEN.has(key.toLowerCase())) {
      throw new DocumentTranslationError(TRANSLATION_ERRORS.UNSUPPORTED_FILE_TYPE, {
        reason: "external_document_source_rejected",
        key,
      });
    }
    if (!ALLOWED.has(key)) {
      throw new DocumentTranslationError(TRANSLATION_ERRORS.UNSUPPORTED_FILE_TYPE, {
        reason: "unknown_request_key",
        key,
      });
    }
  }

  // Deliberately not trimmed: the provenance gate validates the id against a
  // strict character class, and normalising here would hide a manipulated value
  // from the layer whose job it is to reject it.
  const fileId = typeof body.fileId === "string" ? body.fileId : "";
  if (!fileId) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.FILE_NOT_FOUND, {
      reason: "missing_file_id",
    });
  }

  return { fileId, mode: body.mode, targetLanguage: body.targetLanguage };
}
