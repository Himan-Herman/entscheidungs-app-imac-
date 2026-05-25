import { Component } from "react";
import { Link } from "react-router-dom";
import "../styles/LiveTranslationPage.css";

const FALLBACK_COPY = {
  de: {
    title: "Meda konnte nicht geladen werden",
    body: "Bitte später erneut versuchen.",
    back: "Zurück zum Patientenbereich",
  },
  en: {
    title: "Meda could not be loaded",
    body: "Please try again later.",
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
            <Link
              className="live-translation__error-fallback-btn live-translation__error-fallback-btn--primary"
              to="/patient"
            >
              {copy.back}
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
