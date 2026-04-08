import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/img/medscout-logo6.png";
import { useLanguage } from "../i18n/LanguageContext";
import "../styles/Intro.css";

export default function Intro() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [fadeOut, setFadeOut] = useState(false);

  const copy = language === "en"
    ? {
        title: "MedScoutX - loading",
        skip: "Skip intro",
        heading: "MedScoutX is starting",
        status: "MedScoutX is loading. You will be redirected to the home screen shortly.",
      }
    : {
        title: "MedScoutX - wird geladen",
        skip: "Intro überspringen",
        heading: "MedScoutX wird gestartet",
        status: "MedScoutX wird geladen. Du wirst gleich zur Startseite weitergeleitet.",
      };

  useEffect(() => {
    document.title = copy.title;

    const hasUser = !!localStorage.getItem("medscout_user_id");
    if (!hasUser) {
      navigate("/login", { replace: true });
      return;
    }

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const fadeOutDelay = prefersReducedMotion ? 800 : 4000;
    const navigateDelay = prefersReducedMotion ? 1000 : 5000;

    const fadeOutTimer = setTimeout(() => setFadeOut(true), fadeOutDelay);
    const navigateTimer = setTimeout(
      () => navigate("/startseite", { replace: true }),
      navigateDelay
    );

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(navigateTimer);
    };
  }, [copy.title, navigate]);

  return (
    <>
      <a href="#intro-main" className="sr-only sr-only-focusable">
        {copy.skip}
      </a>

      <div className="intro-container" aria-labelledby="intro-heading">
        <main
          id="intro-main"
          className="intro-content"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <h1 id="intro-heading" className="sr-only">
            {copy.heading}
          </h1>

          <div className="intro-logo-wrapper">
            <img
              src={logo}
              alt="MedScoutX Logo"
              className={`intro-logo ${fadeOut ? "fade-out" : "fade-in"}`}
            />
          </div>

          <p className="intro-status-text">{copy.status}</p>
        </main>
      </div>
    </>
  );
}
