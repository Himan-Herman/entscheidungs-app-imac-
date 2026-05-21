/**
 * Optional streaming transcript preview (Phase 5.3) — experimental; PTT remains default.
 */

/**
 * @param {{
 *   available: boolean;
 *   phase: string;
 *   isActive: boolean;
 *   connectionLabel: string;
 *   previewText: string;
 *   stagedMessage: string;
 *   previewConfidence?: string;
 *   browserSupported: boolean;
 *   disabled?: boolean;
 *   onStart: () => void;
 *   onStop: () => void;
 *   onCancel: () => void;
 *   onUseAsDraft: () => void;
 *   canUseAsDraft: boolean;
 *   labels: object;
 * }} props
 */
export default function InterpreterStreamingPanel({
  available,
  phase,
  isActive,
  connectionLabel,
  previewText,
  stagedMessage,
  previewConfidence,
  browserSupported,
  disabled = false,
  onStart,
  onStop,
  onCancel,
  onUseAsDraft,
  canUseAsDraft,
  labels: t,
}) {
  if (!available) {
    return null;
  }

  const connectionText = () => {
    if (!browserSupported) return t.streaming.unsupportedBrowser;
    if (connectionLabel === "connecting") return t.streaming.statusConnecting;
    if (connectionLabel === "processing") return t.streaming.statusProcessing;
    if (connectionLabel === "finalizing") return t.streaming.statusFinalizing;
    if (connectionLabel === "connected" || isActive) return t.streaming.statusConnected;
    return t.streaming.statusIdle;
  };

  return (
    <section
      className={`interpreter-streaming${isActive ? " interpreter-streaming--active" : ""}`}
      aria-labelledby="interp-streaming-heading"
      aria-busy={isActive || phase === "finalizing"}
    >
      <h2 id="interp-streaming-heading" className="interp-practice-dash__section-title">
        {t.streaming.heading}
      </h2>
      <p className="interpreter-streaming__badge" role="note">
        {t.streaming.experimentalBadge}
      </p>
      <p className="interpreter-streaming__privacy">{t.streaming.privacyNote}</p>
      <p className="interpreter-streaming__default-note" role="note">
        {t.streaming.pttDefaultNote}
      </p>

      <p
        className="interpreter-streaming__connection"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {connectionText()}
        {stagedMessage ? ` — ${stagedMessage}` : ""}
      </p>

      <div
        className="interpreter-streaming__captions"
        role="region"
        aria-label={t.streaming.captionsAria}
        aria-live="polite"
        aria-relevant="additions text"
      >
        {previewText ? (
          <>
            <p className="interpreter-streaming__provisional-label">
              {t.streaming.provisionalLabel}
            </p>
            <p className="interpreter-streaming__preview" dir="auto">
              {previewText}
            </p>
            {previewConfidence === "low" ? (
              <p className="interpreter-feedback interpreter-feedback--caution" role="note">
                {t.transcript.lowConfidenceInput}
              </p>
            ) : null}
          </>
        ) : (
          <p className="interpreter-empty-state">{t.streaming.captionsEmpty}</p>
        )}
      </div>

      <div className="interpreter-streaming__actions">
        {!isActive ? (
          <button
            type="button"
            className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
            disabled={disabled || !browserSupported}
            onClick={onStart}
            aria-label={t.streaming.startAria}
          >
            {t.streaming.startButton}
          </button>
        ) : (
          <button
            type="button"
            className="medical-interpreter-page__nav-link interpreter-streaming__stop"
            disabled={disabled || phase === "finalizing"}
            onClick={onStop}
            aria-label={t.streaming.stopAria}
          >
            {phase === "finalizing" ? t.streaming.stopping : t.streaming.stopButton}
          </button>
        )}
        {isActive ? (
          <button
            type="button"
            className="medical-interpreter-page__nav-link"
            disabled={disabled || phase === "finalizing"}
            onClick={onCancel}
          >
            {t.streaming.cancelButton}
          </button>
        ) : null}
        {canUseAsDraft && !isActive ? (
          <button
            type="button"
            className="medical-interpreter-page__nav-link"
            disabled={disabled}
            onClick={onUseAsDraft}
          >
            {t.streaming.useAsDraftButton}
          </button>
        ) : null}
      </div>
    </section>
  );
}
