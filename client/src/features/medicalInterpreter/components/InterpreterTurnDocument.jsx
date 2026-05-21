import {
  TURN_STATUS_BLOCKED,
  TURN_STATUS_DRAFT,
  TURN_STATUS_ERROR,
  TURN_STATUS_TRANSLATED,
  SPEAKER_DOCTOR,
} from "../constants.js";
import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import InterpreterMultilingualText from "./InterpreterMultilingualText.jsx";
import { getTurnReviewNotes } from "../utils/interpreterTranslationQuality.js";

/**
 * @param {{
 *   turn: import('../types.js').InterpreterTurn;
 *   index: number;
 *   labels: object;
 * }} props
 */
export default function InterpreterTurnDocument({ turn, index, labels: t }) {
  const { language: uiLanguage } = useLanguage();
  const speakerLabel =
    turn.speaker === SPEAKER_DOCTOR
      ? t.room.turnClinician
      : t.room.turnPatient;

  const turnTitle = t.review.turnNumber.replace("{{n}}", String(index + 1));
  const sourceLang = formatLanguageDisplayName(uiLanguage, turn.sourceLanguage);
  const targetLang = formatLanguageDisplayName(uiLanguage, turn.targetLanguage);
  const langDirection = t.review.langDirection
    .replace("{{source}}", sourceLang)
    .replace("{{target}}", targetLang);

  const qualityNotes = getTurnReviewNotes(turn, t);

  return (
    <article
      className="interpreter-review__turn"
      aria-labelledby={`interp-turn-${turn.turnId}-title`}
    >
      <header className="interpreter-review__turn-header">
        <h4 id={`interp-turn-${turn.turnId}-title`} className="interpreter-review__turn-title">
          {turnTitle}
        </h4>
        <p className="interpreter-review__turn-meta">
          <span className="interpreter-review__turn-speaker">{speakerLabel}</span>
          <span className="interpreter-review__turn-langs"> · {langDirection}</span>
        </p>
      </header>

      <div className="interpreter-review__turn-block interpreter-review__turn-block--original">
        <h5 className="interpreter-review__turn-label">{t.review.originalLabel}</h5>
        <InterpreterMultilingualText
          text={turn.originalText || "—"}
          languageCode={turn.sourceLanguage}
          className="interpreter-review__turn-text"
        />
        {turn.status === TURN_STATUS_DRAFT && turn.confidence === "low" ? (
          <p className="interpreter-review__turn-note" role="note">
            {t.transcript.lowConfidenceInput}
          </p>
        ) : null}
      </div>

      {turn.status === TURN_STATUS_DRAFT ? (
        <p className="interpreter-feedback interpreter-feedback--caution" role="note">
          {t.review.turnDraft}
        </p>
      ) : null}

      {turn.status === TURN_STATUS_BLOCKED ? (
        <p className="interpreter-feedback interpreter-feedback--blocked" role="note">
          {t.review.turnBlocked}
        </p>
      ) : null}

      {turn.status === TURN_STATUS_ERROR ? (
        <p className="interpreter-feedback interpreter-feedback--error" role="note">
          {t.review.turnError}
        </p>
      ) : null}

      {turn.status === TURN_STATUS_TRANSLATED && turn.translatedText?.trim() ? (
        <div className="interpreter-review__turn-block interpreter-review__turn-block--translation">
          <h5 className="interpreter-review__turn-label">{t.review.translatedLabel}</h5>
          <InterpreterMultilingualText
            text={turn.translatedText}
            languageCode={turn.targetLanguage}
            className={`interpreter-review__turn-text${
              turn.confidence === "low" || turn.translationUncertain
                ? " interpreter-review__turn-text--uncertain"
                : ""
            }`}
          />
          {qualityNotes.length > 0 ? (
            <ul className="interpreter-review__turn-notes" role="list">
              {qualityNotes.map((note) => (
                <li key={note} className="interpreter-review__turn-note" role="note">
                  {note}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {turn.simplifiedText?.trim() ? (
        <div className="interpreter-review__turn-block interpreter-review__turn-block--simplified">
          <h5 className="interpreter-review__turn-label">{t.review.simplifiedLabel}</h5>
          <InterpreterMultilingualText
            text={turn.simplifiedText}
            languageCode={turn.targetLanguage}
            className="interpreter-review__turn-text"
          />
          <p className="interpreter-review__turn-note" role="note">
            {t.simplify.note}
          </p>
        </div>
      ) : null}
    </article>
  );
}
