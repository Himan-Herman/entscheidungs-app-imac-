/**
 * @param {{
 *   isRecording: boolean;
 *   isPreparing?: boolean;
 *   isStopping?: boolean;
 *   onToggleRecording: () => void;
 *   disabled?: boolean;
 *   disabledReason?: string;
 *   privacyNote?: string;
 *   micDenied?: boolean;
 *   onRetryMic?: () => void;
 *   autoMode?: boolean;
 *   statusLabel?: string;
 *   labels: object;
 * }} props
 */
export default function InterpreterPushToTalkPanel({
  isRecording,
  isPreparing = false,
  isStopping = false,
  onToggleRecording,
  disabled = false,
  disabledReason = "",
  privacyNote,
  micDenied = false,
  onRetryMic,
  autoMode = false,
  statusLabel = "",
  labels: t,
}) {
  const btnClass = [
    "interpreter-live__ptt-btn",
    isRecording ? "interpreter-live__ptt-btn--recording" : "",
    isPreparing || isStopping ? "interpreter-live__ptt-btn--preparing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const label = isStopping
    ? t.pushToTalk.stopping
    : isPreparing
      ? t.pushToTalk.preparing
      : isRecording
        ? t.pushToTalk.stop
        : t.pushToTalk.recordTap;

  const ariaLabel = isStopping
    ? t.aria.stoppingRecording
    : isPreparing
      ? t.aria.preparingMic
      : isRecording
        ? t.aria.stopRecording
        : t.aria.startRecording;

  const describedBy = [
    privacyNote ? "interp-ptt-privacy" : null,
    disabled && disabledReason ? "interp-ptt-disabled-reason" : null,
    micDenied ? "interp-ptt-mic-denied" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const autoStatusText =
    statusLabel ||
    (isRecording
      ? t.conversation?.listening || t.pushToTalk.stop
      : isPreparing || isStopping
        ? t.pushToTalk.preparing
        : t.conversation?.waiting || t.room.statusIdle);

  return (
    <section
      className={
        autoMode
          ? "interpreter-live__ptt interpreter-live__ptt--auto"
          : "interpreter-live__ptt"
      }
      aria-labelledby="interp-ptt-heading"
    >
      <h2 id="interp-ptt-heading" className="interpreter-live__section-title visually-hidden">
        {autoMode ? t.conversation?.heading || t.pushToTalk.record : t.pushToTalk.record}
      </h2>
      {privacyNote ? (
        <p className="interpreter-live__ptt-privacy" id="interp-ptt-privacy">
          {privacyNote}
        </p>
      ) : null}
      {autoMode ? (
        <div
          className="interpreter-live__auto-listen"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="interpreter-live__auto-listen-label">{autoStatusText}</p>
        </div>
      ) : null}
      {disabled && disabledReason ? (
        <p id="interp-ptt-disabled-reason" className="visually-hidden">
          {disabledReason}
        </p>
      ) : null}
      {micDenied ? (
        <div
          id="interp-ptt-mic-denied"
          className="interpreter-live__ptt-mic-denied"
          role="region"
          aria-labelledby="interp-ptt-mic-denied-title"
        >
          <p id="interp-ptt-mic-denied-title">{t.pushToTalk.micDenied}</p>
          <p className="interpreter-live__ptt-mic-hint">{t.pushToTalk.micDeniedGuidance}</p>
          {onRetryMic ? (
            <button
              type="button"
              className="medical-interpreter-page__nav-link"
              onClick={onRetryMic}
            >
              {t.pushToTalk.micRetry}
            </button>
          ) : null}
        </div>
      ) : null}
      {!autoMode ? (
      <button
        type="button"
        className={btnClass}
        aria-pressed={isRecording}
        aria-busy={isPreparing || isStopping}
        aria-disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={describedBy || undefined}
        disabled={disabled || isPreparing || isStopping}
        onClick={onToggleRecording}
      >
        <span className="interpreter-live__ptt-label">{label}</span>
      </button>
      ) : null}
      {!autoMode && t.pushToTalk.liveHint ? (
        <p className="interpreter-live__ptt-live-hint" role="note">
          {t.pushToTalk.liveHint}
        </p>
      ) : null}
      {!autoMode ? (
      <p className="interpreter-live__ptt-keyboard-hint">{t.pushToTalk.keyboardHint}</p>
      ) : null}
    </section>
  );
}
