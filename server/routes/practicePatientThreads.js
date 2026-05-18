/**
 * Practice messaging on a care link — /api/practice/patients/:linkId/threads
 */

import express from "express";
import { requireCommunicationV2Feature } from "../middleware/requireCommunicationV2.js";
import {
  getPracticeAccess,
  canReadPracticePatientLinks,
  canWritePracticePatientLinks,
  canPracticeRestoreFromArchive,
} from "../utils/practiceAccess.js";
import { parseIncludeArchived } from "../utils/lifecycleStatus.js";
import {
  archiveThreadForPractice,
  restoreThreadForPractice,
  addMessageFromPractice,
  closeThread,
  createThread,
  getThread,
  listThreadsForPractice,
  markThreadRead,
} from "../services/communication/practicePatientThreadService.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { generatePracticeMessageAiDraft } from "../services/communication/messageCommunicationAiService.js";

const router = express.Router({ mergeParams: true });

router.use(requireCommunicationV2Feature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function practiceIdFromReq(req) {
  return String(
    req.query.practiceId || req.body?.practiceId || "",
  ).trim();
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (
    msg === "validation_required" ||
    msg === "validation_text_too_long"
  ) {
    return { status: 400, error: msg };
  }
  if (msg === "link_not_found" || msg === "thread_not_found") {
    return { status: 404, error: msg };
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

function threadAuditMeta(ctx, thread) {
  return {
    practiceProfileId: ctx.practiceId,
    practicePatientLinkId: ctx.linkId,
    patientUserId: thread?.patientUserId ?? null,
  };
}

function requirePracticeAccess(req, res) {
  const userId = userIdFromReq(req);
  if (!userId) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return null;
  }
  const practiceId = practiceIdFromReq(req);
  if (!practiceId) {
    res.status(400).json({ ok: false, error: "practiceId_required" });
    return null;
  }
  return { userId, practiceId, linkId: req.params.linkId };
}

/** GET / */
router.get("/", async (req, res) => {
  const ctx = requirePracticeAccess(req, res);
  if (!ctx) return;

  const access = await getPracticeAccess(ctx.userId, ctx.practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const threads = await listThreadsForPractice(ctx.linkId, ctx.practiceId, {
      includeArchived: parseIncludeArchived(req),
    });
    return res.json({ ok: true, threads });
  } catch (err) {
    console.error("[practice/threads/list]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST / */
router.post("/", async (req, res) => {
  const ctx = requirePracticeAccess(req, res);
  if (!ctx) return;

  const access = await getPracticeAccess(ctx.userId, ctx.practiceId);
  if (!access || !canWritePracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const thread = await createThread({
      linkId: ctx.linkId,
      practiceProfileId: ctx.practiceId,
      subject: req.body?.subject,
      body: req.body?.body,
      senderUserId: ctx.userId,
    });

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: access.role,
      action: "practice_thread_created",
      entityType: "practice_patient_thread",
      entityId: thread.id,
      metadata: threadAuditMeta(ctx, thread),
    });

    return res.status(201).json({ ok: true, thread });
  } catch (err) {
    console.error("[practice/threads/create]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /:threadId */
router.get("/:threadId", async (req, res) => {
  const ctx = requirePracticeAccess(req, res);
  if (!ctx) return;

  const access = await getPracticeAccess(ctx.userId, ctx.practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    await getThread(req.params.threadId, ctx.practiceId, ctx.linkId);
    await markThreadRead(req.params.threadId, "practice", {
      practiceProfileId: ctx.practiceId,
      linkId: ctx.linkId,
    });
    const refreshed = await getThread(
      req.params.threadId,
      ctx.practiceId,
      ctx.linkId,
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: access.role,
      action: "practice_thread_read",
      entityType: "PracticePatientThread",
      entityId: req.params.threadId,
    });

    return res.json({ ok: true, thread: refreshed });
  } catch (err) {
    console.error("[practice/threads/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /:threadId/messages */
router.post("/:threadId/messages", async (req, res) => {
  const ctx = requirePracticeAccess(req, res);
  if (!ctx) return;

  const access = await getPracticeAccess(ctx.userId, ctx.practiceId);
  if (!access || !canWritePracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const thread = await addMessageFromPractice({
      threadId: req.params.threadId,
      practiceProfileId: ctx.practiceId,
      linkId: ctx.linkId,
      senderUserId: ctx.userId,
      body: req.body?.body,
    });

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: access.role,
      action: "practice_thread_message_sent",
      entityType: "PracticePatientThread",
      entityId: thread.id,
    });

    return res.status(201).json({ ok: true, thread });
  } catch (err) {
    console.error("[practice/threads/message]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /:threadId/read */
router.patch("/:threadId/read", async (req, res) => {
  const ctx = requirePracticeAccess(req, res);
  if (!ctx) return;

  const access = await getPracticeAccess(ctx.userId, ctx.practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const thread = await markThreadRead(req.params.threadId, "practice", {
      practiceProfileId: ctx.practiceId,
      linkId: ctx.linkId,
    });

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: access.role,
      action: "practice_thread_read",
      entityType: "PracticePatientThread",
      entityId: req.params.threadId,
    });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("[practice/threads/read]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /:threadId/ai-reply-draft */
router.post("/:threadId/ai-reply-draft", async (req, res) => {
  const ctx = requirePracticeAccess(req, res);
  if (!ctx) return;

  const access = await getPracticeAccess(ctx.userId, ctx.practiceId);
  if (!access || !canWritePracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const draft = await generatePracticeMessageAiDraft({
      linkId: ctx.linkId,
      practiceProfileId: ctx.practiceId,
      threadId: req.params.threadId,
      locale: req.body?.locale || req.headers["accept-language"],
      mode: req.body?.mode || "reply_draft",
      draftInput: req.body?.draftInput,
    });

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: access.role,
      action: "practice_thread_ai_draft",
      entityType: "PracticePatientThread",
      entityId: req.params.threadId,
    });

    return res.json({ ok: true, ...draft });
  } catch (err) {
    console.error("[practice/threads/ai-draft]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /:threadId/close */
router.patch("/:threadId/close", async (req, res) => {
  const ctx = requirePracticeAccess(req, res);
  if (!ctx) return;

  const access = await getPracticeAccess(ctx.userId, ctx.practiceId);
  if (!access || !canWritePracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const thread = await closeThread(
      req.params.threadId,
      ctx.practiceId,
      ctx.linkId,
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: access.role,
      action: "practice_thread_closed",
      entityType: "practice_patient_thread",
      entityId: thread.id,
      metadata: threadAuditMeta(ctx, thread),
    });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("[practice/threads/close]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /:threadId/archive */
router.patch("/:threadId/archive", async (req, res) => {
  const ctx = requirePracticeAccess(req, res);
  if (!ctx) return;

  const access = await getPracticeAccess(ctx.userId, ctx.practiceId);
  if (!access || !canWritePracticePatientLinks(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const thread = await archiveThreadForPractice(
      req.params.threadId,
      ctx.practiceId,
      ctx.linkId,
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: access.role,
      action: "practice_thread_archived",
      entityType: "practice_patient_thread",
      entityId: thread.id,
      metadata: threadAuditMeta(ctx, thread),
    });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("[practice/threads/archive]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /:threadId/restore */
router.patch("/:threadId/restore", async (req, res) => {
  const ctx = requirePracticeAccess(req, res);
  if (!ctx) return;

  const access = await getPracticeAccess(ctx.userId, ctx.practiceId);
  if (!access || !canPracticeRestoreFromArchive(access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const thread = await restoreThreadForPractice(
      req.params.threadId,
      ctx.practiceId,
      ctx.linkId,
    );

    await writeAuditLog({
      userId: ctx.userId,
      actorRole: access.role,
      action: "practice_thread_restored",
      entityType: "practice_patient_thread",
      entityId: thread.id,
      metadata: threadAuditMeta(ctx, thread),
    });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("[practice/threads/restore]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
