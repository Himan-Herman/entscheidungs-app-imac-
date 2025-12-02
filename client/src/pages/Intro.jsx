import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/img/medscout-logo.png";
import "../styles/Intro.css";

export default function Intro() {
  const navigate = useNavigate();
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    document.title = "MedScoutX – wird geladen …";

    // Nur registrierte Nutzer dürfen Intro sehen
    const hasUser = !!localStorage.getItem("medscout_user_id");
    if (!hasUser) {
      navigate("/startseite", { replace: true });
      return;
    }

    const alreadyShown = sessionStorage.getItem("introShown");

    // Für Screenreader / A11y: wenn schon gezeigt → direkt weiter
    if (alreadyShown) {
      navigate("/startseite", { replace: true });
      return;
    }

    sessionStorage.setItem("introShown", "true");

    // Motion-Einstellungen des Systems beachten (A11y)
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const fadeOutDelay = prefersReducedMotion ? 1000 : 4000;
    const navigateDelay = prefersReducedMotion ? 1200 : 5000;

    const fadeOutTimer = setTimeout(() => setFadeOut(true), fadeOutDelay);
    const navigateTimer = setTimeout(
      () => navigate("/startseite", { replace: true }),
      navigateDelay
    );

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(navigateTimer);
    };
  }, [navigate]);

  return (
    <>
      {/* Skip-Link für Screenreader & Tastatur */}
      <a href="#intro-main" className="sr-only sr-only-focusable">
        Intro überspringen
      </a>

      <div className="intro-container" aria-labelledby="intro-heading">
        {/* Rolle status + aria-live → Screenreader wissen: „App lädt“ */}
        <main
          id="intro-main"
          className="intro-content"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <h1 id="intro-heading" className="sr-only">
            MedScoutX wird gestartet
          </h1>

          <div className="intro-logo-wrapper">
            <img
              src={logo}
              alt="MedScoutX Logo"
              className={`intro-logo ${fadeOut ? "fade-out" : "fade-in"}`}
            />
          </div>

          {/* Für Screenreader klar machen, was passiert */}
          <p className="intro-status-text">
            MedScoutX wird geladen. Du wirst gleich zur Startseite weitergeleitet.
          </p>
        </main>
      </div>
    </>
  );
}
