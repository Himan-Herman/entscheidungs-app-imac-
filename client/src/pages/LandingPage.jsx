import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import heroPoster from "../assets/media/hero-medscoutx.png";
import demoVideo from "../assets/media/medscoutx-demo.mp4";
import "../styles/LandingPage.css";

const copy = {
  de: {
    languageLabel: "Sprache",
    skip: "Zum Inhalt springen",
    login: "Login",
    register: "Registrieren",
    continue: "Zur App",
    badge: "KI-gestützte medizinische Orientierung",
    headline: "MedScoutX bringt Struktur in gesundheitliche Unsicherheit.",
    description:
      "Erhalte eine moderne, vertrauenswürdige Ersteinschätzung mit Symptom-Dialog, Körperkarte und Bildanalyse. MedScoutX hilft dir, Beschwerden besser einzuordnen und den nächsten sinnvollen Schritt vorzubereiten.",
    primaryCta: "Jetzt kostenlos starten",
    secondaryCta: "Zum Login",
    supportText: "Für Patientinnen und Patienten, die schneller Orientierung wollen.",
    highlightsTitle: "Warum MedScoutX",
    highlights: [
      "Geführte Symptom-Erfassung mit klaren, verständlichen Nachfragen.",
      "Körperkarte für eine schnelle Navigation zur betroffenen Region.",
      "Visuelle Analyse für medizinische Bilder mit sicherem, ruhigem UX.",
    ],
    metricA: "Schneller Einstieg",
    metricB: "DE / EN bereit",
    metricC: "Fokus auf Vertrauen",
    mediaEyebrow: "Produktvorschau",
    mediaTitle: "So präsentiert sich MedScoutX auf Desktop und mobil.",
    mediaText:
      "Die Landingpage führt Besucher direkt zu Registrierung oder Login und schafft gleichzeitig einen starken ersten Eindruck für das Produkt.",
    sectionTitle: "Ein professioneller Einstieg für neue Nutzer",
    sectionText:
      "Die Seite ist bewusst öffentlich gehalten: Besucher können sich zuerst informieren, die Sprache wechseln und dann selbst entscheiden, ob sie sich registrieren oder einloggen möchten.",
    disclaimer:
      "MedScoutX ersetzt keine ärztliche Diagnose und ist nicht für Notfälle gedacht.",
    imprint: "Impressum",
    privacy: "Datenschutz",
  },
  en: {
    languageLabel: "Language",
    skip: "Skip to content",
    login: "Login",
    register: "Register",
    continue: "Open App",
    badge: "AI-assisted medical guidance",
    headline: "MedScoutX brings clarity to health uncertainty.",
    description:
      "Get a modern, trustworthy first orientation with guided symptom dialogue, body mapping, and image analysis. MedScoutX helps people understand symptoms better and prepare the next sensible step.",
    primaryCta: "Start for free",
    secondaryCta: "Go to login",
    supportText: "Built for people who want faster orientation with a calm professional experience.",
    highlightsTitle: "Why MedScoutX",
    highlights: [
      "Guided symptom intake with focused follow-up questions.",
      "A body map that helps users navigate directly to the affected area.",
      "Visual analysis for medical images with a composed, trustworthy experience.",
    ],
    metricA: "Fast onboarding",
    metricB: "DE / EN ready",
    metricC: "Trust-first UX",
    mediaEyebrow: "Product preview",
    mediaTitle: "A polished MedScoutX introduction on desktop and mobile.",
    mediaText:
      "The landing page guides visitors straight to registration or login while creating a strong first impression of the product.",
    sectionTitle: "A professional public entry point",
    sectionText:
      "This page is intentionally public: visitors can learn what MedScoutX does, switch languages, and then decide whether they want to register or sign in.",
    disclaimer:
      "MedScoutX does not replace a medical diagnosis and is not intended for emergencies.",
    imprint: "Imprint",
    privacy: "Privacy",
  },
};

