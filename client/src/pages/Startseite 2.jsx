import React, { useEffect, useState } from "react";
import "../styles/Startseite.css";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../ThemeMode";
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

  // THEME (nur light/dark, kein "system" mehr)
  


  // 🔹 Karten-Konfiguration (wird unten gerendert)
  const featureCards = [
    {
      key: "symptom",
      title: "Symptom-Check",
      description:
        "Beschreibe deine Beschwerden – MedScoutX fragt gezielt nach und empfiehlt eine Fachrichtung.",
      to: "/symptom",
      Icon: IconSymptomChat,
    },
    {
      key: "bodymap",
      title: "Körperkarte",
      description:
        "Wähle die betroffene Region – MedScoutX führt dich Schritt für Schritt zur passenden Empfehlung.",
      to: "/region-start",
      Icon: IconBodyMap,
    },
    {
      key: "bildanalyse",
      title: "Bildanalyse",
      description:
        "Lade ein Foto hoch – MedScoutX beschreibt, was sichtbar ist, und stellt Rückfragen.",
      to: "/bild",
      Icon: IconImageAnalysis,
    },
    {
      key: "abo",
      title: "Abo & Limits",
      description:
        "Behalte deine Nutzung im Blick und wechsle bei Bedarf zu MedScoutX Pro.",
      to: "/abo",
      Icon: IconAbo,
    },
  ];

  // Fokus-Index für die „Spotlight“-Animation der Boxen
  const [focusIndex, setFocusIndex] = useState(0);

  // 🔹 Auto-Fokus alle 3 Sekunden auf nächste Box
  useEffect(() => {
    const interval = setInterval(() => {
      setFocusIndex((prev) => (prev + 1) % featureCards.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [featureCards.length]);

  // Seitentitel setzen
  useEffect(() => {
    document.title = "MedScoutX – Dein smarter Gesundheits-Navigator";
  }, []);

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <>
      {/* Skip-Link für Screenreader & Tastatur */}
      <a href="#main-content" className="sr-only sr-only-focusable">
        Zum Hauptinhalt springen
      </a>

      <div className="startseite" data-page="startseite">
        {/* HEADER */}
        <header className="startseite__header" role="banner">
          <div className="startseite__header-left">
            <div className="startseite__logo-mark" aria-hidden="true">
              <span className="startseite__logo-symbol">✚</span>
            </div>
            <div className="startseite__branding">
              <span className="startseite__app-name">MedScoutX</span>
              <span className="startseite__app-tagline">
                KI-Assistenz für deine Gesundheit – kein Ersatz für Ärzt:innen.
              </span>
            </div>
          </div>

          <div className="startseite__header-right">
          <button
  type="button"
  className="startseite__theme-toggle"
  onClick={toggleTheme}
  aria-label={
    theme === "dark"
      ? "Aktuell Dunkelmodus. Umschalten auf Hellmodus."
      : "Aktuell Hellmodus. Umschalten auf Dunkelmodus."
  }
>
  <span aria-hidden="true">
    {theme === "dark" ? "🌙" : "☀️"}
  </span>
</button>

          </div>
        </header>

        {/* HAUPTBEREICH */}
        <div className="startseite-root">
          <main
            id="main-content"
            className="startseite-inner"
            aria-label="Startseite von MedScoutX"
          >
            {/* HERO / EINFÜHRUNG */}
            <section
  className="startseite__hero"
  aria-labelledby="hero-heading"
>
  <div className="startseite__hero-layout">
    {/* Linke Seite – Text */}
    <div className="startseite__hero-left">
      <h1 id="hero-heading" className="startseite__hero-heading">
        Dein smarter Gesundheits-Navigator
      </h1>

      <p className="startseite__hero-text">
        MedScoutX unterstützt dich dabei, Beschwerden besser einzuordnen – mit Symptom-Chat,
        Körperkarte und Bildanalyse. Du erhältst Orientierung und Facharzt-Vorschläge, ohne
        eine Diagnose zu ersetzen.
      </p>

      <button
        type="button"
        className="startseite__btn startseite__btn--primary"
        onClick={() => navigate("/info")}
        aria-describedby="hero-primary-desc"
      >
        Wie funktioniert MedScoutX?
      </button>

      <p id="hero-primary-desc" className="startseite__hero-helper">
        Erfahre, wie MedScoutX funktioniert, welche Vorteile es bietet und wie es dir hilft,
        Beschwerden strukturiert und sicher einzuordnen.
      </p>
    </div>

    {/* Rechte Seite – Hero-Bild (auch auf Handy sichtbar, darunter) */}
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


            {/* FUNKTIONSBEREICH / QUICK ACTIONS */}
            <section
              className="startseite__features"
              aria-labelledby="features-heading"
            >
              <div className="startseite__section-header">
                <h2
                  id="features-heading"
                  className="startseite__section-title"
                >
                  Direkt loslegen
                </h2>
                <p className="startseite__section-subtitle">
                  Wähle den Bereich, der am besten zu deiner aktuellen
                  Situation passt.
                </p>
              </div>

              <div
                className="startseite__feature-grid"
                role="list"
                aria-label="Hauptfunktionen von MedScoutX"
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
                    <div
                      className="startseite__feature-icon"
                      aria-hidden="true"
                    >
                      <card.Icon />
                    </div>

                    <div className="startseite__feature-content">
                      <h3 className="startseite__feature-title">
                        {card.title}
                      </h3>
                      <p className="startseite__feature-description">
                        {card.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* VERTRAUEN & SICHERHEIT */}
            <section
              className="startseite__trust"
              aria-labelledby="trust-heading"
            >
              <h2
                id="trust-heading"
                className="startseite__section-title"
              >
                Datenschutz &amp; Sicherheit
              </h2>
              <p className="startseite__trust-text">
                Deine Gesundheit ist sensibel – und genau so behandeln wir
                deine Daten.
              </p>
              <ul className="startseite__trust-list">
                <li>
                  <strong>Keine Notfallversorgung:</strong> Bei akuten
                  Beschwerden wähle bitte den{" "}
                  <span className="startseite__highlight">Notruf 112</span>{" "}
                  oder wende dich direkt an Ärzt:innen.
                </li>
                <li>
                  <strong>Orientierung statt Diagnose:</strong> MedScoutX
                  liefert Vorschläge und Hinweise, ersetzt aber keine
                  medizinische Untersuchung.
                </li>
                <li>
                  <strong>Datenschutz:</strong> DSGVO-orientiertes Konzept
                  und Hosting in der EU (je nach Tarif &amp;
                  Infrastrukturkonfiguration).
                </li>
              </ul>
            </section>

            {/* ABO / PREMIUM-TEASER */}
            <section
              className="startseite__abo"
              aria-labelledby="abo-heading"
            >
              <div
                className="startseite__abo-card"
                role="group"
                aria-describedby="abo-benefits"
              >
                <h2
                  id="abo-heading"
                  className="startseite__section-title startseite__section-title--center"
                >
                  Mehr Antworten mit MedScoutX Pro
                </h2>
                <p
                  id="abo-benefits"
                  className="startseite__abo-text"
                >
                  Für Vielnutzer:innen &amp; Power-User: höhere Limits,
                  erweiterte Analysefunktionen und priorisierte Antworten.
                </p>
                <ul className="startseite__abo-list">
                  <li>Mehr Anfragen pro Monat</li>
                  <li>Detailliertere KI-Antworten &amp;</li>
                  <li>Keine dauerhafte Datenspeicherung</li>
                </ul>
                <button
                  type="button"
                  className="startseite__btn startseite__btn--secondary"
                  onClick={() => handleNavigate("/abo")}
                >
                  Tarife ansehen
                </button>
              </div>
            </section>
            {/* KURZES DEMO-VIDEO */}
<section
  className="startseite__demo"
  aria-labelledby="demo-heading"
>
<div className="startseite__section-header startseite__section-header--center">
  <h2 id="demo-heading" className="startseite__section-title">
    Meda – deine KI, visualisiert
  </h2>
  <p className="startseite__section-subtitle">
    Das Video zeigt symbolisch, wie Meda medizinische Muster erkennt und 
    dir bei Beschwerden Orientierung bietet.
  </p>
</div>


  <div className="startseite__demo-media">
    <video
      className="startseite__demo-video"
      src={demoVideo}
      autoPlay
      muted
      loop
      playsInline
      aria-label="Kurzer Einblick in die MedScoutX-App"
    >
      Dein Browser unterstützt das Abspielen von Videos nicht.
    </video>
  </div>
</section>

          </main>
        </div>

        {/* STATUS (für Screenreader) */}
        <div
          className="startseite__status-region sr-only"
          aria-live="polite"
          role="status"
        >
          MedScoutX ist bereit.
        </div>

        {/* FOOTER / RECHTLICHES */}
        <footer className="startseite__footer">
          <nav
            className="startseite__footer-nav"
            aria-label="Rechtliche Informationen"
          >
            <button
              type="button"
              className="startseite__footer-link"
              onClick={() => handleNavigate("/impressum")}
            >
              Impressum
            </button>
            <button
              type="button"
              className="startseite__footer-link"
              onClick={() => handleNavigate("/datenschutz")}
            >
              Datenschutz
            </button>
            <button
              type="button"
              className="startseite__footer-link"
              onClick={() => handleNavigate("/agb")}
            >
              AGB
            </button>
            <button
              type="button"
              className="startseite__footer-link"
              onClick={() => handleNavigate("/disclaimer")}
            >
              Disclaimer
            </button>
          </nav>

          <p className="startseite__footer-note">
            MedScoutX ist eine KI-gestützte Orientierungs-Hilfe und ersetzt
            keine ärztliche Diagnose oder Behandlung.
          </p>
        </footer>
      </div>
    </>
  );
}
