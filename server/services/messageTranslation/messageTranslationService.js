/**
 * Translating ONE message, safely.
 *
 * ── What this is not ────────────────────────────────────────────────────────
 * It is not a message. A translation never enters the conversation, never
 * appears in the timeline, and produces no PracticePatientMessage. It is a
 * second way of reading something that was already said, and everything here is
 * arranged so that it cannot become anything more.
 *
 * ── The order of decisions ──────────────────────────────────────────────────
 *   1. May this actor read this message at all? Decided by the caller's own
 *      authorization, then narrowed here to the exact thread.
 *   2. Is this message translatable? Withdrawn, empty and oversized are
 *      refused before anything is prepared.
 *   3. Is there already a translation of THIS state of it? Served from the
 *      cache, which is a store, never a permission.
 *   4. Only then: mask, send, validate, unmask, store.
 *
 * ── What leaves the process ─────────────────────────────────────────────────
 * The masked body of one message and a target language code. No thread, no
 * neighbouring messages, no names, no identifiers, no dates of birth — and no
 * dose, drug name or number either, because those are replaced by opaque
 * markers before the text is assembled.
 */

import { prisma } from "../../lib/prisma.js";
import { isMessageTranslationEnabled } from "../../config/featureFlags.js";
import {
  maskSegments,
  unmaskText,
} from "../documentTranslation/masking/criticalTokenMasking.js";
import {
  MESSAGE_TRANSLATION_ERRORS,
  MESSAGE_TRANSLATION_MODES,
  MessageTranslationError,
  assertSupportedMode,
  assertSupportedTargetLanguage,
  assertTranslatableMessage,
} from "./messageTranslationPolicy.js";
import { messageSourceFingerprint } from "./messageSourceFingerprint.js";
import {
  buildMessageUserMessage,
  getMessagePromptForMode,
} from "./prompts/messageTranslationPrompts.js";
import {
  parseMessageProviderPayload,
  validateMessageProviderResponse,
} from "./messageTranslationOutputValidation.js";
import { resolveMessageTranslationProvider } from "./provider/index.js";
import { assertNoInventedGuidance } from "../documentTranslation/documentTranslationSafety.js";
import { findLostProperties } from "./simpleModeGuards.js";
import { writeAuditLog } from "../auditLogService.js";

/**
 * The message, fetched WITHIN the thread the caller was authorized for.
 *
 * The thread id comes from the caller's own authorization, never from the
 * request, so a message id from another conversation resolves to nothing. Two
 * links of the same practice are two threads, which is what makes translation
 * unusable as a way around the context boundary.
 *
 * @param {string} threadId
 * @param {string} messageId
 */
async function loadMessageInThread(threadId, messageId) {
  const id = String(messageId ?? "").trim();
  if (!id) throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.MESSAGE_NOT_FOUND);

  const message = await prisma.practicePatientMessage.findFirst({
    where: { id, threadId },
    select: {
      id: true,
      threadId: true,
      body: true,
      editedAt: true,
      withdrawnAt: true,
      senderType: true,
    },
  });
  // A foreign message and a non-existent one answer identically: the caller
  // learns nothing about conversations that are not theirs.
  if (!message) throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.MESSAGE_NOT_FOUND);
  return message;
}

/**
 * Translates one message, or returns the stored translation of this exact state
 * of it.
 *
 * @param {{
 *   threadId: string,
 *   messageId: string,
 *   targetLanguage: string,
 *   mode?: string,
 *   actor: { userId: string, role: "patient" | "practice" },
 *   req?: import("express").Request,
 *   signal?: AbortSignal,
 *   providerOptions?: object,
 * }} input
 */
