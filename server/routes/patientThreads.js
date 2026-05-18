/**
 * Patient messaging threads — /api/patient/threads
 */

import express from "express";
import { requireCommunicationV2Feature } from "../middleware/requireCommunicationV2.js";
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

/** GET /api/patient/threads/:threadId */
router.get("/:threadId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    await markThreadRead(req.params.threadId, "patient", { patientUserId: userId });
    const thread = await getThreadForPatientUser(req.params.threadId, userId);

    await writeAuditLog({
      userId,
      actorRole: "patient",
      action: "patient_thread_read",
      entityType: "PracticePatientThread",
      entityId: req.params.threadId,
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
    });

    await writeAuditLog({
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

/** PATCH /api/patient/threads/:threadId/read */
router.patch("/:threadId/read", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const thread = await markThreadRead(req.params.threadId, "patient", {
      patientUserId: userId,
    });

    await writeAuditLog({
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

    await writeAuditLog({
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

    await writeAuditLog({
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

/** POST /api/patient/messages/:threadId/ai-rewrite */
router.post("/:threadId/ai-rewrite", async (req, res) => {
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

    await writeAuditLog({
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
