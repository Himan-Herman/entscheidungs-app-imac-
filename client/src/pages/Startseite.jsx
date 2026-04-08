import React, { useEffect, useState } from "react";
import "../styles/Startseite.css";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../ThemeMode";
import { useLanguage } from "../i18n/LanguageContext";
import heroImage from "../assets/media/hero-medscoutx.png";
import demoVideo from "../assets/media/medscoutx-demo.mp4";

import {
  IconSymptomChat,
  IconBodyMap,
  IconImageAnalysis,
  IconAbo,
} from "../components/MedScoutIcons";

export default function Startseite() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { language } = useLanguage();

  const copy = language === "en"
    ? {
        title: "MedScoutX - Your smart health navigator",
        skip: "Skip to main content",
        tagline: "AI assistance for your health - not a replacement for clinicians.",
        themeAriaDark: "Dark mode active. Switch to light mode.",
        themeAriaLight: "Light mode active. Switch to dark mode.",
        heroTitle: "Your smart health navigator",
        heroText:
          "MedScoutX helps you understand symptoms better with symptom chat, body map and image analysis. You receive orientation and specialist suggestions without replacing a diagnosis.",
        heroButton: "How does MedScoutX work?",
        heroHelp:
          "Learn how MedScoutX works, what benefits it offers and how it helps you organize symptoms safely.",
        featuresTitle: "Start right away",
        featuresSubtitle: "Choose the area that best matches your current situation.",
        featuresAria: "Main MedScoutX functions",
        trustTitle: "Privacy and safety",
        trustText: "Your health is sensitive - and that is exactly how we treat your data.",
        trust1: "No emergency care:",
        trust1Text: "For acute complaints please call emergency services 112 or contact medical professionals directly.",
        trust2: "Guidance instead of diagnosis:",
        trust2Text: "MedScoutX provides suggestions and guidance but does not replace medical examination.",
        trust3: "Privacy:",
        trust3Text: "GDPR-oriented concept and EU hosting depending on plan and infrastructure configuration.",
        proTitle: "More answers with MedScoutX Pro",
        proText: "For frequent users and power users: higher limits, extended analysis functions and prioritized responses.",
        pro1: "More requests per month",
        pro2: "More detailed AI answers and history analysis",
        pro3: "Priority processing in the MedScoutX cloud",
        proButton: "View plans",
        demoTitle: "Meda - your AI, visualized",
        demoText: "The video symbolically shows how Meda recognizes medical patterns and helps you find orientation.",
        videoAria: "Short insight into the MedScoutX app",
        status: "MedScoutX is ready.",
        legal: "Legal information",
        imprint: "Imprint",
        privacy: "Privacy",
        terms: "Terms",
        disclaimer: "Disclaimer",
        footerNote: "MedScoutX is an AI-supported guidance tool and does not replace medical diagnosis or treatment.",
        cards: [
          {
            key: "symptom",
            title: "Symptom check",
            description:
              "Describe your symptoms and MedScoutX asks focused follow-up questions before suggesting a medical specialty.",
            to: "/symptom",
            Icon: IconSymptomChat,
          },
          {
            key: "bodymap",
            title: "Body map",
            description:
              "Select the affected region and MedScoutX guides you step by step toward a fitting recommendation.",
            to: "/region-start",
            Icon: IconBodyMap,
          },
          {
            key: "image",
            title: "Image analysis",
            description:
              "Upload a photo and MedScoutX describes visible findings and asks contextual questions.",
            to: "/bild",
            Icon: IconImageAnalysis,
          },
          {
            key: "abo",
            title: "Plans and limits",
            description:
              "Track your usage and switch to MedScoutX Pro whenever you need more capacity.",
            to: "/abo",
            Icon: IconAbo,
          },
        ],
      }
    : {
        title: "MedScoutX - Dein smarter Gesundheits-Navigator",
        skip: "Zum Hauptinhalt springen",
        tagline: "KI-Assistenz für deine Gesundheit - kein Ersatz für Ärztinnen und Ärzte.",
        themeAriaDark: "Aktuell Dunkelmodus. Umschalten auf Hellmodus.",
        themeAriaLight: "Aktuell Hellmodus. Umschalten auf Dunkelmodus.",
        heroTitle: "Dein smarter Gesundheits-Navigator",
        heroText:
          "MedScoutX unterstützt dich dabei, Beschwerden besser einzuordnen - mit Symptom-Chat, Körperkarte und Bildanalyse. Du erhältst Orientierung und Facharzt-Vorschläge, ohne eine Diagnose zu ersetzen.",
        heroButton: "Wie funktioniert MedScoutX?",
        heroHelp:
          "Erfahre, wie MedScoutX funktioniert, welche Vorteile es bietet und wie es dir hilft, Beschwerden strukturiert und sicher einzuordnen.",
        featuresTitle: "Direkt loslegen",
        featuresSubtitle: "Wähle den Bereich, der am besten zu deiner aktuellen Situation passt.",
        featuresAria: "Hauptfunktionen von MedScoutX",
        trustTitle: "Datenschutz und Sicherheit",
        trustText: "Deine Gesundheit ist sensibel - und genau so behandeln wir deine Daten.",
        trust1: "Keine Notfallversorgung:",
        trust1Text: "Bei akuten Beschwerden wähle bitte den Notruf 112 oder wende dich direkt an Ärztinnen und Ärzte.",
        trust2: "Orientierung statt Diagnose:",
        trust2Text: "MedScoutX liefert Vorschläge und Hinweise, ersetzt aber keine medizinische Untersuchung.",
        trust3: "Datenschutz:",
        trust3Text: "DSGVO-orientiertes Konzept und Hosting in der EU, je nach Tarif und Infrastrukturkonfiguration.",
        proTitle: "Mehr Antworten mit MedScoutX Pro",
        proText: "Für Vielnutzerinnen, Vielnutzer und Power-User: höhere Limits, erweiterte Analysefunktionen und priorisierte Antworten.",
        pro1: "Mehr Anfragen pro Monat",
        pro2: "Detailliertere KI-Antworten und Verlaufsanalyse",
        pro3: "Bevorzugte Verarbeitung in der MedScoutX-Cloud",
        proButton: "Tarife ansehen",
        demoTitle: "Meda - deine KI, visualisiert",
        demoText: "Das Video zeigt symbolisch, wie Meda medizinische Muster erkennt und dir bei Beschwerden Orientierung bietet.",
        videoAria: "Kurzer Einblick in die MedScoutX-App",
        status: "MedScoutX ist bereit.",
        legal: "Rechtliche Informationen",
        imprint: "Impressum",
        privacy: "Datenschutz",
        terms: "AGB",
        disclaimer: "Disclaimer",
        footerNote: "MedScoutX ist eine KI-gestützte Orientierungshilfe und ersetzt keine ärztliche Diagnose oder Behandlung.",
        cards: [
          {
            key: "symptom",
            title: "Symptom-Check",
            description:
              "Beschreibe deine Beschwerden - MedScoutX fragt gezielt nach und empfiehlt eine Fachrichtung.",
            to: "/symptom",
            Icon: IconSymptomChat,
          },
          {
            key: "bodymap",
            title: "Körperkarte",
            description:
              "Wähle die betroffene Region - MedScoutX führt dich Schritt für Schritt zur passenden Empfehlung.",
            to: "/region-start",
            Icon: IconBodyMap,
          },
          {
            key: "image",
            title: "Bildanalyse",
            description:
              "Lade ein Foto hoch - MedScoutX beschreibt, was sichtbar ist, und stellt Rückfragen.",
            to: "/bild",
            Icon: IconImageAnalysis,
          },
          {
            key: "abo",
            title: "Abo und Limits",
            description:
              "Behalte deine Nutzung im Blick und wechsle bei Bedarf zu MedScoutX Pro.",
            to: "/abo",
            Icon: IconAbo,
          },
        ],
      };

  const featureCards = copy.cards;
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFocusIndex((prev) => (prev + 1) % featureCards.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [featureCards.length]);

  useEffect(() => {
    document.title = copy.title;
  }, [copy.title]);

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <>
      <a href="#main-content" className="sr-only sr-only-focusable">
        {copy.skip}
      </a>

      <div className="startseite" data-page="startseite">
        <header className="startseite__header" role="banner">
          <div className="startseite__header-left">
            <div className="startseite__logo-mark" aria-hidden="true">
              <span className="startseite__logo-symbol">✚</span>
            </div>
            <div className="startseite__branding">
              <span className="startseite__app-name">MedScoutX</span>
              <span className="startseite__app-tagline">{copy.tagline}</span>
            </div>
          </div>

          <div className="startseite__header-right">
            <button
              type="button"
              className="startseite__theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? copy.themeAriaDark : copy.themeAriaLight}
            >
              <span aria-hidden="true">{theme === "dark" ? "🌙" : "☀️"}</span>
            </button>
          </div>
        </header>

        <div className="startseite-root">
          <main
            id="main-content"
            className="startseite-inner"
            aria-label={copy.title}
          >
            <section className="startseite__hero" aria-labelledby="hero-heading">
              <div className="startseite__hero-layout">
                <div className="startseite__hero-left">
                  <h1 id="hero-heading" className="startseite__hero-heading">
                    {copy.heroTitle}
                  </h1>

                  <p className="startseite__hero-text">{copy.heroText}</p>

                  <button
                    type="button"
                    className="startseite__btn startseite__btn--primary"
                    onClick={() => navigate("/info")}
                    aria-describedby="hero-primary-desc"
                  >
                    {copy.heroButton}
                  </button>

                  <p id="hero-primary-desc" className="startseite__hero-helper">
                    {copy.heroHelp}
                  </p>
                </div>

                <div className="startseite__hero-visual" aria-hidden="true">
                  <img
                    src={heroImage}
                    alt=""
                    className="startseite__hero-image"
                    loading="lazy"
                  />
                </div>
              </div>
            </section>

            <section
              className="startseite__features"
              aria-labelledby="features-heading"
            >
              <div className="startseite__section-header">
                <h2 id="features-heading" className="startseite__section-title">
                  {copy.featuresTitle}
                </h2>
                <p className="startseite__section-subtitle">
                  {copy.featuresSubtitle}
                </p>
              </div>

              <div
                className="startseite__feature-grid"
                role="list"
                aria-label={copy.featuresAria}
              >
                {featureCards.map((card, index) => (
                  <button
                    key={card.key}
                    type="button"
                    className={`startseite__feature-card ${
                      focusIndex === index ? "focus-card" : ""
                    }`}
                    role="listitem"
                    onClick={() => handleNavigate(card.to)}
                    aria-label={`${card.title}: ${card.description}`}
                  >
                    <div className="startseite__feature-icon" aria-hidden="true">
                      <card.Icon />
                    </div>

                    <div className="startseite__feature-content">
                      <h3 className="startseite__feature-title">{card.title}</h3>
                      <p className="startseite__feature-description">
                        {card.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="startseite__trust" aria-labelledby="trust-heading">
              <h2 id="trust-heading" className="startseite__section-title">
                {copy.trustTitle}
              </h2>
              <p className="startseite__trust-text">{copy.trustText}</p>
              <ul className="startseite__trust-list">
                <li>
                  <strong>{copy.trust1}</strong> {copy.trust1Text}
                </li>
                <li>
                  <strong>{copy.trust2}</strong> {copy.trust2Text}
                </li>
                <li>
                  <strong>{copy.trust3}</strong> {copy.trust3Text}
                </li>
              </ul>
            </section>

            <section className="startseite__abo" aria-labelledby="abo-heading">
              <div
                className="startseite__abo-card"
                role="group"
                aria-describedby="abo-benefits"
              >
                <h2
                  id="abo-heading"
                  className="startseite__section-title startseite__section-title--center"
                >
                  {copy.proTitle}
                </h2>
                <p id="abo-benefits" className="startseite__abo-text">
                  {copy.proText}
                </p>
                <ul className="startseite__abo-list">
                  <li>{copy.pro1}</li>
                  <li>{copy.pro2}</li>
                  <li>{copy.pro3}</li>
                </ul>
                <button
                  type="button"
                  className="startseite__btn startseite__btn--secondary"
                  onClick={() => handleNavigate("/abo")}
                >
                  {copy.proButton}
                </button>
              </div>
            </section>

            <section className="startseite__demo" aria-labelledby="demo-heading">
              <div className="startseite__section-header startseite__section-header--center">
                <h2 id="demo-heading" className="startseite__section-title">
                  {copy.demoTitle}
                </h2>
                <p className="startseite__section-subtitle">{copy.demoText}</p>
              </div>

              <div className="startseite__demo-media">
                <video
                  className="startseite__demo-video"
                  src={demoVideo}
                  autoPlay
                  muted
                  loop
                  playsInline
                  aria-label={copy.videoAria}
                >
                  Your browser does not support video playback.
                </video>
              </div>
            </section>
          </main>
        </div>

        <div
          className="startseite__status-region sr-only"
          aria-live="polite"
          role="status"
        >
          {copy.status}
        </div>

        <footer className="startseite__footer">
          <nav className="startseite__footer-nav" aria-label={copy.legal}>
            <button
              type="button"
              className="startseite__footer-link"
              onClick={() => handleNavigate("/impressum")}
            >
              {copy.imprint}
            </button>
            <button
              type="button"
              className="startseite__footer-link"
              onClick={() => handleNavigate("/datenschutz")}
            >
              {copy.privacy}
            </button>
            <button
              type="button"
              className="startseite__footer-link"
              onClick={() => handleNavigate("/agb")}
            >
              {copy.terms}
            </button>
            <button
              type="button"
              className="startseite__footer-link"
              onClick={() => handleNavigate("/disclaimer")}
            >
              {copy.disclaimer}
            </button>
          </nav>

          <p className="startseite__footer-note">{copy.footerNote}</p>
        </footer>
      </div>
    </>
  );
}
