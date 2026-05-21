import { Link } from "react-router-dom";

/**
 * @param {{
 *   sessionId: string;
 *   onEndSession: () => void;
 *   onDeleteSession: () => void;
 *   sessionEnded?: boolean;
 *   actionsDisabled?: boolean;
 *   labels: object;
 * }} props
 */
export default function InterpreterSessionActions({
  sessionId,
  onEndSession,
  onDeleteSession,
  sessionEnded = false,
  actionsDisabled = false,
  labels: t,
}) {
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
            {t.sessionActions.end}
          </button>
        ) : null}

        <Link
          className="medical-interpreter-page__nav-link medical-interpreter-page__nav-link--primary"
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

        <button
          type="button"
          className="medical-interpreter-page__nav-link"
          disabled
          title={t.sessionActions.exportUnavailable}
          aria-disabled="true"
        >
          {t.sessionActions.export}
        </button>
      </div>
      <p className="interpreter-setup__hint">{t.sessionActions.exportUnavailable}</p>
    </section>
  );
}
