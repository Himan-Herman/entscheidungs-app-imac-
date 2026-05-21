import { INTERPRETER_MAX_TURN_CHARS, TURN_STATUS_DRAFT } from "../constants.js";
import {
  interpreterLangAttribute,
  interpreterTextDirection,
} from "../utils/interpreterLocale.js";

/**
 * @param {{
 *   turn: import('../types.js').InterpreterTurn | null;
 *   draftText: string;
 *   onDraftTextChange: (v: string) => void;
 *   onConfirm: () => void;
 *   canConfirm: boolean;
 *   isBusy?: boolean;
 *   showLowConfidence?: boolean;
 *   textareaRef?: import('react').RefObject<HTMLTextAreaElement|null>;
 *   labels: object;
 * }} props
 */
export default function InterpreterTranscriptPanel({
  turn,
  draftText,
  onDraftTextChange,
  onConfirm,
  canConfirm,
  isBusy = false,
  showLowConfidence = false,
  textareaRef,
  labels: t,
}) {
  const isEditable = turn?.status === TURN_STATUS_DRAFT && !isBusy;
  const contentDir = interpreterTextDirection(turn?.sourceLanguage || "en");
  const contentLang = interpreterLangAttribute(turn?.sourceLanguage);

  return (
    <section
      className="interpreter-live__panel interpreter-live__panel--transcript"
      aria-labelledby="interp-transcript-heading"
      aria-busy={isBusy}
    >
      <h2 id="interp-transcript-heading" className="interpreter-live__section-title">
        {t.transcript.heading}
      </h2>

      {!turn ? (
        <p className="interpreter-empty-state">{t.transcript.empty}</p>
      ) : (
        <>
          <p className="interpreter-live__hint">{t.transcript.editingHint}</p>
          <label className="interpreter-setup__label" htmlFor="interp-transcript-input">
            {t.live.currentTurn}
          </label>
          {showLowConfidence ? (
            <p
              id="interp-transcript-low-confidence"
              className="interpreter-feedback interpreter-feedback--caution"
              role="note"
            >
              {t.transcript.lowConfidenceInput}
            </p>
          ) : null}
          <textarea
            id="interp-transcript-input"
            ref={textareaRef}
            className="interpreter-live__textarea interpreter-prose"
            dir={contentDir}
            lang={contentLang}
            value={draftText}
            onChange={(e) => onDraftTextChange(e.target.value)}
            readOnly={!isEditable}
            aria-label={t.aria.transcriptEditor}
            aria-describedby={
              showLowConfidence ? "interp-transcript-low-confidence" : undefined
            }
            rows={4}
            maxLength={INTERPRETER_MAX_TURN_CHARS}
          />
          {canConfirm ? (
            <button
              type="button"
              className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary interpreter-setup__submit"
              onClick={onConfirm}
              disabled={isBusy}
              aria-label={t.aria.confirmTranscript}
            >
              {t.transcript.confirm}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
