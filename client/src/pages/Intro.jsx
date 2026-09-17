import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/img/medscout-logo.png";
import { useLanguage } from "../i18n/LanguageContext";
import { useTheme } from "../ThemeMode";
import { getMessages } from "../i18n/translations";
import "../styles/Intro.css";

/** Splash duration, and the same value the progress bar animates over. */
const HOLD_MS = 2600;
const HOLD_MS_REDUCED = 900;

/**
 * Brand splash shown right after sign-in.
 *
 * It hands over to the area chooser at /choose rather than jumping straight
 * into one of the two workspaces: which side of the product someone needs is
 * their decision, and a stored preference from an earlier session is a guess,
 * not an answer. The chooser writes the mode, so the header switch keeps
 * working exactly as before.
 */
export default function Intro() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  const copy = useMemo(() => {
    const m = getMessages(language);
    return m.intro ?? getMessages("en").intro;
  }, [language]);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const hold = reducedMotion ? HOLD_MS_REDUCED : HOLD_MS;

  // Guarded so the timer and the button cannot both navigate.
  const goToChooser = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    navigate("/choose", { replace: true });
  }, [navigate]);

  useEffect(() => {
    document.title = copy.title;
  }, [copy.title]);

  useEffect(() => {
    const hasUser = !!localStorage.getItem("medscout_user_id");
    if (!hasUser) {
      doneRef.current = true;
      navigate("/login", { replace: true });
      return undefined;
    }

    const fadeTimer = setTimeout(() => setLeaving(true), Math.max(hold - 380, 0));
    const goTimer = setTimeout(goToChooser, hold);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(goTimer);
    };
  }, [goToChooser, hold, navigate]);

  return (
    <div
      className={`intro${leaving ? " is-leaving" : ""}`}
      data-theme={theme}
      style={{ "--intro-hold": `${hold}ms` }}
    >
      <a href="#intro-main" className="sr-only sr-only-focusable">
        {copy.skip}
      </a>

      <div className="intro__backdrop" aria-hidden="true">
        <span className="intro__orb intro__orb--patient" />
        <span className="intro__orb intro__orb--practice" />
      </div>

      <main
        id="intro-main"
        className="intro__content"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <h1 id="intro-heading" className="sr-only">
          {copy.heading}
        </h1>

        <div className="intro__mark">
          <span className="intro__mark-glow" aria-hidden="true" />
          <img src={logo} alt={copy.logoAlt} className="intro__logo" />
        </div>

        <p className="intro__wordmark">MedScoutX</p>
        {copy.tagline ? (
          <p className="intro__tagline">{copy.tagline}</p>
        ) : null}

        <div
          className="intro__progress"
          role="progressbar"
          aria-label={copy.heading}
        >
          <span className="intro__progress-bar" />
        </div>

        <p className="intro__status">{copy.status}</p>

        <button type="button" className="intro__cta" onClick={goToChooser}>
          {copy.continue ?? copy.skip}
        </button>
      </main>
    </div>
  );
}
