import { Link } from "react-router-dom";

/**
 * @param {{
 *   sessionId: string;
 *   onEndSession: () => void;
 *   onDeleteSession: () => void;
 *   onDownloadPdf?: () => void;
 *   sessionEnded?: boolean;
 *   actionsDisabled?: boolean;
 *   hasTurns?: boolean;
 *   isExporting?: boolean;
 *   labels: object;
 * }} props
 */
export default function InterpreterSessionActions({
  sessionId,
  onEndSession,
  onDeleteSession,
  onDownloadPdf,
  sessionEnded = false,
  actionsDisabled = false,
  hasTurns = false,
  isExporting = false,
  labels: t,
}) {
  const exportDisabled = actionsDisabled || isExporting || !hasTurns;

  return (
    <section
      className="interpreter-live__actions"
      aria-labelledby="interp-session-actions-heading"
    >
      <h2 id="interp-session-actions-heading" className="interpreter-live__section-title">
        {t.sessionActions.heading}
      </h2>

      <div className="interpreter-setup__actions">
        <Link
          className="medical-interpreter-page__nav-link"
          to="/patient/interpreter/setup"
        >
          {t.chrome.backToSetup}
        </Link>

        {!sessionEnded ? (
          <button
            type="button"
            className="medical-interpreter-page__nav-link"
            onClick={onEndSession}
            disabled={actionsDisabled}
            aria-busy={actionsDisabled}
          >
            {actionsDisabled
              ? t.sessionActions.endPreparing || t.sessionActions.end
              : t.sessionActions.end}
          </button>
        ) : null}

        <button
          type="button"
          className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
          onClick={() => onDownloadPdf?.()}
          disabled={exportDisabled}
          aria-busy={isExporting}
          aria-disabled={exportDisabled}
        >
          {isExporting ? t.pdf.exportLoading : t.sessionActions.export}
        </button>

        <Link
          className="medical-interpreter-page__nav-link"
          to={`/patient/interpreter/review?sessionId=${encodeURIComponent(sessionId)}`}
        >
          {t.history.review}
        </Link>

        <button
          type="button"
          className="medical-interpreter-page__nav-link interpreter-live__action-danger"
          onClick={onDeleteSession}
          disabled={actionsDisabled}
        >
          {t.sessionActions.delete}
        </button>
      </div>

      <p className="interpreter-setup__hint">
        {hasTurns ? t.sessionActions.exportHint : t.sessionActions.exportUnavailable}
      </p>
    </section>
  );
}
