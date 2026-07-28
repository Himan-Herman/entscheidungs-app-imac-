/**
 * Patient-controlled document share grants — /api/patient
 *
 *   POST /practice-documents/:documentId/share-grants   release one document
 *   GET  /document-share-grants                          own overview
 *   POST /document-share-grants/:grantId/revoke          withdraw
 *
 * Patient authentication only. There is no practice-facing counterpart on
 * purpose: a practice must never be able to create, activate or extend a
 * grant, and it cannot ask for one either — that would be a request channel
 * into the patient's decision, which is out of scope here.
 */

import express from "express";
import { requirePracticeDocumentsV2Feature } from "../middleware/requirePracticeDocumentsV2.js";
import {
  assertOnlyAllowedCreateFields,
  createDocumentShareGrant,
  grantErrorResponse,
  grantToPatientJson,
  listDocumentShareGrantsForPatient,
  revokeDocumentShareGrant,
} from "../services/practiceDocument/documentShareGrantService.js";

// Mounted on /api/patient, so the feature gate is applied per route rather than
// with router.use — otherwise a disabled flag would 404 every patient endpoint.
const router = express.Router();

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function fail(res, err, tag) {
  const mapped = grantErrorResponse(err);
  if (mapped.status === 500) console.error(`[${tag}]`, err?.message ?? err);
  return res.status(mapped.status).json({ ok: false, error: mapped.error });
}

/**
 * POST /api/patient/practice-documents/:documentId/share-grants
 * Body: { targetPracticePatientLinkId }
 *
 * Everything else — patient, source practice, source link, target practice,
 * status, granting user, timestamps — is derived by the server. Sending any of
 * them is a 400, not a silently ignored field.
 */
router.post("/practice-documents/:documentId/share-grants", requirePracticeDocumentsV2Feature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    assertOnlyAllowedCreateFields(req.body);
    const { grant, created } = await createDocumentShareGrant({
      patientUserId: userId,
      documentId: req.params.documentId,
      targetPracticePatientLinkId: req.body?.targetPracticePatientLinkId,
      req,
    });
    // Idempotent: an identical active grant returns 200 with the same grant
    // rather than a conflict. Repeating the request is not an error, and the
    // existing release is not refreshed either.
    return res.status(created ? 201 : 200).json({
      ok: true,
      created,
      grant: grantToPatientJson(grant),
    });
  } catch (err) {
    return fail(res, err, "patient/document-share-grants/create");
  }
});

/** GET /api/patient/document-share-grants */
router.get("/document-share-grants", requirePracticeDocumentsV2Feature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const grants = await listDocumentShareGrantsForPatient(userId);
    return res.json({ ok: true, grants });
  } catch (err) {
    return fail(res, err, "patient/document-share-grants/list");
  }
});

/**
 * POST /api/patient/document-share-grants/:grantId/revoke
 *
 * An explicit action rather than a DELETE: the grant is kept as the record of
 * who was allowed to read the document and when. A second revoke changes
 * nothing and returns the already-revoked state.
 */
router.post("/document-share-grants/:grantId/revoke", requirePracticeDocumentsV2Feature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const { grant, revoked } = await revokeDocumentShareGrant({
      patientUserId: userId,
      grantId: req.params.grantId,
      req,
    });
    return res.json({ ok: true, revoked, grant: grantToPatientJson(grant) });
  } catch (err) {
    return fail(res, err, "patient/document-share-grants/revoke");
  }
});

export default router;
