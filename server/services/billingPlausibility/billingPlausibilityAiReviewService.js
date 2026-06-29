/**
 * Billing Plausibility AI Review Service (Phase E).
 *
 * Loads a saved BillingPlausibilitySession and requests optional AI-assisted
 * plausibility hints from OpenAI. Operates on billing-code fields only —
 * no patient-identifying data is sent to OpenAI.
 *
 * IMPORTANT:
 *  - This is NOT a billing decision, NOT medical advice, NOT a reimbursement
 *    prediction, and NOT a legally binding opinion.
 *  - Deterministic warnings from Phase B–D are preserved unchanged.
 *  - AI output is validated and sanitized before persistence.
 *  - If AI is unavailable or output is invalid/unsafe, the session keeps its
 *    deterministic result and a safe fallback is returned.
 *
 * Fields sent to OpenAI: ziffer, factor, count, deterministic warnings,
 *   catalogue match status, contextText (practice note, max 500 chars).
 * Fields never sent: patientName, dateOfBirth, diagnosisText, clinicalNotes,
 *   address, insurance number, user names, session IDs.
 */

import { prisma } from "../../lib/prisma.js";
import { openai } from "../../openaiClient.js";
import { getOpenAiChatModel } from "../../config/openAiModels.js";
import {
  AI_MODULES,
  BILLING_PLAUSIBILITY_SYSTEM_PROMPT_SAFETY,
  getSafeFallback,
} from "../../config/aiSafetyPolicy.js";
import { detectForbiddenMedicalClaims, logAiSafetyEvent } from "../aiSafetySanitizer.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { hasPracticePermission, PERMISSIONS } from "../../utils/practicePermissions.js";


/** Max tokens for the AI review response (intentionally tight). */
const BILLING_AI_MAX_TOKENS = 400;

/** Low temperature — billing hints must be conservative. */
const BILLING_AI_TEMPERATURE = 0.15;

/** Max contextText characters forwarded to OpenAI. */
const MAX_CONTEXT_CHARS = 500;

/** Max hint characters per row (truncated before persistence). */
const MAX_HINT_CHARS = 300;

/** Max generalNote / uncertaintyNote characters. */
const MAX_NOTE_CHARS = 500;

function canAccessBilling(role) {
  return hasPracticePermission(role, PERMISSIONS.INTEGRATIONS_MANAGE);
}

/**
 * Build the user-content block sent to OpenAI.
 * Contains only billing-code fields — no patient identifiers.
 *
 * @param {object[]} items  BillingPlausibilityItem rows
 * @returns {string}
 */
function buildBillingContextBlock(items) {
  const lines = items.map((item) => {
    const warnings = Array.isArray(item.warningsJson) ? item.warningsJson.join(", ") : "none";
    const catalogueFound = item.catalogueMatchJson?.found ?? false;
    const catalogueTitle = item.catalogueMatchJson?.title ?? "not in local subset";
    const context =
      typeof item.contextText === "string" && item.contextText.trim()
        ? item.contextText.trim().slice(0, MAX_CONTEXT_CHARS)
        : "none";

    return [
      `GOÄ code: ${item.ziffer}`,
      `  Factor: ${item.factor}`,
      `  Count: ${item.count}`,
      `  Local catalogue match: ${catalogueFound ? `yes — ${catalogueTitle}` : "no"}`,
      `  Deterministic warnings: ${warnings}`,
      `  Context note (practice staff only, max 500 chars): ${context}`,
    ].join("\n");
  });

  return [
    "Below are GOÄ billing codes submitted for plausibility review.",
    "Provide neutral observations at the billing-code level only.",
    "Do not diagnose, triage, advise on therapy, predict reimbursement, or state whether an invoice is correct or incorrect.",
    "---",
    ...lines,
    "---",
    "Respond in JSON only, matching the schema: { rowHints: [{ ziffer: string, hint: string }], generalNote: string|null, uncertaintyNote: string|null, nonBinding: true }",
  ].join("\n\n");
}

/**
 * Validate the AI JSON response shape.
 * Returns { valid: true, parsed } or { valid: false, reason: string }.
 *
 * @param {unknown} raw
 * @returns {{ valid: boolean, parsed?: object, reason?: string }}
 */