export async function translateMessage(input) {
  if (!isMessageTranslationEnabled()) {
    throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.FEATURE_DISABLED);
  }

  const targetLanguage = assertSupportedTargetLanguage(input.targetLanguage);
  const mode = assertSupportedMode(input.mode ?? MESSAGE_TRANSLATION_MODES.NORMAL);

  const message = await loadMessageInThread(input.threadId, input.messageId);
  const body = assertTranslatableMessage(message);
  const sourceFingerprint = messageSourceFingerprint(message);

  // Cached entries are keyed by the state of the message, so an edited message
  // never matches a translation of what it used to say. The lookup is scoped to
  // the message that was just authorized — the cache answers "is this text
  // already translated", never "may this person see it".
  const cached = await prisma.practiceMessageTranslation.findUnique({
    where: {
      messageId_sourceFingerprint_targetLanguage_mode: {
        messageId: message.id,
        sourceFingerprint,
        targetLanguage,
        mode,
      },
    },
  });
  if (cached) {
    return {
      messageId: message.id,
      sourceFingerprint,
      sourceLanguage: cached.sourceLanguage,
      targetLanguage,
      mode,
      translatedText: cached.translatedText,
      cached: true,
    };
  }

  const started = Date.now();
  const { systemPrompt, promptVersion } = getMessagePromptForMode(mode);
  /** Which semantic check actually applied, for the audit record. */
  let guardStrength = null;

  // One message, one segment. The masking chain is shape-agnostic, so the same
  // rules that protect a dose in a discharge letter protect it here.
  const masked = maskSegments([{ index: 0, kind: "message", text: body }]);
  const maskedText = masked.segments[0]?.text ?? "";

  const provider = resolveMessageTranslationProvider(input.providerOptions);

  let result;
  try {
    const raw = await provider.translate({
      maskedText,
      targetLanguage,
      mode,
      systemPrompt,
      userMessage: buildMessageUserMessage({ maskedText, targetLanguage, mode }),
      signal: input.signal,
    });
    const payload = parseMessageProviderPayload(raw);
    result = validateMessageProviderResponse(payload, { maskedText });
  } catch (err) {
    await audit({
      req: input.req,
      actor: input.actor,
      message,
      targetLanguage,
      mode,
      outcome: "failed",
      reason: err instanceof MessageTranslationError ? err.code : "unknown",
      detail: err?.details?.reason ?? null,
      promptVersion,
      providerKind: provider.kind,
      model: provider.model ?? null,
      durationMs: Date.now() - started,
    });
    throw err instanceof MessageTranslationError
      ? err
      : new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.PROVIDER_FAILED);
  }

  // Restoring the real values happens here, after validation — so the values
  // are put back into text that has already been proven to carry every marker
  // exactly once and to have invented no numbers.
  const translatedText = unmaskText(result.translatedText, masked.tokenMap);

  // Does the translation tell the reader to do something the message did not?
  //
  // A practice legitimately writes "Bitte kommen Sie am Montag vorbei", and that
  // instruction must survive translation intact — so the question is not whether
  // the output contains advice, but whether it contains advice the ORIGINAL did
  // not. The same comparison already guards document translation; a message is
  // one segment, and the rule is identical.
  //
  // On detection the translation is refused rather than edited. Quietly
  // deleting a sentence from a medical text is worse than not offering a
  // translation at all.
  try {
    assertNoInventedGuidance({
      sourceSegments: [{ index: 0, text: body }],
      outputSegments: [{ index: 0, text: translatedText }],
    });
  } catch (err) {
    await audit({
      req: input.req,
      actor: input.actor,
      message,
      targetLanguage,
      mode,
      outcome: "failed",
      reason: MESSAGE_TRANSLATION_ERRORS.OUTPUT_REJECTED,
      detail: "invented_guidance",
      promptVersion,
      providerKind: provider.kind,
      model: provider.model ?? null,
      durationMs: Date.now() - started,
    });
    throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.OUTPUT_REJECTED, {
      reason: "invented_guidance",
      violations: err?.details?.violationCount ?? 1,
    });
  }

  /*
   * The simple mode is allowed to change how something is said, which means it
   * is the only mode that could change what is said without looking like it
   * did. A faithful translation that loses a "nicht" reads oddly; a rewrite
   * that loses one reads perfectly.
   *
   * So a rewrite is additionally checked for three properties surviving:
   * negation, condition, uncertainty. If the original expressed one and the
   * rewrite expresses none of it, the rewrite is discarded and the reader keeps
   * the original — an unavailable alternative rendering is a small loss, a
   * confident inversion of a clinical instruction is not.
   *
   * The check reaches furthest when the rewrite is in the message's own
   * language, which is the main case. `strength` records which applied, so the
   * audit trail does not overstate what was verified.
   */
  if (mode === MESSAGE_TRANSLATION_MODES.SIMPLE) {
    const kept = findLostProperties({
      sourceText: body,
      // The provider reports the source language; nothing is authorized on it,
      // and if it is absent the guard simply reports itself as unguarded.
      sourceLanguage: result.sourceLanguage ?? "",
      outputText: translatedText,
      targetLanguage,
    });
    if (!kept.ok) {
      await audit({
        req: input.req,
        actor: input.actor,
        message,
        targetLanguage,
        mode,
        outcome: "failed",
        reason: MESSAGE_TRANSLATION_ERRORS.SIMPLE_UNSAFE,
        detail: kept.lost.join(","),
        promptVersion,
        providerKind: provider.kind,
        model: provider.model ?? null,
        durationMs: Date.now() - started,
      });
      throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.SIMPLE_UNSAFE, {
        lost: kept.lost,
        strength: kept.strength,
      });
    }
    guardStrength = kept.strength;
  }

  // The message is re-read before the translation is stored. It may have been
  // edited or withdrawn while the provider was working, and storing a
  // translation of text that no longer exists is precisely what must not
  // happen. The fingerprint decides: unchanged means the same state.
  const still = await prisma.practicePatientMessage.findFirst({
    where: { id: message.id, threadId: input.threadId },
    select: { id: true, body: true, editedAt: true, withdrawnAt: true },
  });
  const unchanged =
    still && !still.withdrawnAt && messageSourceFingerprint(still) === sourceFingerprint;

  if (unchanged) {
    // Concurrent identical requests race here; the unique key makes the loser a
    // no-op rather than an error.
    await prisma.practiceMessageTranslation
      .create({
        data: {
          messageId: message.id,
          threadId: message.threadId,
          sourceFingerprint,
          targetLanguage,
          sourceLanguage: result.sourceLanguage,
          mode,
          translatedText,
        },
      })
      .catch((err) => {
        if (err?.code !== "P2002") throw err;
      });
  }

  await audit({
    req: input.req,
    actor: input.actor,
    message,
    targetLanguage,
    mode,
    outcome: unchanged ? "completed" : "discarded_stale",
    detail: guardStrength,
    promptVersion,
    providerKind: provider.kind,
    model: provider.model ?? null,
    durationMs: Date.now() - started,
  });

  if (!unchanged) {
    // The reader asked about a message that has since changed. Answering with
    // the translation anyway would show them a rendering of text that is no
    // longer there.
    throw new MessageTranslationError(
      still?.withdrawnAt
        ? MESSAGE_TRANSLATION_ERRORS.MESSAGE_WITHDRAWN
        : MESSAGE_TRANSLATION_ERRORS.MESSAGE_NOT_FOUND,
      { reason: "message_changed_during_translation" },
    );
  }

  return {
    messageId: message.id,
    sourceFingerprint,
    sourceLanguage: result.sourceLanguage,
    targetLanguage,
    mode,
    translatedText,
    cached: false,
  };
}

