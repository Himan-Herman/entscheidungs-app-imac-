/**
 * Practice messaging on a care link — /api/practice/patients/:linkId/threads
 */

import express from "express";
import { requireCommunicationV2Feature } from "../middleware/requireCommunicationV2.js";
import {
  getPracticeAccess,
  canReadPracticePatientLinks,
  canWritePracticePatientLinks,
} from "../utils/practiceAccess.js";
import {
  archiveThreadForPractice,
  addMessageFromPractice,
  closeThread,
  createThread,
  getThread,
  listThreadsForPractice,
  markThreadRead,
} from "../services/communication/practicePatientThreadService.js";
import { writeAuditLog } from "../services/auditLogService.js";

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
    msg === "thread_archived"
  ) {
    return { status: 409, error: msg };
  }
  return { status: 500, error: "request_failed" };
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
    const threads = await listThreadsForPractice(ctx.linkId, ctx.practiceId);
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
      entityType: "PracticePatientThread",
      entityId: thread.id,
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
    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("[practice/threads/archive]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
