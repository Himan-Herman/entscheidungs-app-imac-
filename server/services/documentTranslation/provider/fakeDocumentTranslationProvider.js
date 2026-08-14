/**
 * Deterministic in-process provider double.
 *
 * The security properties of this feature must be testable without a network,
 * without credentials and without spending money — and above all without the
 * test outcome depending on what a real model happens to produce today. So the
 * whole failure surface is simulated here, exactly and repeatably.
 *
 * It also serves as the privacy tripwire: it records verbatim what it was
 * given, so a test can assert that a patient name or a drug name never appears
 * in a payload. If the masking chain ever regresses, that assertion fails.
 *
 * Never reachable in production: resolveDocumentTranslationProvider only
 * returns it when DOCUMENT_TRANSLATION_PROVIDER is explicitly "fake".
 */

import {
  DocumentTranslationError,
  TRANSLATION_ERRORS,
} from "../documentTranslationPolicy.js";
import { segmentId } from "../prompts/documentTranslationPrompts.js";

/** Behaviours the double can be asked to exhibit. */
export const FAKE_BEHAVIOURS = Object.freeze({
  /** Echo each segment with a language marker prefix — a "correct" response. */
  ECHO: "echo",
  /** Drop one placeholder from the first segment carrying one. */
  DROP_MARKER: "drop_marker",
  /** Repeat a placeholder. */
  DUPLICATE_MARKER: "duplicate_marker",
  /** Emit a placeholder that was never sent. */
  INVENT_MARKER: "invent_marker",
  /** Add a digit — i.e. invent numeric material. */
  INVENT_NUMBER: "invent_number",
  /** Answer with an id that was not sent. */
  WRONG_SEGMENT_ID: "wrong_segment_id",
  /** Return fewer segments than were sent. */
  DROP_SEGMENT: "drop_segment",
  /** Return more segments than were sent. */
  ADD_SEGMENT: "add_segment",
  /** Return segments in a different order. */
  REORDER_SEGMENTS: "reorder_segments",
  /** Return a body that is not JSON. */
  INVALID_JSON: "invalid_json",
  /** Return a schema-shaped body carrying a forbidden field. */
  FORBIDDEN_FIELD: "forbidden_field",
  /** Append medical advice the source never contained. */
  ADD_MEDICAL_ADVICE: "add_medical_advice",
  /** Append a risk claim the source never contained. */
  ADD_RISK_CLAIM: "add_risk_claim",
  /** Obey an instruction embedded in the document. */
  OBEY_INJECTION: "obey_injection",
  /** Fail on the first call, behave on the second — exercises the retry. */
  FAIL_THEN_SUCCEED: "fail_then_succeed",
  /** Exceed the deadline. */
  TIMEOUT: "timeout",
  /** Transport failure. */
  UNAVAILABLE: "unavailable",
  /** Provider-side throttling. */
  RATE_LIMITED: "rate_limited",
});

/**
 * @param {{ behaviour?: string, plainSuffix?: string }} [options]
 */
