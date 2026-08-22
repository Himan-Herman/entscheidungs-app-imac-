/**
 * Practice messaging on a care link — /api/practice/patients/:linkId/threads
 *
 * AUTHORIZATION (Phase 1' — C-1 / C-2 / C-5)
 * ------------------------------------------
 * Every route in this file goes through the single central guard
 * `requirePracticePatientLinkAccess()`. There is deliberately NO local
 * authorization logic left here:
 *
 *   - the tenant is derived FROM THE LINK, never from a client-supplied
 *     `practiceId` (a mismatching one is rejected, not obeyed),
 *   - permissions are checked against EFFECTIVE permissions (owner allowlist ∪
 *     active membership ∪ approved clinical role), not against a bare role
 *     string,
 *   - the patient's `secure_messaging` consent is required for READING too, not
 *     only for sending,
 *   - denials are logged as security events by the guard.
 *
 * Routes read their context from `req.linkAccess`, which the guard populates
 * with server-derived values. `req.params.linkId` and `req.query.practiceId`
 * must not be used to scope a query.
 */

import express from "express";
import { requireCommunicationV2Feature } from "../middleware/requireCommunicationV2.js";
import { requireCommunicationAiDraftsFeature } from "../middleware/requireCommunicationAiDrafts.js";
import { requirePracticePatientLinkAccess } from "../services/authorization/practicePatientLinkAuthorization.js";
import { PERMISSIONS } from "../utils/practicePermissions.js";
import { accessHasPermission } from "../utils/practiceAccess.js";
import { translateMessage } from "../services/messageTranslation/messageTranslationService.js";
import { MESSAGE_TRANSLATION_ERRORS } from "../services/messageTranslation/messageTranslationPolicy.js";
import { messageSttIpLimiter, messageTranslationIpLimiter } from "../middleware/ipRateLimit.js";
import { uploadDictation } from "../middleware/uploadDictation.js";
import { transcribeDictation } from "../services/messageSpeech/messageSttService.js";
import {
  MESSAGE_STT_ERRORS,
  MessageSttError,
} from "../services/messageSpeech/messageSttPolicy.js";
import { parseIncludeArchived } from "../utils/lifecycleStatus.js";
import {
  archiveThreadForPractice,
  restoreThreadForPractice,
  addMessageFromPractice,
  closeThread,
  createThread,
  editMessage,
  getThread,
  listThreadsForPractice,
  listThreadMessagesPage,
  markThreadRead,
  messageForViewer,
  withdrawMessage,
} from "../services/communication/practicePatientThreadService.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { generatePracticeMessageAiDraft } from "../services/communication/messageCommunicationAiService.js";

const router = express.Router({ mergeParams: true });

router.use(requireCommunicationV2Feature);

/**
 * Consent required to process this practice–patient communication at all.
 * Applied to reads as well as writes: without it the practice has no basis to
 * see the conversation, only to stop having it.
 */
const MESSAGING_CONSENT = "secure_messaging";

/**
 * Involving an external AI processor is a SEPARATE purpose from exchanging
 * messages, so the AI draft routes require the organizational-AI consent IN
 * ADDITION to the messaging consent. Holding one never implies the other.
 */
const AI_CONSENT = "ai_organizational_assistance";

/**
 * Reading the conversation. PATIENT_LINKS_READ is the existing right to see a
 * care relationship's content; combined with the consent gate above.
 */
const readAccess = requirePracticePatientLinkAccess({
  permission: PERMISSIONS.PATIENT_LINKS_READ,
  consentType: MESSAGING_CONSENT,
});

/**
 * Writing into the conversation. BOTH rights are required — this is exactly the
 * set that could write before (owner, admin, practice_manager, secretary,
 * doctor), so nothing widens, but a future grant of only one of the two can no
 * longer hand out send rights by accident.
 */
/** The exact permission set a write in this conversation requires. */
const WRITE_PERMISSIONS = Object.freeze([
  PERMISSIONS.PATIENT_LINKS_WRITE,
  PERMISSIONS.MESSAGES_SEND,
]);

const writeAccess = requirePracticePatientLinkAccess({
  permission: [...WRITE_PERMISSIONS],
  consentType: MESSAGING_CONSENT,
});

