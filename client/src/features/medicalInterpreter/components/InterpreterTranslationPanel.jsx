import {
  TURN_STATUS_BLOCKED,
  TURN_STATUS_TRANSLATED,
} from "../constants.js";
import InterpreterMultilingualText from "./InterpreterMultilingualText.jsx";
import { getTranslationQualityWarnings } from "../utils/interpreterTranslationQuality.js";

/**
 * @param {{
 *   turn: import('../types.js').InterpreterTurn | null;
 *   session?: import('../types.js').InterpreterSession | null;
 *   onListen?: () => void;
 *   listenDisabled?: boolean;
 *   listenLoading?: boolean;
 *   listenPlaying?: boolean;
 *   labels: object;
 * }} props
 */
export default function InterpreterTranslationPanel({
  turn,
  session = null,
  onListen,
  listenDisabled = false,
  listenLoading = false,
  listenPlaying = false,
  labels: t,
}) {
  const hasTranslation =
    turn?.status === TURN_STATUS_TRANSLATED && turn.translatedText?.trim();
  const isBlocked = turn?.status === TURN_STATUS_BLOCKED;
  const qualityWarnings = getTranslationQualityWarnings(turn, session, t);

  return (
    <section
      className="interpreter-live__panel interpreter-live__panel--translation"
      aria-labelledby="interp-translation-heading"
    >
      <h2 id="interp-translation-heading" className="interpreter-live__section-title">
        {t.translation.heading}
      </h2>

      <div
        className="interpreter-live__translation-body"
        aria-live="polite"
        aria-atomic="true"
        role="region"
        aria-label={t.aria.translationRegion}
      >
        {!turn ? (
          <p className="interpreter-empty-state">{t.translation.empty}</p>
        ) : isBlocked ? (
          <p className="interpreter-feedback interpreter-feedback--blocked" role="note">
            {t.translation.blocked}
          </p>
        ) : !hasTranslation ? (
          <p className="interpreter-empty-state">{t.translation.placeholder}</p>
        ) : (
          <>
            <InterpreterMultilingualText
              text={turn.translatedText}
              languageCode={turn.targetLanguage}
              className={`interpreter-live__translation-text${
                turn.confidence === "low" || turn.translationUncertain
                  ? " interpreter-live__translation-text--uncertain"
                  : ""
              }`}
            />
            {qualityWarnings.length > 0 ? (
              <ul className="interpreter-live__quality-warnings" role="list">
                {qualityWarnings.map((message) => (
                  <li
                    key={message}
                    className="interpreter-feedback interpreter-feedback--caution"
                    role="note"
                  >
                    {message}
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              className="medical-interpreter-page__nav-link interpreter-live__speak-btn"
              onClick={onListen}
              disabled={listenDisabled || listenLoading}
              aria-label={t.aria.replayTranslation}
              aria-pressed={listenPlaying}
            >
              {listenLoading
                ? t.speak.loading
                : listenPlaying
                  ? t.speak.stop
                  : t.speak.listenTranslation}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
