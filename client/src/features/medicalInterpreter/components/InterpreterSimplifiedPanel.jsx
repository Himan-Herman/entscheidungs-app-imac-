import { TURN_STATUS_TRANSLATED } from "../constants.js";
import InterpreterMultilingualText from "./InterpreterMultilingualText.jsx";

/**
 * @param {{
 *   turn: import('../types.js').InterpreterTurn | null;
 *   isSimplifying?: boolean;
 *   onSimplify?: () => void;
 *   onHideSimplified?: () => void;
 *   onListenSimplified?: () => void;
 *   listenDisabled?: boolean;
 *   listenLoading?: boolean;
 *   listenPlaying?: boolean;
 *   labels: object;
 * }} props
 */
export default function InterpreterSimplifiedPanel({
  turn,
  isSimplifying = false,
  onSimplify,
  onHideSimplified,
  onListenSimplified,
  listenDisabled = false,
  listenLoading = false,
  listenPlaying = false,
  labels: t,
}) {
  const hasTranslation =
    turn?.status === TURN_STATUS_TRANSLATED && Boolean(turn.translatedText?.trim());
  const hasSimplified = Boolean(turn?.simplifiedText?.trim());

  if (!hasTranslation) {
    return null;
  }

  return (
    <section
      className="interpreter-live__panel interpreter-live__panel--simplified"
      aria-labelledby="interp-simplified-heading"
      aria-busy={isSimplifying}
    >
      <h2 id="interp-simplified-heading" className="interpreter-live__section-title">
        {t.simplify.heading}
      </h2>

      {!hasSimplified ? (
        <button
          type="button"
          className="medical-interpreter-page__nav-link interpreter-live__simplify-btn"
          onClick={onSimplify}
          disabled={isSimplifying}
          aria-label={t.aria.simplifyLanguage}
        >
          {isSimplifying ? t.simplify.loading : t.simplify.action}
        </button>
      ) : (
        <>
          <div
            className="interpreter-live__simplified-body"
            role="region"
            aria-label={t.aria.simplifiedRegion}
            aria-live="polite"
            aria-atomic="true"
          >
            <InterpreterMultilingualText
              text={turn.simplifiedText}
              languageCode={turn.targetLanguage}
              className="interpreter-live__translation-text"
            />
            <p className="interpreter-live__simplify-note" role="note">
              {t.simplify.note}
            </p>
            <button
              type="button"
              className="medical-interpreter-page__nav-link interpreter-live__speak-btn"
              onClick={onListenSimplified}
              disabled={listenDisabled || listenLoading}
              aria-label={t.aria.replaySimplified}
              aria-pressed={listenPlaying}
            >
              {listenLoading
                ? t.speak.loading
                : listenPlaying
                  ? t.speak.stop
                  : t.speak.listenSimplified}
            </button>
          </div>
          <button
            type="button"
            className="medical-interpreter-page__nav-link interpreter-live__simplify-hide"
            onClick={onHideSimplified}
            disabled={isSimplifying}
            aria-label={t.aria.hideSimplified}
          >
            {t.simplify.hide}
          </button>
        </>
      )}

      {isSimplifying && !hasSimplified ? (
        <p className="interpreter-empty-state" aria-live="polite">
          {t.simplify.loading}
        </p>
      ) : null}
    </section>
  );
}
