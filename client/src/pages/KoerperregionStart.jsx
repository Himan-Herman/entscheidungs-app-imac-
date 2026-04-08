import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/KoerperregionStart.css";
import { useTheme } from "../ThemeMode";
import { useLanguage } from "../i18n/LanguageContext";

export default function KoerperregionStart() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const navigate = useNavigate();

  const copy = language === "en"
    ? {
        title: "Body map with MedScoutX",
        subtitle:
          "Choose the body region where your symptoms occur. Meda uses this information later in the symptom chat to ask more precise follow-up questions.",
        chip1: "Body Map",
        chip2: "Choose region",
        panel: "Body view selection",
        hint:
          "You can switch between the front and back of the body. Both views remain fully usable with keyboard and screen reader.",
        open: "Open selection",
        close: "Close selection",
        frontAria: "Select front body view",
        frontTitle: "Front",
        frontText: "Abdomen, chest, face, front of arms, front of legs.",
        backAria: "Select back body view",
        backTitle: "Back",
        backText: "Back, neck, shoulders, back of arms, back of legs.",
        footer:
          "You can switch the view again later without losing symptoms you already entered.",
      }
    : {
        title: "Körperkarte mit MedScoutX",
        subtitle:
          "Wähle die Körperregion, in der deine Beschwerden auftreten. Meda nutzt diese Information später im Symptom-Chat, um gezieltere Rückfragen stellen zu können.",
        chip1: "Body Map",
        chip2: "Region auswählen",
        panel: "Auswahl der Körperansicht",
        hint:
          "Du kannst zwischen Vorder- und Rückseite des Körpers wechseln. Beide Ansichten sind mit Tastatur und Screenreader vollständig nutzbar.",
        open: "Auswahl öffnen",
        close: "Auswahl schließen",
        frontAria: "Körpervorderseite auswählen",
        frontTitle: "Vorderseite",
        frontText: "Bauch, Brust, Gesicht, Arme vorne, Beine vorne.",
        backAria: "Körperrückseite auswählen",
        backTitle: "Rückseite",
        backText: "Rücken, Nacken, Schultern, Arme hinten, Beine hinten.",
        footer:
          "Hinweis: Du kannst die Ansicht später jederzeit wechseln, ohne dass bereits eingegebene Symptome verloren gehen.",
      };

  return (
    <main
      className={`koerper-start-page koerper-start-page--${theme}`}
      data-theme={theme}
      aria-labelledby="bodymap-heading"
      role="main"
    >
      <div className="koerper-start-shell">
        <header className="koerper-start-header">
          <div>
            <h1 id="bodymap-heading" className="koerper-start-title">
              {copy.title}
            </h1>
            <p className="koerper-start-subtitle">{copy.subtitle}</p>
          </div>

          <div className="koerper-start-header-meta" aria-hidden="true">
            <span className="chip chip--accent">{copy.chip1}</span>
            <span className="chip chip--soft">{copy.chip2}</span>
          </div>
        </header>

        <section className="koerper-start-panel" aria-label={copy.panel}>
          <p className="koerper-start-hint">{copy.hint}</p>

          <button
            type="button"
            className="koerper-toggle-btn"
            onClick={() => setOptionsOpen((prev) => !prev)}
            aria-expanded={optionsOpen}
            aria-controls="bodymap-view-options"
          >
            <span className="koerper-toggle-label">
              {optionsOpen ? copy.close : copy.open}
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
              aria-label={copy.frontAria}
            >
              <span className="option-chip-title">{copy.frontTitle}</span>
              <span className="option-chip-subtitle">{copy.frontText}</span>
            </button>

            <button
              type="button"
              className="option-chip"
              onClick={() => navigate("/rueckseite")}
              aria-label={copy.backAria}
            >
              <span className="option-chip-title">{copy.backTitle}</span>
              <span className="option-chip-subtitle">{copy.backText}</span>
            </button>
          </div>

          <p className="koerper-start-footer-text">{copy.footer}</p>
        </section>
      </div>
    </main>
  );
}
