/**
 * The canonical document transformation service.
 *
 * This is the ONLY code path from a patient request to a provider. A route must
 * call translateDocumentForPatient() and nothing else — assembling the layers
 * at a call site is how a security step gets skipped, and several of the
 * orderings here are load-bearing rather than stylistic.
 *
 * ── Order ───────────────────────────────────────────────────────────────────
 *   1  request shape        closed key allowlist, no document source accepted
 *   2  target/mode policy   allowlist decisions before anything is loaded
 *   3  provenance           the Phase 2A gate: nine cumulative conditions
 *   4  same-language        strict de→de needs no model at all
 *   5  provider gate        refuse unless translation-specific config exists
 *   6  file bytes           read from storage, never from the request
 *   7  extraction           in a terminable, memory-bounded worker
 *   8  preparation          language, masking, PII, medication, dosage guards
 *   9  provider call        masked segments only
 *  10  response validation  schema, ids, order
 *  11  integrity            markers, invented numerals, invented guidance
 *  12  one repair retry     same segments, stricter instruction, no new context
 *  13  restore              only after everything above passed
 *  14  audit                metadata only
 *
 * Nothing is persisted. The transformation is transient by design.
 */

import { randomUUID } from "node:crypto";

import { prisma } from "../../lib/prisma.js";
import { writeAuditLog } from "../auditLogService.js";
import { isDocumentTranslationEnabled } from "../../config/featureFlags.js";
import { getSharedDocumentFileForPatient } from "../practiceDocument/practiceDocumentService.js";

import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
  TRANSLATION_MODES,
  normalizeDocumentTranslationTarget,
  normalizeTranslationMode,
} from "./documentTranslationPolicy.js";
import { assertTranslatableDocumentForPatient } from "./documentProvenanceGate.js";
import { extractDocumentText } from "./extraction/documentTextExtractionService.js";
import { prepareSegmentsForTranslation } from "./translationPreparation.js";
import { assertSupportedSourceLanguage } from "./sourceLanguageGate.js";
import { unmaskText } from "./masking/criticalTokenMasking.js";
import { validateMaskedOutput } from "./masking/maskedOutputValidation.js";
import { assertNoInventedGuidance } from "./documentTranslationSafety.js";
import {
  parseProviderPayload,
  validateProviderResponse,
} from "./documentTranslationOutputValidation.js";
import { getPromptForMode } from "./prompts/documentTranslationPrompts.js";
import { resolveDocumentTranslationProvider } from "./provider/index.js";

/** Exactly one repair attempt is permitted. */
const MAX_ATTEMPTS = 2;

/**
 * Per-patient concurrency. A patient cannot start a second transformation while
 * one is running: it would double the cost and the provider exposure for no
 * benefit, and it is the cheapest form of abuse to attempt.
 */
const inFlight = new Set();

/** Failure shapes worth one repair attempt — all structural, never semantic. */
const REPAIRABLE = new Set([
  TRANSLATION_ERRORS.INVALID_RESPONSE,
  TRANSLATION_ERRORS.INTEGRITY_FAILED,
]);

/**
 * @param {object} input
 * @param {string} input.documentId    from the route path
 * @param {string} input.patientUserId from the verified session
 * @param {string} input.fileId
 * @param {unknown} input.sourceLanguage
 * @param {unknown} input.targetLanguage
 * @param {unknown} input.mode
 * @param {import('express').Request} [input.req] for audit context only
 * @param {AbortSignal} [input.signal]
 * @param {object} [deps] test seam: { provider }
 */
