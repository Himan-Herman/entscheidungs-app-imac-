import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/img/medscout-logo6.png";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { readUserMode, USER_MODES } from "../utils/userMode.js";
import "../styles/Intro.css";

export default function Intro() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [fadeOut, setFadeOut] = useState(false);

  const copy = useMemo(() => {
    const m = getMessages(language);
    return m.intro ?? getMessages("en").intro;
  }, [language]);

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
    const home =
      readUserMode() === USER_MODES.PRACTICE ? "/practice" : "/patient";
    const navigateTimer = setTimeout(
      () => navigate(home, { replace: true }),
      navigateDelay,
    );

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(navigateTimer);
    };
  }, [copy.title, copy.status, copy.skip, navigate]);

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