/**
 * Removes every stored translation of a message.
 *
 * Called when a message is edited or withdrawn. After an edit the old rows are
 * already unreachable — the fingerprint no longer matches — so this is about
 * not keeping them: a translation is a second copy of what someone said, and
 * there is no reason to hold a copy of a sentence that has been retracted or
 * corrected.
 *
 * Best effort by design. The guarantee that a withdrawn message cannot be read
 * through a translation does not rest on this function: the lookup refuses a
 * withdrawn message before it ever reaches the store.
 *
 * @param {string} messageId
 */
export async function purgeMessageTranslations(messageId) {
  const id = String(messageId ?? "").trim();
  if (!id) return 0;
  const { count } = await prisma.practiceMessageTranslation.deleteMany({
    where: { messageId: id },
  });
  return count;
}

/**
 * @param {object} entry
 */
async function audit(entry) {
  try {
    writeAuditLog({
      req: entry.req,
      userId: entry.actor?.userId,
      actorRole: entry.actor?.role,
      action: `message_translation.${entry.outcome}`,
      entityType: "PracticePatientMessage",
      entityId: entry.message?.id,
      metadata: {
        // Operational only. The message body, the translation and the sender's
        // identity are all absent on purpose: an audit trail of conversation
        // content would be a second copy of the conversation.
        threadId: entry.message?.threadId,
        targetLanguage: entry.targetLanguage,
        mode: entry.mode,
        promptVersion: entry.promptVersion,
        providerKind: entry.providerKind,
        model: entry.model,
        durationMs: entry.durationMs,
        ...(entry.reason ? { reason: entry.reason } : {}),
        ...(entry.detail ? { detail: entry.detail } : {}),
      },
    });
  } catch {
    // Auditing is best-effort; it must never turn a completed translation into
    // a failure.
  }
}
