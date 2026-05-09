import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/KoerperregionStart.css";
import "../styles/BodyMapPages.css";
import { useTheme } from "../ThemeMode";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import DisclaimerShort from "../components/DisclaimerShort";
import {
  BODY_MAP_CONSENT_KEY,
  readBodyMapConsent,
} from "../features/bodyMap/bodyMapSession";

export default function KoerperregionStart() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const navigate = useNavigate();
  const [consentChecked, setConsentChecked] = useState(false);
  const [hubUnlocked, setHubUnlocked] = useState(() => readBodyMapConsent());

  const t = useMemo(() => {
    const b = getMessages(language);
    return b.bodyMap?.start ?? getMessages("en").bodyMap.start;
  }, [language]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    if (readBodyMapConsent()) setHubUnlocked(true);
  }, []);

  const persistConsent = () => {
    if (!consentChecked) return;
    try {
      localStorage.setItem(BODY_MAP_CONSENT_KEY, "1");
    } catch {
      /* ignore */
    }
    setHubUnlocked(true);
  };

  return (
    <main
      className={`koerper-start-page koerper-start-page--${theme}`}
      data-theme={theme}
      aria-labelledby="bodymap-heading"
      role="main"
      dir="ltr"
    >
      <div className="koerper-start-shell">
        <header className="koerper-start-header">
          <div>
            <h1 id="bodymap-heading" className="koerper-start-title">
              {t.title}
            </h1>
            <p className="koerper-start-subtitle">{t.subtitle}</p>
          </div>

          <div className="koerper-start-header-meta" aria-hidden="true">
            <span className="chip chip--accent">{t.chip1}</span>
            <span className="chip chip--soft">{t.chip2}</span>
          </div>
        </header>

        <section className="body-map-hub-safety" aria-label={t.title}>
          <p className="body-map-hub-safety__text">{t.storeDisclaimer}</p>
          <p className="body-map-hub-safety__emergency">{t.emergencyNote}</p>
        </section>

        <section className="koerper-disclaimer-short-wrap" aria-label={t.title}>
          <DisclaimerShort />
        </section>

        {!hubUnlocked ? (
          <section
            className="body-map-hub-consent"
            aria-labelledby="body-map-consent-title"
          >
            <h2
              id="body-map-consent-title"
              className="body-map-hub-consent__title"
            >
              {t.consentTitle}
            </h2>
            <label className="body-map-hub-consent__check">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <span>{t.consentCheckbox}</span>
            </label>
            <p className="body-map-hub-consent__links">
              <Link to="/datenschutz">{t.consentPrivacyLink}</Link>
            </p>
            <button
              type="button"
              className="body-map-hub-consent__cta"
              disabled={!consentChecked}
              onClick={persistConsent}
            >
              {t.consentContinue}
            </button>
          </section>
        ) : null}

        <section
          aria-label={t.panelTitle}
          className={`koerper-start-panel ${
            !hubUnlocked ? "koerper-start-panel--locked" : ""
          }`}
        >
          <p className="koerper-start-hint">{t.hint}</p>

          <button
            type="button"
            className="koerper-toggle-btn"
            onClick={() => setOptionsOpen((prev) => !prev)}
            aria-expanded={optionsOpen}
            aria-controls="bodymap-view-options"
          >
            <span className="koerper-toggle-label">
              {optionsOpen ? t.close : t.open}
            </span>
          </button>

          <div
            id="bodymap-view-options"
            className={`koerper-options ${
              optionsOpen ? "koerper-options--open" : ""
            }`}
          >
            <button
              type="button"
              className="option-chip"
              onClick={() => navigate("/koerperregionen")}
              aria-label={t.frontAria}
            >
              <span className="option-chip-title">{t.frontTitle}</span>
              <span className="option-chip-subtitle">{t.frontText}</span>
            </button>

            <button
              type="button"
              className="option-chip"
              onClick={() => navigate("/rueckseite")}
              aria-label={t.backAria}
            >
              <span className="option-chip-title">{t.backTitle}</span>
              <span className="option-chip-subtitle">{t.backText}</span>
            </button>
          </div>

          <p className="koerper-start-footer-text">{t.footer}</p>
        </section>
      </div>
    </main>
  );
}
