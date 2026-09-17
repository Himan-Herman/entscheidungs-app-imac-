/**
 * Deterministic in-process provider double.
 *
 * The security properties of this feature have to be testable without a
 * network, without credentials and without the outcome depending on what a real
 * model happens to produce today. So the whole failure surface is simulated
 * here, exactly and repeatably.
 *
 * It is also the privacy tripwire: it records verbatim what it was handed, so a
 * test can assert that a patient's name, a dose or a neighbouring message never
 * appeared in a payload. If the masking chain or the data minimisation ever
 * regresses, that assertion fails.
 *
 * Never reachable in production: resolveMessageTranslationProvider returns it
 * only when MESSAGE_TRANSLATION_PROVIDER is explicitly "fake", and the config
 * refuses "fake" outright when NODE_ENV is production.
 */

import {
  MESSAGE_TRANSLATION_ERRORS,
  MessageTranslationError,
} from "../messageTranslationPolicy.js";
import { findMarkers } from "../../documentTranslation/masking/criticalTokenMasking.js";

/** Behaviours the double can be asked to exhibit. */
export const FAKE_MESSAGE_BEHAVIOURS = Object.freeze({
  /** A well-formed translation: the text with a language marker. */
  ECHO: "echo",
  /** Drop a placeholder — i.e. lose a dose. */
  DROP_MARKER: "drop_marker",
  /** Repeat a placeholder. */
  DUPLICATE_MARKER: "duplicate_marker",
  /** Emit a placeholder that was never sent. */
  INVENT_MARKER: "invent_marker",
  /** Add a digit — i.e. invent numeric material. */
  INVENT_NUMBER: "invent_number",
  /** Answer the message instead of translating it. */
  ANSWER_INSTEAD: "answer_instead",
  /** Volunteer a field the contract forbids. */
  EXTRA_FIELD: "extra_field",
  /** Return prose rather than the structured object. */
  UNSTRUCTURED: "unstructured",
  /** Return nothing usable. */
  EMPTY: "empty",
  /** Hand back a refusal as though it were content. */
  REFUSAL: "refusal",
  /** Fail like a provider outage. */
  SERVER_ERROR: "server_error",
  /** Never answer. */
  TIMEOUT: "timeout",
  /** Answer in a language other than the one asked for. */
  WRONG_LANGUAGE: "wrong_language",

  /* --- Simple-mode failures: fluent, confident and wrong (Phase 4B) --- */
  /** Drop the negation: "nicht einnehmen" becomes "einnehmen". */
  LOSE_NEGATION: "lose_negation",
  /** Drop the condition: "bei Bedarf" simply disappears. */
  LOSE_CONDITION: "lose_condition",
  /** Turn a suspicion into a diagnosis. */
  LOSE_UNCERTAINTY: "lose_uncertainty",
  /** Add reassurance nobody wrote. */
  ADD_REASSURANCE: "add_reassurance",
  /** Add an instruction the message never gave. */
  ADD_INSTRUCTION: "add_instruction",
});

/**
 * The simple-mode failures, built FROM the masked text.
 *
 * Deliberately not fixed sentences. A canned reply would lose the placeholders
 * along with the meaning, and the earlier structural check would then catch it —
 * which would leave the semantic guard untested and looking effective. These
 * keep every placeholder exactly and change only what the sentence asserts,
 * which is precisely the failure that reads perfectly and has to be caught
 * somewhere else.
 */
