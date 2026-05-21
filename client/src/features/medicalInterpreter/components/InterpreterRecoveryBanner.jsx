/**
 * @param {{
 *   message: string;
 *   retryLabel: string;
 *   onRetry: () => void;
 *   onDismiss?: () => void;
 *   dismissLabel?: string;
 *   busy?: boolean;
 * }} props
 */
export default function InterpreterRecoveryBanner({
  message,
  retryLabel,
  onRetry,
  onDismiss,
  dismissLabel,
  busy = false,
}) {
  return (
    <div className="interpreter-recovery" role="region" aria-label={message}>
      <p className="interpreter-recovery__message">{message}</p>
      <div className="interpreter-recovery__actions">
        <button
          type="button"
          className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
          onClick={onRetry}
          disabled={busy}
          aria-busy={busy}
        >
          {retryLabel}
        </button>
        {onDismiss && dismissLabel ? (
          <button
            type="button"
            className="medical-interpreter-page__nav-link"
            onClick={onDismiss}
            disabled={busy}
          >
            {dismissLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
