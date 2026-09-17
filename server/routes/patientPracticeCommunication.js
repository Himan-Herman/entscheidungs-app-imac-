/**
 * Patient communication INSIDE one care relationship —
 * /api/patient/practice/:linkId/thread
 *
 * WHY A LINK-SCOPED ADDRESS AND NOT THE AGGREGATE ROUTE
 * -----------------------------------------------------
 * /api/patient/threads answers "all conversations of this patient across all
 * practices". That is the right answer for a cross-practice inbox and the wrong
 * one for a practice context: the client would have to receive every practice's
 * data and filter it locally, which is exactly the leak Phase 2B exists to
 * prevent. This address returns one relationship's channel and nothing else.
 *
 * It is NOT a second communication API: every handler delegates to the same
 * services/communication/practicePatientThreadService.js the aggregate route
 * uses, with the same guards and the same consent policy.
 *
 * SINGULAR ON PURPOSE
 * -------------------
 * `/thread`, never `/threads`. Since Phase 2A a PracticePatientLink carries
 * exactly one permanent channel, enforced by @@unique([practicePatientLinkId]).
 * A plural path would invite a quiet return to many threads per relationship;
 * the singular encodes the invariant in the URL itself.
 *
 * AUTHORIZATION
 * -------------
 * Scope comes from the session user and the linkId in the path. No practiceId
 * and no patientId are accepted — a link belonging to somebody else does not
 * match and is reported as `link_not_found`, indistinguishable from one that
 * does not exist.
 */

import express from "express";
import { requireCommunicationV2Feature } from "../middleware/requireCommunicationV2.js";
import {
  addMessageFromPatient,
  editMessage,
  getChannelForPatientLink,
  listThreadMessagesPage,
  markThreadRead,
  messageForViewer,
  relationshipIsWritable,
  withdrawMessage,
} from "../services/communication/practicePatientThreadService.js";
import { writeAuditLog } from "../services/auditLogService.js";
import { translateMessage } from "../services/messageTranslation/messageTranslationService.js";
import { MESSAGE_TRANSLATION_ERRORS } from "../services/messageTranslation/messageTranslationPolicy.js";
import { messageSttIpLimiter, messageTranslationIpLimiter } from "../middleware/ipRateLimit.js";
import { uploadDictation } from "../middleware/uploadDictation.js";
import { transcribeDictation } from "../services/messageSpeech/messageSttService.js";
import {
  MESSAGE_STT_ERRORS,
  MessageSttError,
} from "../services/messageSpeech/messageSttPolicy.js";
import { relationshipIsWritable as sttRelationshipIsWritable } from "../services/communication/practicePatientThreadService.js";

const router = express.Router({ mergeParams: true });

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
  if (msg === "link_not_found" || msg === "thread_not_found") {
    return { status: 404, error: msg };
  }
  if (msg === "consent_required") return { status: 403, error: msg };
  if (msg === "link_not_active") return { status: 409, error: msg };
  if (msg === "message_not_in_thread") return { status: 400, error: msg };
  if (msg === "message_not_found") return { status: 404, error: msg };
  // The message still exists and is still yours — it simply may no longer be
  // changed. That is a conflict with the conversation's state, not a bad
  // request and not a permission problem.
  if (
    msg === "message_already_read" ||
    msg === "message_withdrawn" ||
    msg === "message_not_mutable"
  ) {
    return { status: 409, error: msg };
  }
  // Translation refusals. The feature being off and the provider being
  // unconfigured are deliberately distinct: one is a product decision, the
  // other a deployment state, and an operator needs to tell them apart.
  if (msg === MESSAGE_TRANSLATION_ERRORS.FEATURE_DISABLED) {
    return { status: 503, error: msg };
  }
  if (msg === MESSAGE_TRANSLATION_ERRORS.PROVIDER_NOT_CONFIGURED) {
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
  // Dictation. The feature being off and the provider being unconfigured stay
  // distinct, as everywhere else: one is a product decision, the other a
  // deployment state.
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
    // The draft could not be produced. Nothing else changed, and the composer
    // still holds whatever the writer had.
    return { status: 502, error: msg };
  }
  if (
    msg === MESSAGE_TRANSLATION_ERRORS.PROVIDER_FAILED ||
    msg === MESSAGE_TRANSLATION_ERRORS.OUTPUT_REJECTED
  ) {
    // The original is untouched and still readable; only the translation
    // failed. 502 says the failure was outside this system.
    return { status: 502, error: msg };
  }
  return { status: 500, error: "request_failed" };
}

/**
 * GET /api/patient/practice/:linkId/thread — READ-ONLY.
 *
 * Never marks anything read (Phase 1' C-3) and never creates the channel: a
 * relationship without a conversation yet answers `channel: null`, which the UI
 * renders as an empty state.
 */