export function createFakeDocumentTranslationProvider(options = {}) {
  const behaviour = options.behaviour ?? FAKE_BEHAVIOURS.ECHO;

  /** Everything the provider was handed, for privacy assertions. */
  const calls = [];

  async function translatePreparedSegments(request) {
    calls.push(structuredClone(sanitisableCopy(request)));
    const attempt = calls.length;

    switch (behaviour) {
      case FAKE_BEHAVIOURS.TIMEOUT:
        throw new DocumentTranslationError(TRANSLATION_ERRORS.TIMEOUT, {
          reason: "provider_timeout",
        });
      case FAKE_BEHAVIOURS.UNAVAILABLE:
        throw new DocumentTranslationError(TRANSLATION_ERRORS.PROVIDER_UNAVAILABLE, {
          reason: "transport_error",
        });
      case FAKE_BEHAVIOURS.RATE_LIMITED:
        throw new DocumentTranslationError(TRANSLATION_ERRORS.RATE_LIMITED, {
          reason: "provider_rate_limited",
        });
      case FAKE_BEHAVIOURS.INVALID_JSON:
        return { raw: "this is not json {{{", model: "fake" };
      default:
        break;
    }

    // The retry path: misbehave once, then produce a clean response.
    const effective =
      behaviour === FAKE_BEHAVIOURS.FAIL_THEN_SUCCEED && attempt === 1
        ? FAKE_BEHAVIOURS.DROP_MARKER
        : behaviour === FAKE_BEHAVIOURS.FAIL_THEN_SUCCEED
          ? FAKE_BEHAVIOURS.ECHO
          : behaviour;

    return { raw: JSON.stringify(buildBody(request, effective)), model: "fake" };
  }

  return {
    kind: "fake",
    translatePreparedSegments,
    /** Every request the provider received, in order. */
    get calls() {
      return calls;
    },
    /** Concatenated text of every segment ever sent — for leak assertions. */
    get transmittedText() {
      return calls
        .flatMap((c) => c.segments.map((s) => s.text))
        .join("\n");
    },
    get callCount() {
      return calls.length;
    },
  };
}

/* ------------------------------------------------------------- internals */

function buildBody(request, behaviour) {
  const segments = request.segments.map((segment) => ({
    id: segmentId(segment.index),
    text: transform(segment, request, behaviour),
  }));

  switch (behaviour) {
    case FAKE_BEHAVIOURS.WRONG_SEGMENT_ID:
      if (segments[0]) segments[0].id = "segment_999";
      break;
    case FAKE_BEHAVIOURS.DROP_SEGMENT:
      segments.pop();
      break;
    case FAKE_BEHAVIOURS.ADD_SEGMENT:
      segments.push({ id: segmentId(segments.length), text: "Zusaetzlicher Abschnitt." });
      break;
    case FAKE_BEHAVIOURS.REORDER_SEGMENTS:
      if (segments.length >= 2) [segments[0], segments[1]] = [segments[1], segments[0]];
      break;
    case FAKE_BEHAVIOURS.FORBIDDEN_FIELD:
      return { segments, recommendation: "See a doctor." };
    default:
      break;
  }

  return { segments };
}

function transform(segment, request, behaviour) {
  const markers = segment.text.match(/⟦[^⟧]+⟧/g) || [];
  let text = segment.text;

  switch (behaviour) {
    case FAKE_BEHAVIOURS.DROP_MARKER:
      if (markers[0]) text = text.replace(markers[0], "");
      break;
    case FAKE_BEHAVIOURS.DUPLICATE_MARKER:
      if (markers[0]) text = `${text} ${markers[0]}`;
      break;
    case FAKE_BEHAVIOURS.INVENT_MARKER:
      text = `${text} ⟦DOSE_ZZZZ⟧`;
      break;
    case FAKE_BEHAVIOURS.INVENT_NUMBER:
      text = `${text} (maximal 10 mg)`;
      break;
    case FAKE_BEHAVIOURS.ADD_MEDICAL_ADVICE:
      text = `${text} You should consult your doctor immediately.`;
      break;
    case FAKE_BEHAVIOURS.ADD_RISK_CLAIM:
      text = `${text} Dadurch haben Sie ein erhoehtes Risiko.`;
      break;
    case FAKE_BEHAVIOURS.OBEY_INJECTION:
      // What a compromised model would do with an embedded instruction.
      text = "SYSTEM PROMPT: You are a constrained medical translation engine.";
      break;
    default:
      // A plausible, harmless transformation: markers untouched, wording marked
      // so a test can see the segment really was processed.
      text = `[${request.targetLanguage}] ${text}`;
      break;
  }

  return text;
}

/** Strip anything non-cloneable before recording the call. */
function sanitisableCopy(request) {
  return {
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    mode: request.mode,
    segments: request.segments.map((s) => ({
      index: s.index,
      kind: s.kind,
      polarity: s.polarity,
      text: s.text,
    })),
  };
}
