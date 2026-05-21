/**
 * Near-realtime translation preview (Phase 5.4) — not confirmed until user saves via draft flow.
 * Optional TTS for preview (Phase 5.5) — manual only, no autoplay.
 */

/**
 * @param {{
 *   available: boolean;
 *   isLoading: boolean;
 *   previewTranslation: string;
 *   isStale: boolean;
 *   uncertain: boolean;
 *   terminologyWarning: boolean;
 *   unclearSource: boolean;
 *   hasSourceText: boolean;
 *   disabled?: boolean;
 *   onDiscard: () => void;
 *   streamingTtsAvailable?: boolean;
 *   previewPlaybackEnabled?: boolean;
 *   onPreviewPlaybackEnabledChange?: (enabled: boolean) => void;
 *   onPlayPreview?: () => void;
 *   previewListenLoading?: boolean;
 *   previewListenPlaying?: boolean;
 *   previewListenDisabled?: boolean;
 *   onRetryPlayback?: () => void;
 *   showPlaybackRetry?: boolean;
 *   labels: object;
 * }} props
 */
export default function InterpreterNearRealtimePreviewPanel({
  available,
  isLoading,
  previewTranslation,
  isStale,
  uncertain,
  terminologyWarning,
  unclearSource,
  hasSourceText,
  disabled = false,
  onDiscard,
  streamingTtsAvailable = false,
  previewPlaybackEnabled = false,
  onPreviewPlaybackEnabledChange,
  onPlayPreview,
  previewListenLoading = false,
  previewListenPlaying = false,
  previewListenDisabled = false,
  onRetryPlayback,
  showPlaybackRetry = false,
  labels: t,
}) {
  if (!available) {
    return null;
  }

  const showWarnings = uncertain || terminologyWarning || unclearSource || isStale;
  const canPlayPreview =
    streamingTtsAvailable &&
    previewPlaybackEnabled &&
    Boolean(previewTranslation) &&
    !isStale;

  return (
    <section
      className="interpreter-near-realtime"
      aria-labelledby="interp-near-realtime-heading"
      aria-busy={isLoading}
    >
      <h2
        id="interp-near-realtime-heading"
        className="interp-practice-dash__section-title"
      >
        {t.nearRealtime.heading}
      </h2>
      <p className="interpreter-near-realtime__badge" role="note">
        {t.nearRealtime.experimentalBadge}
      </p>
      <p className="interpreter-near-realtime__privacy">{t.nearRealtime.privacyNote}</p>

      <p
        className="interpreter-near-realtime__status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isLoading
          ? t.nearRealtime.statusTranslating
          : previewTranslation
            ? t.nearRealtime.statusReady
            : hasSourceText
              ? t.nearRealtime.statusWaiting
              : t.nearRealtime.statusIdle}
      </p>

      <div
        className="interpreter-near-realtime__preview"
        role="region"
        aria-label={t.nearRealtime.previewAria}
        aria-live="polite"
        aria-relevant="additions text"
      >
        <p className="interpreter-near-realtime__provisional-label">
          {t.nearRealtime.notConfirmedLabel}
        </p>
        {previewTranslation ? (
          <p className="interpreter-near-realtime__translation" dir="auto">
            {previewTranslation}
          </p>
        ) : (
          <p className="interpreter-empty-state">{t.nearRealtime.previewEmpty}</p>
        )}
      </div>

      {showWarnings ? (
        <div className="interpreter-near-realtime__warnings" role="note">
          {isStale ? (
            <p className="interpreter-feedback interpreter-feedback--caution">
              {t.nearRealtime.staleWarning}
            </p>
          ) : null}
          {uncertain || terminologyWarning ? (
            <p className="interpreter-feedback interpreter-feedback--caution">
              {t.nearRealtime.lowConfidenceWarning}
            </p>
          ) : null}
          {unclearSource ? (
            <p className="interpreter-feedback interpreter-feedback--caution">
              {t.nearRealtime.unclearSourceWarning}
            </p>
          ) : null}
        </div>
      ) : null}

      {streamingTtsAvailable ? (
        <div className="interpreter-streaming-tts">
          <h3 className="interpreter-streaming-tts__subheading">
            {t.streamingTts.heading}
          </h3>
          <p className="interpreter-streaming-tts__badge" role="note">
            {t.streamingTts.experimentalBadge}
          </p>
          <p className="interpreter-streaming-tts__privacy">{t.streamingTts.privacyNote}</p>
          <label className="interpreter-streaming-tts__opt-in">
            <input
              type="checkbox"
              checked={previewPlaybackEnabled}
              disabled={disabled}
              onChange={(e) => onPreviewPlaybackEnabledChange?.(e.target.checked)}
            />
            <span>{t.streamingTts.enablePreviewPlayback}</span>
          </label>
          {!previewPlaybackEnabled && previewTranslation ? (
            <p className="interpreter-streaming-tts__hint" role="note">
              {t.streamingTts.previewDisabledHint}
            </p>
          ) : null}
          <div className="interpreter-streaming-tts__actions">
            <button
              type="button"
              className="medical-interpreter-page__nav-link interpreter-live__speak-btn"
              disabled={disabled || previewListenDisabled || !canPlayPreview}
              onClick={onPlayPreview}
              aria-label={
                previewListenPlaying
                  ? t.streamingTts.stopPlaybackAria
                  : t.streamingTts.playPreviewAria
              }
              aria-pressed={previewListenPlaying}
            >
              {previewListenLoading
                ? t.speak.loading
                : previewListenPlaying
                  ? t.streamingTts.stopPlayback
                  : t.streamingTts.playPreview}
            </button>
            {showPlaybackRetry ? (
              <button
                type="button"
                className="medical-interpreter-page__nav-link"
                disabled={disabled}
                onClick={onRetryPlayback}
              >
                {t.speak.retry}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="interpreter-near-realtime__confirm-note" role="note">
        {t.nearRealtime.confirmRequiredNote}
      </p>

      <div className="interpreter-near-realtime__actions">
        <button
          type="button"
          className="medical-interpreter-page__nav-link"
          disabled={disabled || !previewTranslation}
          onClick={onDiscard}
        >
          {t.nearRealtime.discardButton}
        </button>
      </div>
    </section>
  );
}