export async function translateDocumentForPatient(input, deps = {}) {
  if (!isDocumentTranslationEnabled()) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.FEATURE_DISABLED);
  }

  const patientUserId = input?.patientUserId;
  const startedAt = Date.now();

  // ── 2 — target language and mode, before anything is loaded ──────────────
  const targetLanguage = normalizeDocumentTranslationTarget(input?.targetLanguage);
  if (!targetLanguage) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.TARGET_LANGUAGE_UNSUPPORTED);
  }
  const mode = normalizeTranslationMode(input?.mode);
  if (!mode) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.MODE_INVALID);
  }

  if (inFlight.has(patientUserId)) {
    throw new DocumentTranslationError(TRANSLATION_ERRORS.RATE_LIMITED, {
      reason: "concurrent_translation",
    });
  }
  inFlight.add(patientUserId);

  try {
    // ── 3 — provenance. Reused unchanged from Phase 2A. ────────────────────
    const { document, file } = await assertTranslatableDocumentForPatient({
      documentId: input?.documentId,
      fileId: input?.fileId,
      patientUserId,
      mode,
      targetLanguage,
    });

    // ── 4 — source language, BEFORE the same-language short-circuit ────────
    // Ordering matters: checking "source equals target" first would let an
    // unsupported source language through whenever it happened to match the
    // target ("en" -> "en"), returning success for a document the language gate
    // would have refused. The gate runs first, unconditionally.
    const declaredSource = assertSupportedSourceLanguage(input?.sourceLanguage);

    // A faithful translation into the source language is a no-op. Returning the
    // original verbatim is safer and cheaper than asking a model to reproduce
    // it. Plain-language de→de is a real transformation and continues normally.
    if (mode === TRANSLATION_MODES.STRICT && declaredSource === targetLanguage) {
      await audit({
        req: input?.req,
        patientUserId,
        document,
        file,
        mode,
        targetLanguage,
        outcome: "translation_not_required",
        durationMs: Date.now() - startedAt,
      });
      return {
        status: "translation_not_required",
        mode,
        sourceLanguage: declaredSource,
        targetLanguage,
        segments: [],
      };
    }

    // ── 5 — provider gate, BEFORE the document is touched ──────────────────
    // Deliberately ahead of loading bytes, spawning an extraction worker and
    // running the guard chain. With no translation-specific configuration the
    // request cannot succeed under any circumstances, so doing that work first
    // would be pure cost — and it would mean the fail-closed state still reads
    // the patient's document off disk for nothing.
    const provider = deps.provider ?? resolveDocumentTranslationProvider();
    const { promptVersion } = getPromptForMode(mode);

    // ── 6 — bytes come from storage, never from the request ────────────────
    const { buffer } = await getSharedDocumentFileForPatient(
      document.id,
      file.id,
      patientUserId,
    );

    // ── 7 — extraction, isolated ───────────────────────────────────────────
    const extracted = await extractDocumentText({
      buffer,
      mimeType: file.mimeType,
      documentType: document.type,
    });

    // ── 8 — preparation: the whole Phase 2A guard chain ────────────────────
    const patientIdentity = await loadPatientIdentity(patientUserId);
    const prepared = prepareSegmentsForTranslation({
      segments: extracted.segments,
      sourceLanguage: input?.sourceLanguage,
      patientIdentity,
    });

    // ── 9..12 — call, validate, at most one repair ─────────────────────────
    const { outputSegments, attempts, model } = await callWithOneRepair({
      provider,
      prepared,
      mode,
      targetLanguage,
      signal: input?.signal,
    });

    // ── 11 (content) — no guidance the source did not contain ──────────────
    // Compared against the ORIGINAL segments, so a doctor's own instruction
    // survives translation while an invented one fails the whole result.
    const restored = outputSegments.map((segment) => ({
      index: segment.index,
      text: unmaskText(segment.text, prepared.tokenMap),
    }));
    assertNoInventedGuidance({
      sourceSegments: extracted.segments,
      outputSegments: restored,
    });

    // ── 13 — restore, and shape the response ───────────────────────────────
    const segments = restored.map((segment) => ({
      id: `segment_${segment.index}`,
      kind: extracted.segments[segment.index]?.kind ?? "paragraph",
      text: segment.text,
    }));

    await audit({
      req: input?.req,
      patientUserId,
      document,
      file,
      mode,
      targetLanguage,
      outcome: "completed",
      segmentCount: segments.length,
      attempts,
      promptVersion,
      providerKind: provider.kind,
      model,
      durationMs: Date.now() - startedAt,
    });

    return {
      status: "completed",
      mode,
      sourceLanguage: prepared.sourceLanguage,
      targetLanguage,
      segments,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    await auditFailure({
      req: input?.req,
      patientUserId,
      documentId: input?.documentId,
      mode,
      targetLanguage,
      err,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  } finally {
    inFlight.delete(patientUserId);
  }
}

/* ------------------------------------------------------------- internals */

/**
 * One call, and at most one repair attempt on a structural failure.
 *
 * The retry sends the SAME masked segments with a stricter instruction. No new
 * context, no additional patient data, no escalation to a different model — a
 * "stronger" model would be a different safety profile chosen automatically,
 * which is not a decision this code may make.
 */
async function callWithOneRepair({ provider, prepared, mode, targetLanguage, signal }) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) {
      throw new DocumentTranslationError(TRANSLATION_ERRORS.TIMEOUT, { reason: "client_aborted" });
    }

    let response;
    try {
      response = await provider.translatePreparedSegments({
        sourceLanguage: prepared.sourceLanguage,
        targetLanguage,
        mode,
        segments: prepared.outbound,
        repair: attempt > 1,
        signal,
      });

      const payload = parseProviderPayload(response.raw);
      const outputSegments = validateProviderResponse(payload, prepared.outbound);

      // Deterministic marker and numeral checks — the actual guarantee.
      validateMaskedOutput({
        maskedSegments: prepared.outbound,
        outputSegments,
        mode,
      });

      return { outputSegments, attempts: attempt, model: response.model };
    } catch (err) {
      lastError = err;

      const code = err instanceof DocumentTranslationError ? err.code : null;
      const repairable = code !== null && REPAIRABLE.has(code);
      if (!repairable || attempt === MAX_ATTEMPTS) throw err;
      // else: one more attempt, with the repair instruction
    }
  }

  throw lastError;
}