/** Restoring from archive stays the narrower settings-level right (owner/admin/practice_manager). */
const restoreAccess = requirePracticePatientLinkAccess({
  permission: [PERMISSIONS.PATIENT_LINKS_WRITE, PERMISSIONS.SETTINGS_MANAGE],
  consentType: MESSAGING_CONSENT,
});

/** AI drafting — messaging consent AND the separate external-processing consent. */
const aiDraftAccess = requirePracticePatientLinkAccess({
  permission: [PERMISSIONS.PATIENT_LINKS_WRITE, PERMISSIONS.MESSAGES_SEND],
  consentType: [MESSAGING_CONSENT, AI_CONSENT],
});

function mapError(err) {
  const msg = err?.message || "request_failed";
  // Translation refusals, mapped identically to the patient side so both
  // clients can share one set of messages.
  if (
    msg === MESSAGE_TRANSLATION_ERRORS.FEATURE_DISABLED ||
    msg === MESSAGE_TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED
  ) {
    return { status: 503, error: msg };
  }
  if (
    msg === MESSAGE_TRANSLATION_ERRORS.UNSUPPORTED_TARGET_LANGUAGE ||
    msg === MESSAGE_TRANSLATION_ERRORS.UNSUPPORTED_MODE ||
    msg === MESSAGE_TRANSLATION_ERRORS.MESSAGE_EMPTY ||
    msg === MESSAGE_TRANSLATION_ERRORS.MESSAGE_TOO_LONG
  ) {
    return { status: 400, error: msg };
  }
  // The alternative rendering could not be produced safely. Its own status:
  // nothing failed outside this system, and nothing about the request was
  // wrong — the answer was simply not safe to show, and the original stands.
  if (msg === MESSAGE_TRANSLATION_ERRORS.SIMPLE_UNSAFE) {
    return { status: 422, error: msg };
  }
  if (
    msg === MESSAGE_STT_ERRORS.FEATURE_DISABLED ||
    msg === MESSAGE_STT_ERRORS.PROVIDER_NOT_CONFIGURED
  ) {
    return { status: 503, error: msg };
  }
  if (
    msg === MESSAGE_STT_ERRORS.NO_AUDIO ||
    msg === MESSAGE_STT_ERRORS.AUDIO_TOO_SHORT ||
    msg === MESSAGE_STT_ERRORS.UNSUPPORTED_AUDIO_TYPE ||
    msg === MESSAGE_STT_ERRORS.AUDIO_MALFORMED ||
    msg === MESSAGE_STT_ERRORS.UNSUPPORTED_LANGUAGE
  ) {
    return { status: 400, error: msg };
  }
  if (msg === MESSAGE_STT_ERRORS.AUDIO_TOO_LARGE) return { status: 413, error: msg };
  if (
    msg === MESSAGE_STT_ERRORS.PROVIDER_FAILED ||
    msg === MESSAGE_STT_ERRORS.TRANSCRIPT_REJECTED
  ) {
    return { status: 502, error: msg };
  }
  if (
    msg === MESSAGE_TRANSLATION_ERRORS.PROVIDER_FAILED ||
    msg === MESSAGE_TRANSLATION_ERRORS.OUTPUT_REJECTED
  ) {
    return { status: 502, error: msg };
  }
  if (
    msg === "validation_required" ||
    msg === "validation_text_too_long" ||
    // The boundary or cursor names a message that is not in this conversation.
    // The thread was found; the caller's reference into it was not valid.
    msg === "message_not_in_thread"
  ) {
    return { status: 400, error: msg };
  }
  if (
    msg === "link_not_found" ||
    msg === "thread_not_found" ||
    msg === "message_not_found"
  ) {
    return { status: 404, error: msg };
  }
  if (msg === "consent_required") {
    return { status: 403, error: msg };
  }
  if (
    msg === "link_not_active" ||
    msg === "thread_closed" ||
    msg === "thread_archived" ||
    msg === "thread_not_archived" ||
    // The message is still there and still this member's own — it may simply no
    // longer be changed.
    msg === "message_already_read" ||
    msg === "message_withdrawn" ||
    msg === "message_not_mutable"
  ) {
    return { status: 409, error: msg };
  }
  if (msg === "ai_not_configured") {
    return { status: 503, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

/**
 * Server-derived request context. Everything here comes from the authorized
 * link, never from the request.
 * @param {import('express').Request} req
 */
function ctxFrom(req) {
  const a = req.linkAccess;
  return {
    userId: a.actorUserId,
    practiceId: a.practiceProfileId,
    linkId: a.linkId,
    role: a.role,
    actorUserId: a.actorUserId,
    // Whether this member could write here at all — asked with exactly the
    // permissions `writeAccess` demands, and ALL of them, mirroring the guard's
    // never-any-of rule. Read routes use it to decide which controls to offer;
    // it grants nothing.
    writable: WRITE_PERMISSIONS.every((p) => accessHasPermission(a.access ?? { role: a.role }, p)),
  };
}

function threadAuditMeta(ctx, thread) {
  return {
    practiceProfileId: ctx.practiceId,
    practicePatientLinkId: ctx.linkId,
    patientUserId: thread?.patientUserId ?? null,
  };
}

/** GET / — list threads on this link */
router.get("/", readAccess, async (req, res) => {
  const ctx = ctxFrom(req);
  try {
    const threads = await listThreadsForPractice(ctx.linkId, ctx.practiceId, {
      includeArchived: parseIncludeArchived(req),
      actorUserId: ctx.userId,
      actorRole: ctx.role,
    });
    return res.json({ ok: true, threads });
  } catch (err) {
    console.error("[practice/threads/list]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST / — open a thread */
router.post("/", writeAccess, async (req, res) => {
  const ctx = ctxFrom(req);
  try {
    const thread = await createThread({
      linkId: ctx.linkId,
      practiceProfileId: ctx.practiceId,
      subject: req.body?.subject,
      body: req.body?.body,
      senderUserId: ctx.userId,
      // Optional idempotency key for ONE logical send action; a retry carrying
      // the same key never persists a second message.
      clientRequestId: req.body?.clientRequestId,
    });

    writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.role,
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

/**
 * GET /:threadId — READ-ONLY (C-3).
 *
 * This used to mark the conversation as read as a side effect. It no longer
 * does: read state is only ever changed through the explicit
 * `PATCH /:threadId/read` acknowledgement below. A GET that mutates state makes
 * the later "edit/withdraw only while unread" rule impossible to enforce, and
 * marks messages read that were merely prefetched.
 */
router.get("/:threadId", readAccess, async (req, res) => {
  const ctx = ctxFrom(req);
  try {
    const thread = await getThread(req.params.threadId, ctx.practiceId, ctx.linkId, {
      actorUserId: ctx.userId,
      actorRole: ctx.role,
    });

    writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.role,
      action: "practice_thread_viewed",
      entityType: "PracticePatientThread",
      entityId: thread.id,
      metadata: threadAuditMeta(ctx, thread),
    });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("[practice/threads/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** POST /:threadId/messages */
router.post("/:threadId/messages", writeAccess, async (req, res) => {
  const ctx = ctxFrom(req);
  try {
    const thread = await addMessageFromPractice({
      threadId: req.params.threadId,
      practiceProfileId: ctx.practiceId,
      linkId: ctx.linkId,
      senderUserId: ctx.userId,
      body: req.body?.body,
      clientRequestId: req.body?.clientRequestId,
    });

    writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.role,
      action: "practice_thread_message_sent",
      entityType: "PracticePatientThread",
      entityId: thread.id,
      metadata: threadAuditMeta(ctx, thread),
    });

    return res.status(201).json({ ok: true, thread });
  } catch (err) {
    console.error("[practice/threads/message]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * PATCH /:threadId/read — explicit read acknowledgement (C-3).
 *
 * Idempotent: the underlying update is conditional on `readAt: null`, so a
 * repeated call changes nothing and keeps the original timestamps.
 */
router.patch("/:threadId/read", readAccess, async (req, res) => {
  const ctx = ctxFrom(req);
  try {
    /*
     * Same semantics as the patient side: the caller names the last message it
     * displayed, and only messages up to that point are acknowledged.
     *
     * Read state stays PARTY-level, not per practice member. Once any
     * authorized member of the practice has read a patient's message, it is
     * read as far as the patient is concerned — a per-employee receipt list
     * would say more about the practice's internal work than the patient needs
     * or should see.
     */
    const thread = await markThreadRead(req.params.threadId, "practice", {
      practiceProfileId: ctx.practiceId,
      linkId: ctx.linkId,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      throughMessageId: req.body?.throughMessageId,
    });

    writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.role,
      action: "practice_thread_read",
      entityType: "PracticePatientThread",
      entityId: thread.id,
      metadata: threadAuditMeta(ctx, thread),
    });

    return res.json({ ok: true, thread });
  } catch (err) {
    console.error("[practice/threads/read]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * GET /:threadId/messages?before=<id>&limit=50
 *
 * Older history, one page at a time — the same cursor the patient side uses, so
 * the two never disagree about what "the previous page" is.
 *
 * Read-only: paging is not acknowledgement.
 */
router.get("/:threadId/messages", readAccess, async (req, res) => {
  const ctx = ctxFrom(req);
  try {
    // The thread is authorized through the same gate the timeline uses, so a
    // page cannot be fetched for a conversation this practice may not read.
    await getThread(req.params.threadId, ctx.practiceId, ctx.linkId, ctx);

    const page = await listThreadMessagesPage(req.params.threadId, {
      before: req.query.before,
      limit: req.query.limit,
      ctx: { viewer: "practice", actorUserId: ctx.actorUserId, writable: ctx.writable },
    });
    return res.json({ ok: true, ...page });
  } catch (err) {
    console.error("[practice/threads/messages]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * POST /:threadId/ai-reply-draft
 *
 * Off by default (COMMUNICATION_AI_DRAFTS): this is the only route here that
 * sends conversation content to an external AI provider.
 */
router.post("/:threadId/ai-reply-draft", requireCommunicationAiDraftsFeature, aiDraftAccess, async (req, res) => {
  const ctx = ctxFrom(req);
  try {
    const draft = await generatePracticeMessageAiDraft({
      linkId: ctx.linkId,
      practiceProfileId: ctx.practiceId,
      threadId: req.params.threadId,
      locale: req.body?.locale || req.headers["accept-language"],
      mode: req.body?.mode || "reply_draft",
      draftInput: req.body?.draftInput,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
    });

    writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.role,
      action: "practice_thread_ai_draft",
      entityType: "PracticePatientThread",
      entityId: req.params.threadId,
      metadata: threadAuditMeta(ctx, null),
    });

    return res.json({ ok: true, ...draft });
  } catch (err) {
    console.error("[practice/threads/ai-draft]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/** PATCH /:threadId/close */
router.patch("/:threadId/close", writeAccess, async (req, res) => {
  const ctx = ctxFrom(req);
  try {
    const thread = await closeThread(req.params.threadId, ctx.practiceId, ctx.linkId, {
      actorUserId: ctx.userId,
      actorRole: ctx.role,
    });

    writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.role,
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
router.patch("/:threadId/archive", writeAccess, async (req, res) => {
  const ctx = ctxFrom(req);
  try {
    const thread = await archiveThreadForPractice(
      req.params.threadId,
      ctx.practiceId,
      ctx.linkId,
      { actorUserId: ctx.userId, actorRole: ctx.role },
    );

    writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.role,
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
router.patch("/:threadId/restore", restoreAccess, async (req, res) => {
  const ctx = ctxFrom(req);
  try {
    const thread = await restoreThreadForPractice(
      req.params.threadId,
      ctx.practiceId,
      ctx.linkId,
      { actorUserId: ctx.userId, actorRole: ctx.role },
    );

    writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.role,
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

/**
 * PATCH /:threadId/messages/:messageId — edit one's OWN message.
 *
 * Behind `writeAccess`: whoever may not write a new message in this
 * conversation may not rewrite an old one. Ownership is narrower still — the
 * service requires the same sender, so one member cannot rewrite another's
 * words and put text in a colleague's name.
 *
 * The new text is in the body, never in the URL.
 */
router.patch("/:threadId/messages/:messageId", writeAccess, async (req, res) => {
  const ctx = ctxFrom(req);
  try {
    // Authorizes the thread against this link before anything is touched.
    await getThread(req.params.threadId, ctx.practiceId, ctx.linkId, ctx);

    const message = await editMessage({
      threadId: req.params.threadId,
      messageId: req.params.messageId,
      actor: { senderType: "practice", senderUserId: ctx.userId },
      body: req.body?.body,
      ctx: { req, actorUserId: ctx.userId, actorRole: ctx.role },
    });

    writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.role,
      action: "practice_thread_message_edited",
      entityType: "PracticePatientMessage",
      entityId: message.id,
      // No message body: the audit trail records that a message changed, never
      // what it said.
      metadata: { ...threadAuditMeta(ctx, null), threadId: req.params.threadId },
    });

    return res.json({
      ok: true,
      message: messageForViewer(message, {
        viewer: "practice",
        actorUserId: ctx.userId,
        writable: true,
      }),
    });
  } catch (err) {
    console.error("[practice/threads/message/edit]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * PATCH /:threadId/messages/:messageId/withdraw — withdraw one's OWN message.
 *
 * The message stays as an event in the conversation and loses its content.
 */
router.patch("/:threadId/messages/:messageId/withdraw", writeAccess, async (req, res) => {
  const ctx = ctxFrom(req);
  try {
    await getThread(req.params.threadId, ctx.practiceId, ctx.linkId, ctx);

    const message = await withdrawMessage({
      threadId: req.params.threadId,
      messageId: req.params.messageId,
      actor: { senderType: "practice", senderUserId: ctx.userId },
      ctx: { req, actorUserId: ctx.userId, actorRole: ctx.role },
    });

    writeAuditLog({
      userId: ctx.userId,
      actorRole: ctx.role,
      action: "practice_thread_message_withdrawn",
      entityType: "PracticePatientMessage",
      entityId: message.id,
      metadata: { ...threadAuditMeta(ctx, null), threadId: req.params.threadId },
    });

    return res.json({
      ok: true,
      message: messageForViewer(message, {
        viewer: "practice",
        actorUserId: ctx.userId,
        writable: true,
      }),
    });
  } catch (err) {
    console.error("[practice/threads/message/withdraw]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * POST /:threadId/messages/:messageId/translation
 *
 * The practice side of the same operation, on the same terms. Behind
 * `readAccess`: translating is reading, so whoever may read the conversation
 * may read it in another language. It confers no right to write, and it changes
 * nothing about the thread.
 */
router.post(
  "/:threadId/messages/:messageId/translation",
  readAccess,
  messageTranslationIpLimiter,
  async (req, res) => {
    const ctx = ctxFrom(req);
    try {
      // Authorizes the thread against this link before anything is read.
      await getThread(req.params.threadId, ctx.practiceId, ctx.linkId, ctx);

      const translation = await translateMessage({
        threadId: req.params.threadId,
        messageId: req.params.messageId,
        targetLanguage: req.body?.targetLanguage,
        mode: req.body?.mode,
        actor: { userId: ctx.userId, role: ctx.role },
        req,
      });

      return res.json({ ok: true, translation });
    } catch (err) {
      console.error("[practice/threads/message/translation]", err?.message ?? err);
      const mapped = mapError(err);
      return res.status(mapped.status).json({ ok: false, error: mapped.error });
    }
  },
);

/**
 * POST /:threadId/dictation — the practice side, on the same terms.
 *
 * Behind `writeAccess`, exactly like sending: dictating is composing, and a
 * member who may not write in this conversation may not dictate into it. No
 * role gains anything here that it did not already have.
 */
router.post(
  "/:threadId/dictation",
  writeAccess,
  messageSttIpLimiter,
  uploadDictation.single("audio"),
  async (req, res) => {
    const ctx = ctxFrom(req);
    try {
      // The thread is authorized against this link before anything else, so a
      // dictation cannot be produced for a conversation this practice may not
      // write in.
      await getThread(req.params.threadId, ctx.practiceId, ctx.linkId, ctx);

      const result = await transcribeDictation({
        file: req.file,
        language: req.body?.language,
        writeAuthorized: true,
      });

      return res.json({
        ok: true,
        draft: { text: result.draftText, detectedLanguage: result.detectedLanguage },
      });
    } catch (err) {
      console.error(
        "[practice/threads/dictation]",
        err instanceof MessageSttError ? err.code : (err?.message ?? "error"),
      );
      const mapped = mapError(err);
      return res.status(mapped.status).json({ ok: false, error: mapped.error });
    }
  },
);

export default router;
