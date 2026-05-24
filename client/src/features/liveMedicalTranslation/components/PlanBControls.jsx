import { useState } from "react";

/**
 * @param {{
 *   t: Record<string, string>;
 *   disabled?: boolean;
 *   canReplay: boolean;
 *   latestTurnId: string | null;
 *   onStopVoice: () => void;
 *   onReplay: () => void;
 *   onAskRepeat: () => void;
 *   onSubmitCorrection: (text: string, correctsTurnId: string) => boolean;
 * }} props
 */
export default function PlanBControls({
  t,
  disabled = false,
  canReplay,
  latestTurnId,
  onStopVoice,
  onReplay,
  onAskRepeat,
  onSubmitCorrection,
}) {
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionText, setCorrectionText] = useState("");

  const handleOpenCorrection = () => {
    setCorrectionOpen(true);
  };

  const handleSubmitCorrection = () => {
    if (!latestTurnId || !correctionText.trim()) return;
    const ok = onSubmitCorrection(correctionText.trim(), latestTurnId);
    if (ok) {
      setCorrectionText("");
      setCorrectionOpen(false);
    }
  };

  return (
    <section className="live-translation__planb" aria-label={t.planBRegion}>
      <h2 className="live-translation__planb-title">{t.planBTitle}</h2>
      <div className="live-translation__planb-actions">
        <button
          type="button"
          className="live-translation__planb-btn"
          disabled={disabled}
          aria-label={t.stopVoiceAria}
          onClick={onStopVoice}
        >
          {t.stopVoice}
        </button>
        <button
          type="button"
          className="live-translation__planb-btn"
          disabled={disabled || !canReplay}
          aria-label={t.replayAria}
          onClick={onReplay}
        >
          {t.replayTranslation}
        </button>
        <button
          type="button"
          className="live-translation__planb-btn"
          disabled={disabled}
          aria-label={t.askRepeatAria}
          onClick={onAskRepeat}
        >
          {t.askRepeat}
        </button>
        <button
          type="button"
          className="live-translation__planb-btn"
          disabled={disabled || !latestTurnId}
          aria-label={t.enterCorrectionAria}
          aria-expanded={correctionOpen}
          onClick={handleOpenCorrection}
        >
          {t.enterCorrection}
        </button>
      </div>

      {correctionOpen ? (
        <div className="live-translation__planb-correction">
          <label htmlFor="live-translation-correction-text">{t.correctionLabel}</label>
          <textarea
            id="live-translation-correction-text"
            rows={3}
            value={correctionText}
            disabled={disabled}
            placeholder={t.correctionPlaceholder}
            onChange={(e) => setCorrectionText(e.target.value)}
          />
          <button
            type="button"
            className="live-translation__primary live-translation__planb-submit"
            disabled={disabled || !correctionText.trim() || !latestTurnId}
            aria-label={t.translateCorrectionAria}
            onClick={handleSubmitCorrection}
          >
            {t.translateCorrection}
          </button>
        </div>
      ) : null}
    </section>
  );
}
