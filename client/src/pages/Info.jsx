import React, { useEffect } from "react";
import "../styles/Info.css";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useTheme } from "../ThemeMode";


import {
    IconSymptomChat,
    IconBodyMap,
    IconImageAnalysis,
  } from "../components/MedScoutIcons";

  

export default function Info() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    document.title = "Wie funktioniert MedScoutX?";
  }, []);

  return (
    <>
      {/* Skip-Link für Screenreader & Tastatur */}
      <a href="#info-main" className="sr-only sr-only-focusable">
        Zum Hauptinhalt springen
      </a>
      <Header />
      <div className="info-page" data-page="info">
        {/* HEADER */}
        <header className="startseite__header info-header-merged" role="banner">
  <div className="startseite__header-left">
    {/* Zurück-Button */}
    <button
  type="button"
  className="back-btn"
  onClick={() => navigate(-1)}
  aria-label="Zurück"
>
  <span aria-hidden="true">←</span>
  Zurück
</button>


    {/* Branding wie auf der Startseite */}
    <div className="startseite__branding">
      <span className="startseite__app-name">MedScoutX</span>
      <span className="startseite__app-tagline">
        Orientierung für deine Gesundheit – ohne Diagnose zu ersetzen.
      </span>
    </div>
  </div>

  {/* Optional: Call-to-Action im Header */}
  <div className="startseite__header-right">
    <button
      type="button"
      className="info-header__cta"
      onClick={() => navigate("/symptom")}
    >
      Symptom-Check öffnen
    </button>
  </div>
</header>


        {/* MAIN */}
        <main
          id="info-main"
          className="info-main"
          aria-label="Wie MedScoutX funktioniert"
        >
          {/* Intro */}
          <section
            className="info-section info-section--intro"
            aria-labelledby="info-intro-heading"
          >
            <h1 id="info-intro-heading" className="info-heading-main">
              Wie funktioniert MedScoutX?
            </h1>
            <p className="info-lead">
              MedScoutX ist dein smarter Gesundheits-Navigator. Du beschreibst, was
              dich belastet – MedScoutX stellt gezielte Rückfragen, strukturiert deine
              Angaben und schlägt passende Fachrichtungen vor.
            </p>
            <p className="info-note">
              Wichtig: MedScoutX ersetzt keine ärztliche Diagnose oder Notfallversorgung,
              sondern hilft dir, den nächsten sinnvollen Schritt zu finden.
            </p>
          </section>

          {/* Schritte – Ablauf */}
          <section
            className="info-section"
            aria-labelledby="info-steps-heading"
          >
            <h2 id="info-steps-heading" className="info-heading-section">
              In drei Schritten zu mehr Orientierung
            </h2>

            <ol className="info-steps" aria-label="Ablauf in drei Schritten">
              <li className="info-step">
                <div className="info-step__badge" aria-hidden="true">
                  <span>1</span>
                </div>
                <div className="info-step__content">
                  <h3 className="info-step__title">Beschwerden schildern</h3>
                  <p className="info-step__text">
                    Du startest im Symptom-Chat, der Körperkarte oder der Bildanalyse.
                    Beschreibe deine Beschwerden so, wie du sie einem Menschen erklären
                    würdest – in deinen eigenen Worten.
                  </p>
                </div>
              </li>

              <li className="info-step">
                <div className="info-step__badge" aria-hidden="true">
                  <span>2</span>
                </div>
                <div className="info-step__content">
                  <h3 className="info-step__title">Gezielte Rückfragen der KI</h3>
                  <p className="info-step__text">
                    MedScoutX stellt Rückfragen: seit wann, wo genau, wie stark, welche
                    Begleitsymptome, Vorerkrankungen, Medikamente – Schritt für Schritt
                    und in verständlicher Sprache.
                  </p>
                </div>
              </li>

              <li className="info-step">
                <div className="info-step__badge" aria-hidden="true">
                  <span>3</span>
                </div>
                <div className="info-step__content">
                  <h3 className="info-step__title">Zusammenfassung & Facharzt-Hinweise</h3>
                  <p className="info-step__text">
                    Aus deinen Angaben erstellt MedScoutX eine strukturierte Übersicht und
                    zeigt dir mögliche Fachrichtungen (z.&nbsp;B. Hausarzt, Neurologie,
                    Dermatologie), die für dich relevant sein könnten.
                  </p>
                </div>
              </li>
            </ol>
          </section>

          {/* Funktionen-Bereich */}
          <section
            className="info-section"
            aria-labelledby="info-features-heading"
          >
            <h2 id="info-features-heading" className="info-heading-section">
              Drei Perspektiven auf deine Beschwerden
            </h2>

            <div className="info-feature-grid" role="list">
              <article
                className="info-feature-card"
                role="listitem"
                aria-label="Symptom-Chat"
              >
                <div className="info-feature-card__icon" aria-hidden="true">
    <IconSymptomChat />
  </div>
                <h3 className="info-feature-card__title">Symptom-Chat</h3>
                <p className="info-feature-card__text">
                  Ideal, wenn du dir unsicher bist: Du schreibst frei, was los ist.
                  MedScoutX fragt nach, sortiert deine Angaben und erstellt eine
                  kurze, strukturierte Übersicht.
                </p>
              </article>

              <article
                className="info-feature-card"
                role="listitem"
                aria-label="Körperkarte"
              >
                <div className="info-feature-card__icon" aria-hidden="true">
    <IconBodyMap />
  </div>
                <h3 className="info-feature-card__title">Körperkarte</h3>
                <p className="info-feature-card__text">
                  Du wählst die betroffene Region am Körper aus. Danach folgen
                  gezielte Fragen zur Lokalisation, Art des Schmerzes und
                  eventuellen Begleitsymptomen.
                </p>
              </article>

              <article
                className="info-feature-card"
                role="listitem"
                aria-label="Bildanalyse"
              >
                 <div className="info-feature-card__icon" aria-hidden="true">
    <IconImageAnalysis />
  </div>
                <h3 className="info-feature-card__title">Bildanalyse</h3>
                <p className="info-feature-card__text">
                  Du lädst ein Foto hoch (z.&nbsp;B. Hautveränderung). MedScoutX beschreibt,
                  was auf dem Bild zu sehen ist, und stellt Rückfragen – z.&nbsp;B. Dauer,
                  Juckreiz oder Veränderungen.
                </p>
              </article>
            </div>
          </section>

          {/* Sicherheit & Verantwortung */}
          <section
            className="info-section info-section--safety"
            aria-labelledby="info-safety-heading"
          >
            <h2 id="info-safety-heading" className="info-heading-section">
              Was MedScoutX nicht macht – und was dir wichtig sein sollte
            </h2>

            <div className="info-safety-grid">
              <div className="info-safety-card">
                <h3 className="info-safety-card__title">Kein Notfall-Dienst</h3>
                <p className="info-safety-card__text">
                  Bei akuten Beschwerden wie Atemnot, Brustschmerz, Lähmungserscheinungen
                  oder starken Verletzungen wähle bitte sofort den{" "}
                  <strong>Notruf 112</strong> oder wende dich direkt an Ärzt:innen.
                </p>
              </div>

              <div className="info-safety-card">
                <h3 className="info-safety-card__title">Keine Diagnose</h3>
                <p className="info-safety-card__text">
                  MedScoutX stellt keine Diagnose und startet keine Behandlung. Die Hinweise
                  dienen dazu, deinen Arztbesuch besser vorzubereiten und passenden Fachrichtungen
                  auf die Spur zu kommen.
                </p>
              </div>

              <div className="info-safety-card">
                <h3 className="info-safety-card__title">Datenschutz im Fokus</h3>
                <p className="info-safety-card__text">
                  MedScoutX wurde als MedTech-Projekt an einer deutschen Hochschule entwickelt.
                  Ziel ist ein verantwortungsvoller Umgang mit Daten nach europäischen Standards.
                  Details findest du in der Datenschutzerklärung.
                </p>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section
            className="info-section info-section--cta"
            aria-labelledby="info-cta-heading"
          >
            <h2 id="info-cta-heading" className="info-heading-section info-heading-section--center">
              Bereit, es auszuprobieren?
            </h2>
            <p className="info-cta-text">
              Wenn du wissen möchtest, zu welcher Fachrichtung du gehen könntest,
              starte jetzt den Symptom-Check und beantworte ein paar Fragen.
            </p>
            <button
              type="button"
              className="info-cta-button"
              onClick={() => navigate("/symptom")}
            >
              Symptom-Check starten
            </button>
          </section>
        </main>
      </div>
    </>
  );
}