const SIMPLE_FAILURES = Object.freeze({
  /** "nicht einnehmen" becomes "einnehmen". */
  lose_negation: (text) =>
    text.replace(/\b(nicht|kein(e|en|em|er|es)?|niemals|nie|ohne)\b/gi, "").replace(/\s{2,}/g, " ").trim(),
  /** The condition simply disappears. */
  lose_condition: (text) =>
    text
      .replace(/\bbei\s+bedarf\b,?/gi, "")
      .replace(/\b(wenn|falls|sofern|sobald)\b[^,.]*,\s*/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim(),
  /** A suspicion becomes a statement of fact. */
  lose_uncertainty: (text) =>
    text
      .replace(/\bverdacht\s+auf\b/gi, "Sie haben")
      .replace(/\b(vermutlich|m[oö]glicherweise|wahrscheinlich|eventuell|vielleicht)\b/gi, "")
      .replace(/\bk[oö]nnte\b/gi, "ist")
      .replace(/\s{2,}/g, " ")
      .trim(),
  /** Comfort nobody wrote, appended to an otherwise faithful rendering. */
  add_reassurance: (text) => `${text} Sie müssen sich keine Sorgen machen.`,
  /** A next step nobody asked for, appended the same way. */
  add_instruction: (text) => `${text} Bitte vereinbaren Sie einen neuen Termin.`,
});

/**
 * @param {{ behaviour?: string, onCall?: Function }} [options]
 */
export function createFakeMessageTranslationProvider(options = {}) {
  const behaviour = options.behaviour || FAKE_MESSAGE_BEHAVIOURS.ECHO;
  /** Everything the adapter was asked to transmit, verbatim. */
  const calls = [];

  return {
    kind: "fake",
    model: "fake",
    calls,

    /**
     * @param {{ maskedText: string, targetLanguage: string, mode?: string, systemPrompt: string, userMessage: string }} request
     */
    async translate(request) {
      calls.push({ ...request });
      if (typeof options.onCall === "function") options.onCall(request);

      const markers = findMarkers(request.maskedText);

      switch (behaviour) {
        case FAKE_MESSAGE_BEHAVIOURS.SERVER_ERROR:
          throw new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.PROVIDER_FAILED, {
            status: 503,
          });

        case FAKE_MESSAGE_BEHAVIOURS.TIMEOUT: {
          const err = new MessageTranslationError(MESSAGE_TRANSLATION_ERRORS.PROVIDER_FAILED, {
            reason: "timeout",
          });
          throw err;
        }

        case FAKE_MESSAGE_BEHAVIOURS.EMPTY:
          return { sourceLanguage: "de", translatedText: "" };

        case FAKE_MESSAGE_BEHAVIOURS.UNSTRUCTURED:
          return "Sure! Here is the translation you asked for: hello";

        case FAKE_MESSAGE_BEHAVIOURS.REFUSAL:
          return {
            sourceLanguage: "de",
            translatedText: "I'm sorry, I cannot help with that request.",
          };

        case FAKE_MESSAGE_BEHAVIOURS.ANSWER_INSTEAD:
          return {
            sourceLanguage: "de",
            // What a model that fell for "diagnose me" actually produces: an
            // instruction the message never contained.
            translatedText:
              "You should see a doctor immediately and start antibiotics.",
          };

        case FAKE_MESSAGE_BEHAVIOURS.EXTRA_FIELD:
          return {
            sourceLanguage: "de",
            translatedText: translated(request),
            advice: "Take it easy and rest.",
          };

        case FAKE_MESSAGE_BEHAVIOURS.DROP_MARKER:
          return {
            sourceLanguage: "de",
            translatedText: markers.length
              ? translated(request).replace(markers[0], "")
              : translated(request),
          };

        case FAKE_MESSAGE_BEHAVIOURS.DUPLICATE_MARKER:
          return {
            sourceLanguage: "de",
            translatedText: markers.length
              ? `${translated(request)} ${markers[0]}`
              : translated(request),
          };

        case FAKE_MESSAGE_BEHAVIOURS.INVENT_MARKER:
          return {
            sourceLanguage: "de",
            translatedText: `${translated(request)} ⟦DOSE_ZZZZ⟧`,
          };

        case FAKE_MESSAGE_BEHAVIOURS.INVENT_NUMBER:
          return {
            sourceLanguage: "de",
            translatedText: `${translated(request)} 500`,
          };

        case FAKE_MESSAGE_BEHAVIOURS.LOSE_NEGATION:
        case FAKE_MESSAGE_BEHAVIOURS.LOSE_CONDITION:
        case FAKE_MESSAGE_BEHAVIOURS.LOSE_UNCERTAINTY:
        case FAKE_MESSAGE_BEHAVIOURS.ADD_REASSURANCE:
        case FAKE_MESSAGE_BEHAVIOURS.ADD_INSTRUCTION:
          return {
            sourceLanguage: "de",
            translatedText: SIMPLE_FAILURES[behaviour](request.maskedText),
          };

        case FAKE_MESSAGE_BEHAVIOURS.WRONG_LANGUAGE:
          return { sourceLanguage: "de", translatedText: `[xx] ${request.maskedText}` };

        case FAKE_MESSAGE_BEHAVIOURS.ECHO:
        default:
          return { sourceLanguage: "de", translatedText: translated(request) };
      }
    },
  };
}

/**
 * A recognisable stand-in for a translation.
 *
 * It preserves the masked text exactly, so every placeholder survives and no
 * digit is introduced — the behaviour a correct provider would show. The prefix
 * makes it obvious in any screenshot or test failure that this is the double
 * and not a real translation.
 *
 * @param {{ maskedText: string, targetLanguage: string }} request
 */
function translated(request) {
  // The mode is echoed so a test can prove the double was asked for the mode it
  // was asked for, and so a screenshot shows which rendering is on screen.
  const mode = request.mode && request.mode !== "normal" ? `:${request.mode}` : "";
  return `[${request.targetLanguage}${mode}] ${request.maskedText}`;
}
