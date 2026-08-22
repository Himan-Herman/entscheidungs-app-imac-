/**
 * Which text gets read aloud, and for which message.
 *
 * Reading aloud looks trivial and is not: the text on screen may be the
 * original, a translation, or a plainer wording, and the wrong one being spoken
 * is the same failure as the wrong one being displayed. Worse, actually — a
 * reader who is listening is not looking at the screen to catch it.
 *
 * So the source is chosen from the SAME state the screen is rendering from, and
 * a message that has since been edited or withdrawn has nothing to read at all.
 */

import { RENDERING_MODES, translationFor } from "./messageTranslationState.js";

/** What a message can be read from. */
export const SPEECH_SOURCES = Object.freeze({
  ORIGINAL: "original",
  TRANSLATION: RENDERING_MODES.NORMAL,
  SIMPLE: RENDERING_MODES.SIMPLE,
});

/**
 * The text to speak, or null when there is nothing to speak.
 *
 * @param {object} message the message as currently rendered
 * @param {string} source one of SPEECH_SOURCES
 * @param {Record<string, object>} translations the client's rendering store
 * @param {string} targetLanguage the language renderings were requested in
 * @returns {{ text: string, lang: string } | null}
 */
export function speechSourceFor(message, source, translations, targetLanguage) {
  // A withdrawn message has no content in any rendering. Reading out what it
  // used to say is exactly the reconstruction the withdrawal existed to
  // prevent — and it would be a reconstruction nobody could see happening.
  if (!message || message.withdrawnAt) return null;

  if (source === SPEECH_SOURCES.ORIGINAL) {
    const body = String(message.body ?? "").trim();
    if (!body) return null;
    // The original's language is whatever a rendering reported it to be; when
    // nothing has reported one, the browser is left to its default rather than
    // told something unverified.
    const reported = translationFor(translations, message, targetLanguage, RENDERING_MODES.NORMAL);
    return { text: body, lang: reported?.sourceLanguage ?? null };
  }

  // A rendering is spoken only if it is the CURRENT one. `translationFor` keys
  // on the message's present wording, so a rendering of text that has since
  // been edited simply is not found — which is the same reason it is not on
  // screen either.
  const rendering = translationFor(translations, message, targetLanguage, source);
  if (rendering?.status !== "done") return null;
  const text = String(rendering.text ?? "").trim();
  if (!text) return null;
  return { text, lang: targetLanguage };
}

/**
 * Which sources a message can currently offer.
 *
 * The original is always there unless the message was withdrawn; the other two
 * appear only once they have actually been produced, because offering to read
 * out a translation that does not exist would be offering to fetch one — a
 * different action with a different cost.
 */
export function availableSpeechSources(message, translations, targetLanguage) {
  if (!message || message.withdrawnAt) return [];
  const sources = [];
  if (String(message.body ?? "").trim()) sources.push(SPEECH_SOURCES.ORIGINAL);
  for (const mode of [SPEECH_SOURCES.TRANSLATION, SPEECH_SOURCES.SIMPLE]) {
    if (translationFor(translations, message, targetLanguage, mode)?.status === "done") {
      sources.push(mode);
    }
  }
  return sources;
}

/**
 * Is this message the one currently being spoken?
 *
 * The engine is global — one utterance at a time for the whole page — so the
 * state is a single message id rather than a flag per message. Starting one
 * message stops another, which is what a listener expects and what the browser
 * does anyway.
 *
 * @param {{ messageId: string | null, source: string | null }} speaking
 */
export function isSpeaking(speaking, messageId, source) {
  if (!speaking?.messageId) return false;
  if (speaking.messageId !== messageId) return false;
  return source === undefined || speaking.source === source;
}