router.get("/", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const result = await getChannelForPatientLink(req.params.linkId, userId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[patient/practice/thread/get]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * PATCH /api/patient/practice/:linkId/thread/read — explicit acknowledgement.
 *
 * The link is verified first, so an acknowledgement can only ever be applied to
 * the channel of a relationship this patient holds. Idempotent, as established
 * in Phase 1'.
 */
router.patch("/read", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const { channel } = await getChannelForPatientLink(req.params.linkId, userId);
    if (!channel) return res.status(404).json({ ok: false, error: "thread_not_found" });

    /*
     * The client names the last message it actually displayed. Only messages up
     * to that point are acknowledged, so a message that arrived while the
     * request was in flight stays unread — which is what keeps a later
     * "edit only while unread" window honest.
     *
     * Omitting it keeps the previous whole-thread behaviour for older clients.
     */
    const thread = await markThreadRead(channel.id, "patient", {
      patientUserId: userId,
      throughMessageId: req.body?.throughMessageId,
    });

    writeAuditLog({
      userId,
      actorRole: "patient",
      action: "patient_thread_read",
      entityType: "PracticePatientThread",
      entityId: channel.id,
      practicePatientLinkId: req.params.linkId,
    });

    return res.json({ ok: true, channel: thread });
  } catch (err) {
    console.error("[patient/practice/thread/read]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * GET /api/patient/practice/:linkId/thread/messages?before=<id>&limit=50
 *
 * Older history, one page at a time. `before` is the OLDEST message the caller
 * already holds; the page returned is the one immediately older than it.
 *
 * Read-only like the thread endpoint above: paging through history is not
 * acknowledgement.
 */
router.get("/messages", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    // The link is authorized first; the thread id is never taken from the
    // caller, so a page can only ever come from this relationship's channel.
    const { link, channel } = await getChannelForPatientLink(req.params.linkId, userId);
    if (!channel) return res.status(404).json({ ok: false, error: "thread_not_found" });

    const page = await listThreadMessagesPage(channel.id, {
      before: req.query.before,
      limit: req.query.limit,
      // Older pages carry the same per-message capabilities as the first one,
      // so a message that is still editable does not lose its controls just
      // because the reader scrolled back to it.
      ctx: { viewer: "patient", actorUserId: userId, writable: relationshipIsWritable(link.status) },
    });
    return res.json({ ok: true, ...page });
  } catch (err) {
    console.error("[patient/practice/thread/messages]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * POST /api/patient/practice/:linkId/thread/messages
 *
 * Reuses addMessageFromPatient unchanged: the same consent gate, the same
 * message idempotency (clientRequestId), the same single channel. No new thread
 * is ever created here — the channel must already exist, which for the patient
 * side it does as soon as the practice has opened communication.
 */
router.post("/messages", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const { channel } = await getChannelForPatientLink(req.params.linkId, userId);
    if (!channel) return res.status(404).json({ ok: false, error: "thread_not_found" });

    const thread = await addMessageFromPatient({
      threadId: channel.id,
      patientUserId: userId,
      body: req.body?.body,
      clientRequestId: req.body?.clientRequestId,
    });

    writeAuditLog({
      userId,
      actorRole: "patient",
      action: "patient_thread_message_sent",
      entityType: "PracticePatientThread",
      entityId: thread.id,
      practicePatientLinkId: req.params.linkId,
    });

    return res.status(201).json({ ok: true, channel: thread });
  } catch (err) {
    console.error("[patient/practice/thread/message]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * PATCH /api/patient/practice/:linkId/thread/messages/:messageId
 *
 * Replaces the text of one's OWN message while the practice has not read it.
 * The new text travels in the body — never in the URL, where it would end up in
 * logs and history.
 *
 * The route authorizes the relationship and then hands the decision to the
 * service, which makes it in a single conditional update. Nothing here checks
 * `readAt` first: that answer would already be stale by the time it was used.
 */
router.patch("/messages/:messageId", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const { channel } = await getChannelForPatientLink(req.params.linkId, userId);
    if (!channel) return res.status(404).json({ ok: false, error: "thread_not_found" });

    const message = await editMessage({
      threadId: channel.id,
      messageId: req.params.messageId,
      actor: { senderType: "patient", senderUserId: userId },
      body: req.body?.body,
      ctx: { req, actorUserId: userId, actorRole: "patient" },
    });

    writeAuditLog({
      userId,
      actorRole: "patient",
      action: "patient_thread_message_edited",
      entityType: "PracticePatientMessage",
      entityId: message.id,
      practicePatientLinkId: req.params.linkId,
      // The text itself is never recorded here: an audit trail of message
      // bodies would be a second copy of the conversation.
      metadata: { threadId: channel.id },
    });

    return res.json({
      ok: true,
      message: messageForViewer(message, {
        viewer: "patient",
        actorUserId: userId,
        writable: true,
      }),
    });
  } catch (err) {
    console.error("[patient/practice/thread/message/edit]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * PATCH /api/patient/practice/:linkId/thread/messages/:messageId/withdraw
 *
 * Withdraws one's OWN message while the practice has not read it. The message
 * stays in the conversation as an event and loses its content.
 */
router.patch("/messages/:messageId/withdraw", async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const { channel } = await getChannelForPatientLink(req.params.linkId, userId);
    if (!channel) return res.status(404).json({ ok: false, error: "thread_not_found" });

    const message = await withdrawMessage({
      threadId: channel.id,
      messageId: req.params.messageId,
      actor: { senderType: "patient", senderUserId: userId },
      ctx: { req, actorUserId: userId, actorRole: "patient" },
    });

    writeAuditLog({
      userId,
      actorRole: "patient",
      action: "patient_thread_message_withdrawn",
      entityType: "PracticePatientMessage",
      entityId: message.id,
      practicePatientLinkId: req.params.linkId,
      metadata: { threadId: channel.id },
    });

    return res.json({
      ok: true,
      message: messageForViewer(message, {
        viewer: "patient",
        actorUserId: userId,
        writable: true,
      }),
    });
  } catch (err) {
    console.error("[patient/practice/thread/message/withdraw]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * POST /api/patient/practice/:linkId/thread/messages/:messageId/translation
 *
 * A translation of ONE message the caller may already read. Nothing about the
 * conversation changes: no read state, no unread count, no ordering, no
 * timestamps. Asking to read something in another language is not reading it.
 *
 * A POST rather than a GET because it may cause external processing and it
 * stores its result — but it is still a presentation operation, and the thread
 * is exactly as it was afterwards.
 */
router.post("/messages/:messageId/translation", messageTranslationIpLimiter, async (req, res) => {
  const userId = userIdFromReq(req);
  if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    // The link is authorized first and the thread comes from that answer, never
    // from the request — so a message id belonging to another conversation of
    // the same practice simply does not resolve.
    const { channel } = await getChannelForPatientLink(req.params.linkId, userId);
    if (!channel) return res.status(404).json({ ok: false, error: "thread_not_found" });

    const translation = await translateMessage({
      threadId: channel.id,
      messageId: req.params.messageId,
      // Body, never query string: the target language is small, but the habit
      // of putting request content in a URL is what puts message text there.
      targetLanguage: req.body?.targetLanguage,
      mode: req.body?.mode,
      actor: { userId, role: "patient" },
      req,
    });

    // No provider, no model, no prompt version: what the reader needs is the
    // text, the languages, and which state of the message it belongs to.
    return res.json({ ok: true, translation });
  } catch (err) {
    console.error("[patient/practice/thread/message/translation]", err?.message ?? err);
    const mapped = mapError(err);
    return res.status(mapped.status).json({ ok: false, error: mapped.error });
  }
});

/**
 * POST /api/patient/practice/:linkId/thread/dictation
 *
 * Turns a short recording into an editable draft. It creates NOTHING: no
 * message, no read state, no thread activity, no stored audio. The answer is a
 * string for a text field, and a message exists only if the writer later
 * presses send.
 *
 * Behind the same write authorization as sending. Dictation is the first half
 * of composing a message, so a relationship that no longer accepts messages
 * accepts no dictation for one either — otherwise a read-only relationship
 * would have a working composer, which is a write path with a longer name.
 */
router.post(
  "/dictation",
  messageSttIpLimiter,
  uploadDictation.single("audio"),
  async (req, res) => {
    const userId = userIdFromReq(req);
    if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

    try {
      // Authorization BEFORE the provider, always: an expensive external call
      // must never be the thing that discovers the caller had no right to make
      // it. The upload is already in memory at this point and bounded by the
      // middleware, so nothing large has been accepted on trust.
      const { link } = await getChannelForPatientLink(req.params.linkId, userId);
      if (!sttRelationshipIsWritable(link?.status)) {
        return res.status(403).json({ ok: false, error: "consent_required" });
      }

      const result = await transcribeDictation({
        file: req.file,
        language: req.body?.language,
        writeAuthorized: true,
      });

      // No audit entry. Nothing was sent, and recording a "message" that does
      // not exist would put an event in the trail for something the writer may
      // be about to delete. The send path audits the send.
      return res.json({
        ok: true,
        draft: {
          text: result.draftText,
          detectedLanguage: result.detectedLanguage,
        },
      });
    } catch (err) {
      // The message is the code; the recording and the transcript never appear
      // in a log line.
      console.error(
        "[patient/practice/thread/dictation]",
        err instanceof MessageSttError ? err.code : (err?.message ?? "error"),
      );
      const mapped = mapError(err);
      return res.status(mapped.status).json({ ok: false, error: mapped.error });
    }
  },
);

export default router;
