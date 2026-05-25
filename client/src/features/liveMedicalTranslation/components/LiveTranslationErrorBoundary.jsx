import { Component } from "react";
import { Link } from "react-router-dom";

const FALLBACK_COPY = {
  de: {
    title: "Meda konnte die Sitzung nicht korrekt laden",
    body: "Bitte schließen Sie diese Seite und öffnen Sie die Live-Übersetzung erneut. Wenn das Problem bleibt, starten Sie den Browser neu.",
    back: "Zurück zum Patientenbereich",
  },
  en: {
    title: "Meda could not load the session correctly",
    body: "Please close this page and open live translation again. If the problem persists, restart your browser.",
    back: "Back to patient area",
  },
};

/**
 * Catches render/runtime errors in the live translation tree — avoids blank white screen.
 */
export default class LiveTranslationErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("[live-translation] render error", error?.message, info?.componentStack);
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
            <Link className="live-translation__primary" to="/patient">
              {copy.back}
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
