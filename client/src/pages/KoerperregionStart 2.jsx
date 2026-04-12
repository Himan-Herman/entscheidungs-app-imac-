// src/pages/KoerperregionStart.jsx (oder entsprechender Pfad)
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/KoerperregionStart.css";
import { useTheme } from "../ThemeMode";

export default function KoerperregionStart() {
  const { theme } = useTheme();            // "light" | "dark"
  const [optionsOpen, setOptionsOpen] = useState(false);
  const navigate = useNavigate();

  const handleToggleOptions = () => setOptionsOpen((prev) => !prev);

  const goToFront = () => navigate("/koerperregionen");
  const goToBack = () => navigate("/rueckseite");

  return (
    <main
      className={`koerper-start-page koerper-start-page--${theme}`}
      data-theme={theme}
      aria-labelledby="bodymap-heading"
      role="main"
    >
      <div className="koerper-start-shell">
        {/* Kopfbereich */}
        <header className="koerper-start-header">
          <div>
            <h1 id="bodymap-heading" className="koerper-start-title">
              Körperkarte mit MedScoutX
            </h1>
            <p className="koerper-start-subtitle">
              Wähle die Körperregion, in der deine Beschwerden auftreten.
              Meda nutzt diese Information später im Symptom-Chat, um
              gezieltere Rückfragen stellen zu können.
            </p>
          </div>

          <div className="koerper-start-header-meta" aria-hidden="true">
            <span className="chip chip--accent">Body Map</span>
            <span className="chip chip--soft">Region auswählen</span>
          </div>
        </header>

        {/* Auswahl-Panel */}
        <section
          className="koerper-start-panel"
          aria-label="Auswahl der Körperansicht"
        >
          <p className="koerper-start-hint">
            Du kannst zwischen Vorder- und Rückseite des Körpers wechseln.
            Beide Ansichten sind mit Tastatur und Screenreader vollständig
            nutzbar.
          </p>

          <button
            type="button"
            className="koerper-toggle-btn"
            onClick={handleToggleOptions}
            aria-expanded={optionsOpen}
            aria-controls="bodymap-view-options"
          >
            <span className="koerper-toggle-label">
              {optionsOpen ? "Auswahl schließen" : "Auswahl öffnen"}
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
              onClick={goToFront}
              aria-label="Körpervorderseite auswählen"
            >
              <span className="option-chip-title">Vorderseite</span>
              <span className="option-chip-subtitle">
                Bauch, Brust, Gesicht, Arme vorne, Beine vorne.
              </span>
            </button>

            <button
              type="button"
              className="option-chip"
              onClick={goToBack}
              aria-label="Körperrückseite auswählen"
            >
              <span className="option-chip-title">Rückseite</span>
              <span className="option-chip-subtitle">
                Rücken, Nacken, Schultern, Arme hinten, Beine hinten.
              </span>
            </button>
          </div>

          <p className="koerper-start-footer-text">
            Hinweis: Du kannst die Ansicht später jederzeit wechseln, ohne dass
            bereits eingegebene Symptome verloren gehen.
          </p>
        </section>
      </div>
    </main>
  );
}
