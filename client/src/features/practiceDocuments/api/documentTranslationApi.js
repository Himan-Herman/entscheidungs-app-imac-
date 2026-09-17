/**
 * API client for document transformation.
 *
 * The only network surface the feature has. The component never calls fetch
 * itself, and the request body is built by
 * translation/documentTranslationOptions.js rather than assembled from
 * component state — the endpoint rejects unknown keys with a 400, and building
 * the body in one place is what keeps that from ever being exercised by
 * accident.
 *
 * The client knows one endpoint and no provider. There is deliberately no
 * mention of a model, a vendor or a base URL anywhere in this feature: which
 * provider performs the transformation is a server implementation question.
 */

import { authFetch } from "../../../api/authFetch.js";
import { buildTranslationRequestBody } from "../translation/documentTranslationOptions.js";
import { noteDocumentTranslationDisabledResponse } from "../translation/documentTranslationFeatureFlag.js";

/**
 * Request a transformation of one file of one practice document.
 *
 * @param {object} input
 * @param {string} input.documentId
 * @param {string} input.fileId
 * @param {string} input.targetLanguage
 * @param {string} input.mode
 * @param {AbortSignal} [input.signal] aborts the in-flight request when the
 *   component unmounts or the patient starts over; the server also aborts its
 *   provider call when the client goes away.
 * @returns {Promise<{ res: Response, data: Record<string, unknown> }>}
 */
export async function translatePracticeDocument(input) {
  const body = buildTranslationRequestBody({
    fileId: input.fileId,
    targetLanguage: input.targetLanguage,
    mode: input.mode,
  });

  const res = await authFetch(
    `/api/patient/practice-documents/${encodeURIComponent(input.documentId)}/translate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: input.signal,
    },
  );

  const data = await res.json().catch(() => ({}));
  noteDocumentTranslationDisabledResponse(res, data);
  return { res, data };
}
