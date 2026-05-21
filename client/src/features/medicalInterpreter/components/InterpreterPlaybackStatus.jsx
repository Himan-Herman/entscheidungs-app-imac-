/**
 * Announces TTS playback state for accessibility (Phase 5.5).
 */

/**
 * @param {{
 *   visible: boolean;
 *   isLoading: boolean;
 *   isPlaying: boolean;
 *   onStop?: () => void;
 *   stopDisabled?: boolean;
 *   labels: object;
 * }} props
 */
export default function InterpreterPlaybackStatus({
  visible,
  isLoading,
  isPlaying,
  onStop,
  stopDisabled = false,
  labels: t,
}) {
  if (!visible) {
    return null;
  }

  const statusText = isLoading
    ? t.streamingTts?.statusLoading || t.speak.loading
    : isPlaying
      ? t.streamingTts?.statusPlaying || t.speak.playbackPlaying
      : t.streamingTts?.statusIdle || t.speak.playbackStopped;

  return (
    <div className="interpreter-playback-status">
      <p
        className={`interpreter-playback-status__label${isPlaying ? " interpreter-playback-status__label--playing" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {statusText}
      </p>
      {isPlaying || isLoading ? (
        <button
          type="button"
          className="medical-interpreter-page__nav-link interpreter-playback-status__stop"
          onClick={onStop}
          disabled={stopDisabled}
          aria-label={t.streamingTts?.stopPlaybackAria || t.speak.stop}
        >
          {t.streamingTts?.stopPlayback || t.speak.stop}
        </button>
      ) : null}
    </div>
  );
}
