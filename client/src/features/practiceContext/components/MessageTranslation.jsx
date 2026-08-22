/**
 * The translation of one message, shown beside the original.
 *
 * ── The original is the message ─────────────────────────────────────────────
 * A translation is never substituted for what was written. It appears below the
 * original, labelled, in its own block — so a reader who wants to check a term
 * against what the practice actually said never has to do anything to get back
 * to it. There is no state of this component in which the original is off
 * screen.
 *
 * ── Why both are labelled ───────────────────────────────────────────────────
 * Two blocks of text under one message, in two languages, are ambiguous without
 * words. The labels are read out by screen readers as headings, and each block
 * carries a `lang` attribute so the text is pronounced in the language it is
 * actually written in.
 */

import { LOCALE_OPTIONS } from "../../../i18n/localeConfig.js";

/**
 * A language's own name, from the interface's own registry.
 *
 * Taken from there rather than restated, so a language added to the product
 * carries its name here without a second list to maintain. Falls back to the
 * code: a name this app does not have is better shown as "ru" than guessed at.
 */
const LANGUAGE_NAMES = Object.fromEntries(
  LOCALE_OPTIONS.map((o) => [o.code, o.nativeName]),
);

/**
 * @param {{ state: object, targetLanguage: string, mode: "normal" | "simple",
 *           t: object, onRetry: () => void }} props
 */
export default function MessageTranslation({ state, targetLanguage, mode, t, onRetry }) {
  if (!state) return null;
  const isSimple = mode === "simple";

  if (state.status === "loading") {
    return (
      <p
        className="practice-context__translation-state"
        role="status"
        aria-live="polite"
        data-testid="translation-loading"
      >
        {isSimple ? t.simplifying : t.translating}
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div className="practice-context__translation-state" data-testid="translation-error">
        {/*
          * The reason is stated in the reader's own language and says nothing
          * about which service failed or why — that is operational detail, and
          * the only thing the reader can act on is trying again.
          */}
        <p role="alert">{state.message}</p>
        {state.retryable ? (
          <button type="button" onClick={onRetry} data-testid="translation-retry">
            {t.retry}
          </button>
        ) : null}
      </div>
    );
  }

  if (state.status !== "done") return null;

  return (
    <section
      className="practice-context__translation"
      aria-label={isSimple ? t.simpleLabel : t.translationLabel}
      data-testid={isSimple ? "message-simple" : "message-translation"}
    >
      <p className="practice-context__translation-heading">
        {isSimple ? t.simple : t.translation}
        {/* The target language, named rather than shown as a flag: a flag is a
            country, and several of these languages are spoken in many. */}
        <span className="practice-context__translation-lang">
          {" · "}
          {LANGUAGE_NAMES[targetLanguage] ?? targetLanguage}
        </span>
      </p>
      <p
        className="practice-context__translation-text"
        lang={targetLanguage}
        data-testid="translation-text"
      >
        {state.text}
      </p>
      {/*
        * One note, not a stack of them. It says what this text is and which
        * text governs — the thing a reader has to know before relying on it.
        */}
      <p className="practice-context__translation-note">
        {isSimple ? t.simpleNote : t.translationNote}
      </p>
    </section>
  );
}