export default function LandingPage() {
  const { language, setLanguage, supportedLanguages } = useLanguage();

  const isLoggedIn = !!localStorage.getItem("medscout_user_id");
  const currentCopy = useMemo(() => copy[language] ?? copy.de, [language]);

  useEffect(() => {
    document.title = language === "en"
      ? "MedScoutX - Medical guidance for your next step"
      : "MedScoutX - Medizinische Orientierung für den nächsten Schritt";
  }, [language]);

  return (
    <div className="landing-page">
      <a href="#landing-main" className="landing-page__skip-link">
        {currentCopy.skip}
      </a>

      <header className="landing-page__header">
        <div className="landing-page__brand-block">
          <div className="landing-page__logo-mark" aria-hidden="true">
            <span>+</span>
          </div>
          <div>
            <p className="landing-page__brand-name">MedScoutX</p>
            <p className="landing-page__brand-tagline">{currentCopy.badge}</p>
          </div>
        </div>

        <div className="landing-page__header-actions">
          <div className="landing-page__language-switch" aria-label={currentCopy.languageLabel}>
            <span className="landing-page__language-label">{currentCopy.languageLabel}</span>
            <div className="landing-page__language-options" role="group" aria-label={currentCopy.languageLabel}>
              {supportedLanguages.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`landing-page__language-button ${language === option ? "is-active" : ""}`}
                  onClick={() => setLanguage(option)}
                  aria-pressed={language === option}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="landing-page__auth-links">
            <Link className="landing-page__ghost-link" to="/login">
              {currentCopy.login}
            </Link>
            <Link className="landing-page__solid-link" to={isLoggedIn ? "/startseite" : "/register"}>
              {isLoggedIn ? currentCopy.continue : currentCopy.register}
            </Link>
          </div>
        </div>
      </header>

      <main id="landing-main" className="landing-page__main">
        <section className="landing-page__hero">
          <div className="landing-page__hero-copy">
            <p className="landing-page__eyebrow">{currentCopy.badge}</p>
            <h1 className="landing-page__headline">{currentCopy.headline}</h1>
            <p className="landing-page__description">{currentCopy.description}</p>

            <div className="landing-page__cta-row">
              <Link className="landing-page__cta landing-page__cta--primary" to={isLoggedIn ? "/startseite" : "/register"}>
                {isLoggedIn ? currentCopy.continue : currentCopy.primaryCta}
              </Link>
              <Link className="landing-page__cta landing-page__cta--secondary" to="/login">
                {currentCopy.secondaryCta}
              </Link>
            </div>

            <p className="landing-page__support-text">{currentCopy.supportText}</p>

            <div className="landing-page__metrics" aria-label={currentCopy.highlightsTitle}>
              <div className="landing-page__metric-card">
                <span>01</span>
                <strong>{currentCopy.metricA}</strong>
              </div>
              <div className="landing-page__metric-card">
                <span>02</span>
                <strong>{currentCopy.metricB}</strong>
              </div>
              <div className="landing-page__metric-card">
                <span>03</span>
                <strong>{currentCopy.metricC}</strong>
              </div>
            </div>
          </div>

          <div className="landing-page__hero-media">
            <div className="landing-page__media-shell">
              <div className="landing-page__media-copy">
                <p className="landing-page__media-eyebrow">{currentCopy.mediaEyebrow}</p>
                <h2>{currentCopy.mediaTitle}</h2>
                <p>{currentCopy.mediaText}</p>
              </div>

              <div className="landing-page__video-frame">
                <video
                  className="landing-page__video"
                  src={demoVideo}
                  poster={heroPoster}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              </div>
            </div>
          </div>
        </section>

        <section className="landing-page__details" aria-labelledby="landing-details-title">
          <div className="landing-page__details-card">
            <h2 id="landing-details-title">{currentCopy.sectionTitle}</h2>
            <p>{currentCopy.sectionText}</p>
          </div>

          <div className="landing-page__details-card">
            <h2>{currentCopy.highlightsTitle}</h2>
            <ul className="landing-page__highlights">
              {currentCopy.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="landing-page__footer">
        <p>{currentCopy.disclaimer}</p>
        <div className="landing-page__footer-links">
          <Link to="/impressum?public=1">{currentCopy.imprint}</Link>
          <Link to="/datenschutz?public=1">{currentCopy.privacy}</Link>
        </div>
      </footer>
    </div>
  );
}
