import { Component } from "react";
import { Link } from "react-router-dom";
import "../styles/LiveTranslationPage.css";

const FALLBACK_COPY = {
  de: {
    title: "Meda konnte die Sitzung nicht korrekt laden",
    body: "Bitte laden Sie die Seite neu. Wenn das Problem bleibt, kehren Sie zum Patientenbereich zurück.",
    retry: "Seite neu laden",
    back: "Zurück zum Patientenbereich",
  },
  en: {
    title: "Meda could not load the session correctly",
    body: "Please reload the page. If the problem persists, return to the patient area.",
    retry: "Reload page",
    back: "Back to patient area",
  },
};

/**
 * Catches render/runtime errors in the live translation tree — avoids blank white screen.
 */
export default class LiveTranslationErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("[live-translation] render error", error, info?.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: "" });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const lang = String(this.props.uiLanguage || "de").toLowerCase().startsWith("en")
        ? "en"
        : "de";
      const copy = FALLBACK_COPY[lang];
      return (
        <div className="live-translation live-translation--error-fallback" role="alert">
          <div className="live-translation__error-fallback-inner">
            <h1 className="live-translation__error-fallback-title">{copy.title}</h1>
            <p className="live-translation__error-fallback-body">{copy.body}</p>
            {import.meta.env.DEV && this.state.errorMessage ? (
              <p className="live-translation__error-fallback-dev">{this.state.errorMessage}</p>
            ) : null}
            <div className="live-translation__error-fallback-actions">
              <button
                type="button"
                className="live-translation__error-fallback-btn live-translation__error-fallback-btn--primary"
                onClick={this.handleRetry}
              >
                {copy.retry}
              </button>
              <Link
                className="live-translation__error-fallback-btn live-translation__error-fallback-btn--secondary"
                to="/patient"
              >
                {copy.back}
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
