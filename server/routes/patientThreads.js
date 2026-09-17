/**
 * Patient messaging threads — /api/patient/threads
 *
 * AUTHORIZATION
 * -------------
 * Scope comes exclusively from the authenticated user id (`req.user.userId`).
 * A patient never supplies a patientUserId, practiceId or linkId that is used
 * to scope a query — every service call filters on the session's own user id,
 * so a manipulated identifier can only ever produce `thread_not_found`.
 *
 * CONSENT (C-2 / C-4) — deliberately asymmetric, see the policy block in
 * services/communication/practicePatientThreadService.js:
 *   reading  own conversation -> no consent gate (the patient is the data
 *                                subject; this also keeps the history readable
 *                                after the relationship ended, which is an
 *                                access question, not a retention one),
 *   writing  into it          -> requires the messaging consent, which
 *                                `linkHasConsentType` denies for links that are
 *                                no longer usable.
 */

import express from "express";
import { requireCommunicationV2Feature } from "../middleware/requireCommunicationV2.js";
import { requireCommunicationAiDraftsFeature } from "../middleware/requireCommunicationAiDrafts.js";
import {
  addMessageFromPatient,
  archiveThreadForPatient,
  restoreThreadForPatient,
  getThreadForPatientUser,
  listThreadsForPatient,
  markThreadRead,
} from "../services/communication/practicePatientThreadService.js";
import { parseIncludeArchived } from "../utils/lifecycleStatus.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { generatePatientMessageAiDraft } from "../services/communication/messageCommunicationAiService.js";

const router = express.Router();

router.use(requireCommunicationV2Feature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "validation_required" || msg === "validation_text_too_long") {
    return { status: 400, error: msg };
  }
  if (msg === "thread_not_found" || msg === "link_not_found") {
    return { status: 404, error: msg };
  }
  if (msg === "consent_required") {
    return { status: 403, error: msg };
  }
  if (
    msg === "link_not_active" ||
    msg === "thread_closed" ||
    msg === "thread_archived" ||
    msg === "thread_not_archived"
  ) {
    return { status: 409, error: msg };
  }
  if (msg === "ai_not_configured") {
    return { status: 503, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

/** GET /api/patient/threads */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const threads = await listThreadsForPatient(userId, {
      includeArchived: parseIncludeArchived(req),
    });
    return res.json({ ok: true, threads });
  } catch (err) {
    console.error("[patient/threads/list]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * GET /api/patient/threads/:threadId — READ-ONLY (C-3).
 *
 * This used to call markThreadRead() as a side effect, so merely fetching a
 * thread flipped its read state. Read state now changes only through the
 * explicit `PATCH /:threadId/read` acknowledgement below — otherwise the later
 * "edit/withdraw only while unread" rule could never be enforced, because a
 * prefetch would already have consumed the window.
 */
router.get("/:threadId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const thread = await getThreadForPatientUser(req.params.threadId, userId);

    writeAuditLog({
      userId,
      actorRole: "patient",
      action: "patient_thread_viewed",
      entityType: "PracticePatientThread",
      entityId: thread.id,
    });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("[patient/threads/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

async function handlePatientMessagePost(req, res) {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const thread = await addMessageFromPatient({
      threadId: req.params.threadId,
      patientUserId: userId,
      body: req.body?.body,
      // Optional idempotency key for ONE logical send action.
      clientRequestId: req.body?.clientRequestId,
    });

    writeAuditLog({
      userId,
      actorRole: "patient",
      action: "patient_thread_message_sent",
      entityType: "PracticePatientThread",
      entityId: thread.id,
    });

    return res.status(201).json({ ok: true, thread });
  } catch (err) {
    console.error("[patient/threads/message]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
}

/** POST /api/patient/messages/:threadId (alias) */
router.post("/:threadId", handlePatientMessagePost);

/** POST /api/patient/threads/:threadId/messages */
router.post("/:threadId/messages", handlePatientMessagePost);

/**
 * PATCH /api/patient/threads/:threadId/read — explicit read acknowledgement.
 *
 * Idempotent: the underlying update is conditional on `readAt: null`, so
 * repeating or racing this call keeps the first timestamp and changes nothing
 * else.
 */
router.patch("/:threadId/read", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const thread = await markThreadRead(req.params.threadId, "patient", {
      patientUserId: userId,
    });

    writeAuditLog({
      userId,
      actorRole: "patient",
      action: "patient_thread_read",
      entityType: "PracticePatientThread",
      entityId: req.params.threadId,
    });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("[patient/threads/read]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/patient/threads/:threadId/archive */
router.patch("/:threadId/archive", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const thread = await archiveThreadForPatient(req.params.threadId, userId);

    writeAuditLog({
      userId,
      actorRole: "patient",
      action: "patient_thread_archived",
      entityType: "PracticePatientThread",
      entityId: thread.id,
    });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("[patient/threads/archive]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/patient/threads/:threadId/restore */
router.patch("/:threadId/restore", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const thread = await restoreThreadForPatient(req.params.threadId, userId);

    writeAuditLog({
      userId,
      actorRole: "patient",
      action: "patient_thread_restored",
      entityType: "PracticePatientThread",
      entityId: thread.id,
    });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("[patient/threads/restore]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * POST /api/patient/messages/:threadId/ai-rewrite
 *
 * Off by default (COMMUNICATION_AI_DRAFTS): the only patient route here that
 * sends conversation content to an external AI provider.
 */
router.post("/:threadId/ai-rewrite", requireCommunicationAiDraftsFeature, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const draft = await generatePatientMessageAiDraft({
      threadId: req.params.threadId,
      patientUserId: userId,
      locale: req.body?.locale || req.headers["accept-language"],
      mode: req.body?.mode || "rewrite",
      draftInput: req.body?.draftInput || req.body?.body,
    });

    writeAuditLog({
      userId,
      actorRole: "patient",
      action: "patient_thread_ai_draft",
      entityType: "PracticePatientThread",
      entityId: req.params.threadId,
    });

    return res.json({ ok: true, ...draft });
  } catch (err) {
    console.error("[patient/threads/ai-rewrite]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
