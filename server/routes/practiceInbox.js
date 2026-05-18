/**
 * Practice central inbox — operational items only.
 * GET/PATCH /api/practice/inbox
 */

import express from "express";
import { requirePracticeInboxFeature } from "../middleware/requirePracticeInbox.js";
import {
  getPracticeAccess,
  canReadPracticePatientLinks,
  canPracticeRestoreFromArchive,
} from "../utils/practiceAccess.js";
import {
  listPracticeInboxItems,
  getPracticeInboxItem,
  markPracticeInboxRead,
  markPracticeInboxDone,
  archivePracticeInboxItem,
  restorePracticeInboxItem,
  countNewPracticeInbox,
  INBOX_TYPES,
} from "../services/practiceInbox/practiceInboxService.js";
import { generatePracticeInboxAiAssist } from "../services/practiceInbox/practiceInboxAiService.js";
import { generatePracticeInboxListAiSummary } from "../services/practiceInbox/practiceInboxListAiService.js";
import { writeAuditLog } from "../services/auditLogService.js";

const router = express.Router();

router.use(requirePracticeInboxFeature);

function userIdFromReq(req) {
  const id = req.user?.userId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function mapError(err) {
  const msg = err?.message || "request_failed";
  if (msg === "practiceId_required" || msg === "validation_required") {
    return { status: 400, error: msg };
  }
  if (msg === "validation_invalid_type") return { status: 400, error: msg };
  if (msg === "item_not_found") return { status: 404, error: msg };
  if (msg === "item_archived" || msg === "item_not_archived") return { status: 409, error: msg };
  if (msg === "ai_not_configured") return { status: 503, error: msg };
  if (msg === "forbidden") return { status: 403, error: msg };
  return { status: 500, error: "request_failed" };
}

async function requirePracticeRead(req, practiceId) {
  const userId = userIdFromReq(req);
  if (!userId) return { error: { status: 401, body: { ok: false, error: "unauthorized" } } };

  const access = await getPracticeAccess(userId, practiceId);
  if (!access || !canReadPracticePatientLinks(access.role)) {
    return { error: { status: 403, body: { ok: false, error: "forbidden" } } };
  }
  return { userId, access };
}

/** GET /api/practice/inbox/count?practiceId= */
router.get("/count", async (req, res) => {
  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const ctx = await requirePracticeRead(req, practiceId);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  try {
    const newCount = await countNewPracticeInbox(practiceId);
    return res.json({ ok: true, newCount, unreadCount: newCount });
  } catch (err) {
    console.error("[practice/inbox/count]", err?.message ?? err);
    return res.status(500).json({ ok: false, error: "request_failed" });
  }
});

/** POST /api/practice/inbox/ai-summary */
router.post("/ai-summary", async (req, res) => {
  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const ctx = await requirePracticeRead(req, practiceId);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  try {
    const result = await generatePracticeInboxListAiSummary(
      practiceId,
      {
        locale: req.body?.locale || req.query.locale,
        userId: ctx.userId,
        actorRole: ctx.access.role,
      },
      { req },
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[practice/inbox/ai-summary]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/practice/inbox?practiceId=&filter=&type=&q=&sort= */
router.get("/", async (req, res) => {
  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const ctx = await requirePracticeRead(req, practiceId);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  const filter = String(req.query.filter || "all").trim();
  let status;
  let workflowStatus;
  if (filter === "unread" || filter === "new") status = "new";
  else if (filter === "archived") status = "archived";
  else if (filter === "read") status = "read";
  else if (filter === "done") status = "done";
  else if (filter === "in_progress") workflowStatus = "in_progress";
  else if (filter === "forwarded") workflowStatus = "forwarded";

  const assignmentFilter = String(req.query.assignmentFilter || "").trim();
  const type = String(req.query.type || "").trim();
  const typeFilter = type && INBOX_TYPES.has(type) ? type : undefined;

  try {
    const result = await listPracticeInboxItems(practiceId, {
      status,
      workflowStatus,
      assignmentFilter,
      actorUserId: ctx.userId,
      type: typeFilter,
      q: req.query.q,
      sort: req.query.sort,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_inbox_opened",
      entityType: "inbox_item",
      entityId: practiceId,
      practiceProfileId: practiceId,
      metadata: { itemCount: result.items.length },
    });

    return res.json({ ok: true, role: ctx.access.role, practiceId, ...result });
  } catch (err) {
    console.error("[practice/inbox/list]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** GET /api/practice/inbox/:itemId?practiceId= */
router.get("/:itemId", async (req, res) => {
  const practiceId = String(req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const ctx = await requirePracticeRead(req, practiceId);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  try {
    const result = await getPracticeInboxItem(req.params.itemId, practiceId);
    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_inbox_item_opened",
      entityType: "inbox_item",
      entityId: req.params.itemId,
      metadata: { type: result.item.type },
    });
    return res.json({ ok: true, role: ctx.access.role, ...result });
  } catch (err) {
    console.error("[practice/inbox/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/practice/inbox/:itemId/read */
router.patch("/:itemId/read", async (req, res) => {
  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const ctx = await requirePracticeRead(req, practiceId);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  try {
    const item = await markPracticeInboxRead(req.params.itemId, practiceId);
    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_inbox_item_read",
      entityType: "inbox_item",
      entityId: item.id,
      metadata: { type: item.type },
    });
    return res.json({ ok: true, item });
  } catch (err) {
    console.error("[practice/inbox/read]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/practice/inbox/:itemId/done */
router.patch("/:itemId/done", async (req, res) => {
  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const ctx = await requirePracticeRead(req, practiceId);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  try {
    const item = await markPracticeInboxDone(req.params.itemId, practiceId);
    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_inbox_item_done",
      entityType: "inbox_item",
      entityId: item.id,
      metadata: { type: item.type },
    });
    return res.json({ ok: true, item });
  } catch (err) {
    console.error("[practice/inbox/done]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/practice/inbox/:itemId/archive */
router.patch("/:itemId/archive", async (req, res) => {
  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const ctx = await requirePracticeRead(req, practiceId);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  try {
    const item = await archivePracticeInboxItem(req.params.itemId, practiceId);
    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_inbox_item_archived",
      entityType: "inbox_item",
      entityId: item.id,
      metadata: { type: item.type },
    });
    return res.json({ ok: true, item });
  } catch (err) {
    console.error("[practice/inbox/archive]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /api/practice/inbox/:itemId/restore */
router.patch("/:itemId/restore", async (req, res) => {
  const practiceId = String(req.body?.practiceId || req.query.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const ctx = await requirePracticeRead(req, practiceId);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);
  if (!canPracticeRestoreFromArchive(ctx.access.role)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  try {
    const item = await restorePracticeInboxItem(req.params.itemId, practiceId);
    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_inbox_item_restored",
      entityType: "inbox_item",
      entityId: item.id,
      metadata: { type: item.type },
    });
    return res.json({ ok: true, item });
  } catch (err) {
    console.error("[practice/inbox/restore]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/inbox/:itemId/ai-summary */
router.post("/:itemId/ai-summary", async (req, res) => {
  const practiceId = String(req.body?.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const ctx = await requirePracticeRead(req, practiceId);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  try {
    const locale = req.body?.locale || req.query.locale || "de";
    const result = await generatePracticeInboxAiAssist(
      practiceId,
      req.params.itemId,
      "summary",
      locale,
    );
    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_inbox_ai_summary_created",
      entityType: "inbox_item",
      entityId: req.params.itemId,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[practice/inbox/ai-summary]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /api/practice/inbox/:itemId/ai-reply-draft */
router.post("/:itemId/ai-reply-draft", async (req, res) => {
  const practiceId = String(req.body?.practiceId || "").trim();
  if (!practiceId) {
    return res.status(400).json({ ok: false, error: "practiceId_required" });
  }

  const ctx = await requirePracticeRead(req, practiceId);
  if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

  try {
    const locale = req.body?.locale || req.query.locale || "de";
    const result = await generatePracticeInboxAiAssist(
      practiceId,
      req.params.itemId,
      "reply_draft",
      locale,
    );
    await writeAuditLog({
      req,
      userId: ctx.userId,
      actorRole: ctx.access.role,
      action: "practice_inbox_ai_reply_draft_created",
      entityType: "inbox_item",
      entityId: req.params.itemId,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[practice/inbox/ai-reply-draft]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

export default router;