/**
 * The patient's own identifiers, for local masking.
 *
 * Only ever used to build masking patterns — none of this reaches a provider.
 * A failure here is not fatal: masking simply has fewer patterns, and every
 * other guard still applies.
 */
async function loadPatientIdentity(patientUserId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: patientUserId },
      select: {
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        email: true,
        profile: { select: { phone: true } },
      },
    });
    if (!user) return null;
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      dateOfBirth: user.dateOfBirth,
      email: user.email,
      phone: user.profile?.phone ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Metadata only. Document content never enters an audit record.
 *
 * Wrapped in try/catch rather than chaining .catch(): writeAuditLog does not
 * reliably return a promise, and an audit failure must never turn a successful
 * transformation into an error.
 */
async function audit(entry) {
  try {
    await writeAuditLog({
    req: entry.req,
    userId: entry.patientUserId,
    actorRole: "patient",
    action: "document_translation.completed",
    entityType: "practice_document",
    entityId: entry.document?.id,
    practiceProfileId: entry.document?.practiceProfileId,
    metadata: {
      fileId: entry.file?.id,
      mode: entry.mode,
      targetLanguage: entry.targetLanguage,
      outcome: entry.outcome,
      segmentCount: entry.segmentCount,
      attempts: entry.attempts,
      promptVersion: entry.promptVersion,
      providerKind: entry.providerKind,
      model: entry.model,
      durationMs: entry.durationMs,
      },
    });
  } catch {
    // Auditing is best-effort; the transformation result stands.
  }
}

async function auditFailure(entry) {
  try {
    await writeAuditLog({
    req: entry.req,
    userId: entry.patientUserId,
    actorRole: "patient",
    action: "document_translation.failed",
    entityType: "practice_document",
    entityId: entry.documentId,
    metadata: {
      mode: entry.mode,
      targetLanguage: entry.targetLanguage,
      // The stable code and its structural detail only. DocumentTranslationError
      // detail is metadata by construction; anything else is reduced to a label
      // so a provider message can never travel into an audit row.
      errorCode: entry.err instanceof DocumentTranslationError ? entry.err.code : "unexpected",
      errorDetail:
        entry.err instanceof DocumentTranslationError ? entry.err.detail : undefined,
        durationMs: entry.durationMs,
      },
    });
  } catch {
    // Never let an audit failure mask the original error.
  }
}

/** Exposed for tests that need a unique patient id per case. */
export function newTestPatientId() {
  return `patient-${randomUUID()}`;
}