function validateAiResponse(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, reason: "not_an_object" };
  }

  if (raw.nonBinding !== true) {
    return { valid: false, reason: "nonBinding_not_true" };
  }

  if (!Array.isArray(raw.rowHints)) {
    return { valid: false, reason: "rowHints_not_array" };
  }

  for (const rh of raw.rowHints) {
    if (typeof rh !== "object" || rh === null) {
      return { valid: false, reason: "rowHint_not_object" };
    }
    if (typeof rh.ziffer !== "string") {
      return { valid: false, reason: "rowHint_ziffer_not_string" };
    }
    if (typeof rh.hint !== "string") {
      return { valid: false, reason: "rowHint_hint_not_string" };
    }
  }

  if (raw.generalNote !== null && raw.generalNote !== undefined && typeof raw.generalNote !== "string") {
    return { valid: false, reason: "generalNote_invalid_type" };
  }

  if (raw.uncertaintyNote !== null && raw.uncertaintyNote !== undefined && typeof raw.uncertaintyNote !== "string") {
    return { valid: false, reason: "uncertaintyNote_invalid_type" };
  }

  return { valid: true, parsed: raw };
}

/**
 * Scan all string fields in the AI response for forbidden output.
 * Returns true if any field is unsafe.
 *
 * @param {object} parsed  validated AI response object
 * @returns {boolean}
 */
function hasUnsafeContent(parsed) {
  const module = AI_MODULES.BILLING_PLAUSIBILITY;

  for (const rh of parsed.rowHints) {
    if (detectForbiddenMedicalClaims(rh.hint, module).unsafe) return true;
  }

  if (typeof parsed.generalNote === "string") {
    if (detectForbiddenMedicalClaims(parsed.generalNote, module).unsafe) return true;
  }

  if (typeof parsed.uncertaintyNote === "string") {
    if (detectForbiddenMedicalClaims(parsed.uncertaintyNote, module).unsafe) return true;
  }

  return false;
}

/**
 * Truncate string fields to safe lengths before persistence.
 *
 * @param {object} parsed
 * @returns {object}
 */
function truncateFields(parsed) {
  return {
    rowHints: parsed.rowHints.map((rh) => ({
      ziffer: String(rh.ziffer).slice(0, 20),
      hint: String(rh.hint).slice(0, MAX_HINT_CHARS),
    })),
    generalNote:
      typeof parsed.generalNote === "string"
        ? parsed.generalNote.slice(0, MAX_NOTE_CHARS)
        : null,
    uncertaintyNote:
      typeof parsed.uncertaintyNote === "string"
        ? parsed.uncertaintyNote.slice(0, MAX_NOTE_CHARS)
        : null,
    nonBinding: true,
  };
}

/**
 * Request AI-assisted plausibility hints for an existing session.
 *
 * @param {string} practiceId
 * @param {string} sessionId
 * @param {{ userId: string }} actor
 * @returns {Promise<{
 *   ok: true,
 *   session: object,
 *   aiResult: object | null,
 *   used_fallback: boolean
 * } | { ok: false, error: string }>}
 */
