import { useMemo, useState } from "react";
import { PencilLine, RotateCcw } from "lucide-react";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import { LIVE_TRANSLATION_LANGUAGE_OPTIONS } from "../languages.js";

function turnStatusLabel(status, turnT) {
  const labels = turnT || {};
  switch (status) {
    case "unclear":
      return labels.statusUnclear || "—";
    case "wrongLanguage":
      return labels.statusWrongLanguage || "—";
    case "corrected":
      return labels.statusCorrected || "—";
    case "replayed":
      return labels.statusReplayed || "—";
    default:
      return labels.statusTranslated || "—";
  }
}

function formatTurnTime(iso, lang) {
  try {
    if (!iso) return "";
    const time = new Date(iso).getTime();
    if (!Number.isFinite(time)) return "";
    return new Date(time).toLocaleTimeString(getPrimaryIntlLocale(lang), {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** @param {unknown} turn */
function normalizeTurnForDisplay(turn) {
  if (!turn || typeof turn !== "object") return null;
  const t = /** @type {Record<string, unknown>} */ (turn);
  return {
    id: typeof t.id === "string" ? t.id : `turn-${Date.now()}`,
    speaker: t.speaker === "doctor" ? "doctor" : "patient",
    sourceLanguage: typeof t.sourceLanguage === "string" ? t.sourceLanguage : "",
    targetLanguage: typeof t.targetLanguage === "string" ? t.targetLanguage : "",
    originalText: typeof t.originalText === "string" ? t.originalText : "",
    originalMissing: Boolean(t.originalMissing),
    translatedText: typeof t.translatedText === "string" ? t.translatedText : "",
    timestamp: typeof t.timestamp === "string" ? t.timestamp : "",
    status: typeof t.status === "string" ? t.status : "translated",
    correctsTurnId: typeof t.correctsTurnId === "string" ? t.correctsTurnId : undefined,
    wrongOriginalText: typeof t.wrongOriginalText === "string" ? t.wrongOriginalText : undefined,
    wrongTranslatedText: typeof t.wrongTranslatedText === "string" ? t.wrongTranslatedText : undefined,
  };
}

function resolveLanguageLabel(code) {
  return LIVE_TRANSLATION_LANGUAGE_OPTIONS.find((o) => o.code === code)?.label || code;
}

function TurnWrong({ turn, turnT }) {
  return (
    <div className="live-translation__turn-wrong">
      <span className="live-translation__turn-field-label">{turnT.wrongVersion}</span>
      {turn.wrongOriginalText ? (
        <p className="live-translation__turn-original">{turn.wrongOriginalText}</p>
      ) : null}
      {turn.wrongTranslatedText ? (
        <p className="live-translation__turn-translated">{turn.wrongTranslatedText}</p>
      ) : null}
    </div>
  );
}

function TurnHistoryBody({ turn, turnT }) {
  if (turn.status === "unclear") {
    return (
      <div className="live-translation__turn-body">
        <p className="live-translation__turn-original live-translation__turn-original--missing">
          <span className="live-translation__turn-field-label">{turnT.original}</span>
          {turnT.originalMissing}
        </p>
        <p className="live-translation__turn-repeat-prompt" role="status">
          {turnT.repeatPrompt}
        </p>
        <p className="live-translation__turn-translated live-translation__turn-translated--unclear">
          <span className="live-translation__turn-field-label">{turnT.translated}</span>
          {turn.translatedText}
        </p>
      </div>
    );
  }

  if (turn.status === "wrongLanguage") {
    return (
      <div className="live-translation__turn-body">
        <p className="live-translation__turn-original live-translation__turn-original--missing">
          <span className="live-translation__turn-field-label">{turnT.original}</span>
          {turnT.originalMissing}
        </p>
        <p
          className="live-translation__turn-repeat-prompt live-translation__turn-repeat-prompt--wrong-language"
          role="status"
        >
          {turnT.wrongLanguagePrompt}
        </p>
        <p className="live-translation__turn-translated live-translation__turn-translated--wrong-language">
          <span className="live-translation__turn-field-label">{turnT.translated}</span>
          {turn.translatedText}
        </p>
      </div>
    );
  }

  return (
    <div className="live-translation__turn-body">
      {turn.originalText ? (
        <p className="live-translation__turn-original">
          <span className="live-translation__turn-field-label">{turnT.original}</span>
          {turn.originalText}
        </p>
      ) : turn.status !== "corrected" ? (
        <p className="live-translation__turn-original live-translation__turn-original--missing">
          <span className="live-translation__turn-field-label">{turnT.original}</span>
          {turnT.originalMissing}
        </p>
      ) : null}
      <p className="live-translation__turn-translated">
        <span className="live-translation__turn-field-label">{turnT.translated}</span>
        {turn.translatedText}
      </p>
    </div>
  );
}

function TurnCorrectionPanel({ turn, turnT, liveT, disabled, onSubmit, onCancel }) {
  const [mode, setMode] = useState("source");
  const [text, setText] = useState(turn.originalText || turn.translatedText || "");

  const sourceLabel = resolveLanguageLabel(turn.sourceLanguage);
  const targetLabel = resolveLanguageLabel(turn.targetLanguage);

  const handleSubmit = () => {
    if (!text.trim()) return;
    const ok = onSubmit(text.trim(), turn, mode);
    if (ok) onCancel();
  };

  return (
    <div className="live-translation__turn-correction" role="region" aria-label={turnT.correctionPanelAria}>
      <fieldset className="live-translation__turn-correction-modes">
        <legend className="live-translation__turn-correction-legend">{turnT.correctionModeLegend}</legend>
        <label className="live-translation__turn-correction-mode">
          <input
            type="radio"
            name={`correction-mode-${turn.id}`}
            value="source"
            checked={mode === "source"}
            disabled={disabled}
            onChange={() => {
              setMode("source");
              setText(turn.originalText || "");
            }}
          />
          <span>{turnT.correctionModeSource.replace("{language}", sourceLabel)}</span>
        </label>
        <label className="live-translation__turn-correction-mode">
          <input
            type="radio"
            name={`correction-mode-${turn.id}`}
            value="translation"
            checked={mode === "translation"}
            disabled={disabled}
            onChange={() => {
              setMode("translation");
              setText(turn.translatedText || "");
            }}
          />
          <span>{turnT.correctionModeTranslation.replace("{language}", targetLabel)}</span>
        </label>
      </fieldset>

      <label className="live-translation__turn-correction-label" htmlFor={`turn-correction-${turn.id}`}>
        {mode === "source"
          ? turnT.correctionSourceLabel.replace("{language}", sourceLabel)
          : turnT.correctionTranslationLabel.replace("{language}", targetLabel)}
      </label>
      <textarea
        id={`turn-correction-${turn.id}`}
        className="live-translation__turn-correction-input"
        rows={3}
        value={text}
        disabled={disabled}
        placeholder={
          mode === "source" ? turnT.correctionSourcePlaceholder : turnT.correctionTranslationPlaceholder
        }
        onChange={(e) => setText(e.target.value)}
      />
      <div className="live-translation__turn-correction-actions">
        <button
          type="button"
          className="live-translation__primary live-translation__turn-correction-submit"
          disabled={disabled || !text.trim()}
          aria-label={liveT.translateCorrectionAria}
          onClick={handleSubmit}
        >
          {liveT.translateCorrection}
        </button>
        <button
          type="button"
          className="live-translation__secondary live-translation__turn-correction-cancel"
          disabled={disabled}
          onClick={onCancel}
        >
          {turnT.correctionCancel}
        </button>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   turns: Array<Record<string, unknown>>;
 *   t: Record<string, unknown>;
 *   uiLanguage: string;
 *   disabled?: boolean;
 *   onRepeatTurn?: (turn: Record<string, unknown>) => boolean;
 *   onSubmitCorrection?: (text: string, turn: Record<string, unknown>, mode: "source" | "translation") => boolean;
 * }} props
 */
export default function LiveTranslationTurnHistory({
  turns,
  t,
  uiLanguage,
  disabled = false,
  onRepeatTurn,
  onSubmitCorrection,
}) {
  const liveT = /** @type {Record<string, string>} */ (t.live || {});
  const turnT = /** @type {Record<string, string>} */ (t.turn || {});
  const [correctionTurnId, setCorrectionTurnId] = useState(/** @type {string | null} */ (null));

  const displayTurns = useMemo(() => {
    const list = (Array.isArray(turns) ? turns : [])
      .map(normalizeTurnForDisplay)
      .filter(Boolean);
    return list.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      const sa = Number.isFinite(ta) ? ta : 0;
      const sb = Number.isFinite(tb) ? tb : 0;
      return sb - sa;
    });
  }, [turns]);

  return (
    <section className="live-translation__turns-panel" aria-label={liveT.turnHistory}>
      <h2 className="live-translation__turns-title">{liveT.turnHistory}</h2>

      <div
        className={[
          "live-translation__turns-scroll",
          displayTurns.length === 0 ? "live-translation__turns-scroll--empty" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={displayTurns.length === 0 ? undefined : liveT.historyListAria}
      >
        {displayTurns.length === 0 ? (
          <p className="live-translation__turns-empty">{liveT.historyEmpty}</p>
        ) : (
          <ol className="live-translation__turns-list">
            {displayTurns.map((turn, index) => {
              const speakerLabel =
                turn.speaker === "patient" ? turnT.speakerPatient : turnT.speakerDoctor;
              const sourceLabel = resolveLanguageLabel(turn.sourceLanguage);
              const targetLabel = resolveLanguageLabel(turn.targetLanguage);
              const directionLabel = `${sourceLabel} → ${targetLabel}`;
              const hasCorrectionChild = turns.some((item) => item.correctsTurnId === turn.id);
              const turnTime = turn.timestamp ? formatTurnTime(turn.timestamp, uiLanguage) : "";
              const canCorrect =
                !hasCorrectionChild && turn.status !== "corrected" && Boolean(onSubmitCorrection);
              const showCorrectionPanel = correctionTurnId === turn.id;

              return (
                <li
                  key={turn.id || `${turn.timestamp}-${index}`}
                  className={[
                    "live-translation__turn",
                    turn.status === "corrected" ? "live-translation__turn--corrected" : "",
                    turn.status === "unclear" ? "live-translation__turn--unclear" : "",
                    turn.status === "wrongLanguage" ? "live-translation__turn--wrong-language" : "",
                    hasCorrectionChild ? "live-translation__turn--superseded" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <header className="live-translation__turn-header">
                    <div className="live-translation__turn-header-top">
                      <span className="live-translation__turn-speaker">{speakerLabel}</span>
                      <span
                        className={[
                          "live-translation__turn-status",
                          `live-translation__turn-status--${turn.status || "translated"}`,
                        ].join(" ")}
                      >
                        {turnStatusLabel(turn.status, turnT)}
                      </span>
                    </div>
                    <div className="live-translation__turn-header-meta">
                      <span className="live-translation__turn-direction">{directionLabel}</span>
                      {turn.timestamp ? (
                        <time className="live-translation__turn-time" dateTime={turn.timestamp}>
                          {turnTime}
                        </time>
                      ) : null}
                    </div>
                  </header>

                  {turn.status === "corrected" && (turn.wrongOriginalText || turn.wrongTranslatedText) ? (
                    <TurnWrong turn={turn} turnT={turnT} />
                  ) : null}

                  {turn.status === "corrected" ? (
                    <p className="live-translation__turn-field-label live-translation__turn-corrected-label">
                      {turnT.correctedVersion}
                    </p>
                  ) : null}

                  <TurnHistoryBody turn={turn} turnT={turnT} />

                  <div className="live-translation__turn-actions" role="group" aria-label={turnT.actionsGroupAria}>
                    <button
                      type="button"
                      className="live-translation__turn-action"
                      disabled={disabled || !onRepeatTurn}
                      title={turnT.repeatTitle}
                      aria-label={turnT.repeatAria}
                      onClick={() => onRepeatTurn?.(turn)}
                    >
                      <RotateCcw size={20} strokeWidth={2} aria-hidden="true" />
                      <span className="live-translation__turn-action-label">{turnT.repeatLabel}</span>
                    </button>
                    <button
                      type="button"
                      className="live-translation__turn-action"
                      disabled={disabled || !canCorrect}
                      title={turnT.correctTitle}
                      aria-label={turnT.correctAria}
                      aria-expanded={showCorrectionPanel}
                      aria-controls={showCorrectionPanel ? `turn-correction-panel-${turn.id}` : undefined}
                      onClick={() =>
                        setCorrectionTurnId((current) => (current === turn.id ? null : turn.id))
                      }
                    >
                      <PencilLine size={20} strokeWidth={2} aria-hidden="true" />
                      <span className="live-translation__turn-action-label">{turnT.correctLabel}</span>
                    </button>
                  </div>

                  {showCorrectionPanel && onSubmitCorrection ? (
                    <div id={`turn-correction-panel-${turn.id}`}>
                      <TurnCorrectionPanel
                        turn={turn}
                        turnT={turnT}
                        liveT={liveT}
                        disabled={disabled}
                        onSubmit={onSubmitCorrection}
                        onCancel={() => setCorrectionTurnId(null)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