export async function requestAiReviewForSession(practiceId, sessionId, actor) {
  // Access control
  const access = await getPracticeAccess(actor.userId, practiceId);
  if (!access) return { ok: false, error: "practice_not_found" };
  if (!canAccessBilling(access.role)) return { ok: false, error: "forbidden" };

  // Load session
  const session = await prisma.billingPlausibilitySession.findFirst({
    where: { id: sessionId, practiceProfileId: practiceId },
  });
  if (!session) return { ok: false, error: "session_not_found" };
  if (session.status === "dismissed") return { ok: false, error: "session_dismissed" };

  // Load items
  const items = await prisma.billingPlausibilityItem.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  const fallbackText = getSafeFallback(AI_MODULES.BILLING_PLAUSIBILITY, "en");

  // Guard: OpenAI must be configured
  if (!process.env.OPENAI_API_KEY) {
    await writeAiAuditLog(sessionId, actor.userId, { skipped: "no_api_key" });
    const updatedSession = await persistFallback(sessionId, session, items, fallbackText);
    return { ok: true, session: updatedSession, aiResult: null, used_fallback: true };
  }

  const systemPrompt = [
    "You are a GOÄ billing plausibility review assistant for a German medical practice management platform (MedScoutX).",
    "You review billing code submissions and provide neutral, non-binding observations at the organisational/billing level only.",
    BILLING_PLAUSIBILITY_SYSTEM_PROMPT_SAFETY,
  ].join("\n\n");

  const userContent = buildBillingContextBlock(items);

  let rawContent = "";

  try {
    const response = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: BILLING_AI_MAX_TOKENS,
      temperature: BILLING_AI_TEMPERATURE,
      response_format: { type: "json_object" },
    });

    rawContent = response?.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "billing_ai_review_openai_error",
        reason: String(err?.message || "unknown").slice(0, 120),
      }),
    );
    await writeAiAuditLog(sessionId, actor.userId, { error: "openai_call_failed" });
    const updatedSession = await persistFallback(sessionId, session, items, fallbackText);
    return { ok: true, session: updatedSession, aiResult: null, used_fallback: true };
  }

  // Parse JSON
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    console.error(
      JSON.stringify({
        level: "error",
        event: "billing_ai_review_json_parse_failed",
        rawLength: rawContent.length,
      }),
    );
    logAiSafetyEvent({ module: AI_MODULES.BILLING_PLAUSIBILITY, unsafe_output_detected: false, sanitized: false, used_fallback: true });
    await writeAiAuditLog(sessionId, actor.userId, { error: "json_parse_failed" });
    const updatedSession = await persistFallback(sessionId, session, items, fallbackText);
    return { ok: true, session: updatedSession, aiResult: null, used_fallback: true };
  }

  // Validate shape
  const validation = validateAiResponse(parsed);
  if (!validation.valid) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "billing_ai_review_invalid_shape",
        reason: validation.reason,
      }),
    );
    await writeAiAuditLog(sessionId, actor.userId, { error: "invalid_response_shape", reason: validation.reason });
    const updatedSession = await persistFallback(sessionId, session, items, fallbackText);
    return { ok: true, session: updatedSession, aiResult: null, used_fallback: true };
  }

  // Safety scan — never persist unsafe output
  if (hasUnsafeContent(validation.parsed)) {
    logAiSafetyEvent({ module: AI_MODULES.BILLING_PLAUSIBILITY, unsafe_output_detected: true, sanitized: true, used_fallback: true });
    await writeAiAuditLog(sessionId, actor.userId, { error: "unsafe_output_detected" });
    const updatedSession = await persistFallback(sessionId, session, items, fallbackText);
    return { ok: true, session: updatedSession, aiResult: null, used_fallback: true };
  }

  // Truncate to safe lengths
  const safeResult = truncateFields(validation.parsed);

  // Merge AI hints into resultSummaryJson without overwriting deterministic warnings
  const existingResult = session.resultSummaryJson ?? {};
  const mergedResult = {
    ...existingResult,
    aiReview: {
      ...safeResult,
      generatedAt: new Date().toISOString(),
      nonBinding: true,
    },
  };

  // Persist and update status
  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.billingPlausibilitySession.update({
      where: { id: sessionId },
      data: {
        status: "reviewed",
        resultSummaryJson: mergedResult,
      },
    });

    await tx.billingPlausibilityAuditLog.create({
      data: {
        sessionId,
        actorUserId: actor.userId,
        action: "ai_reviewed",
        metadataJson: {
          rowCount: items.length,
          rowHintCount: safeResult.rowHints.length,
          hasGeneralNote: safeResult.generalNote !== null,
          used_fallback: false,
          nonBinding: true,
        },
      },
    });

    return s;
  });

  logAiSafetyEvent({ module: AI_MODULES.BILLING_PLAUSIBILITY, unsafe_output_detected: false, sanitized: false, used_fallback: false });

  return {
    ok: true,
    session: serializeSessionWithAiResult(updated, items, safeResult),
    aiResult: safeResult,
    used_fallback: false,
  };
}

/**
 * Persist fallback (no AI content) and write audit log.
 * Status stays unchanged unless it was "pending" — keep deterministic result.
 */
async function persistFallback(sessionId, session, items, fallbackText) {
  const existingResult = session.resultSummaryJson ?? {};
  const mergedResult = {
    ...existingResult,
    aiReview: {
      rowHints: [],
      generalNote: fallbackText,
      uncertaintyNote: null,
      nonBinding: true,
      fallback: true,
      generatedAt: new Date().toISOString(),
    },
  };

  const updated = await prisma.billingPlausibilitySession.update({
    where: { id: sessionId },
    data: { resultSummaryJson: mergedResult },
  });

  return serializeSessionWithAiResult(updated, items, null);
}

async function writeAiAuditLog(sessionId, actorUserId, meta) {
  try {
    await prisma.billingPlausibilityAuditLog.create({
      data: {
        sessionId,
        actorUserId,
        action: "ai_reviewed",
        metadataJson: { ...meta, nonBinding: true },
      },
    });
  } catch {
    // audit log failures must not break the response
  }
}

/**
 * Serialize a session for the review response.
 * Items are always included. aiResult is attached if available (safe only).
 */
function serializeSessionWithAiResult(session, items, safeAiResult) {
  return {
    id: session.id,
    status: session.status,
    sourceType: session.sourceType,
    rowCount: session.inputSummaryJson?.rowCount ?? 0,
    ziffern: session.inputSummaryJson?.ziffern ?? [],
    resultSummaryJson: session.resultSummaryJson ?? null,
    disclaimerVersion: session.disclaimerVersion,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    dismissedAt: session.dismissedAt ?? null,
    items: items.map((item) => ({
      id: item.id,
      ziffer: item.ziffer,
      factor: item.factor,
      count: item.count,
      catalogueMatchJson: item.catalogueMatchJson,
      warningsJson: item.warningsJson,
    })),
    aiReview: safeAiResult ?? session.resultSummaryJson?.aiReview ?? null,
  };
}
