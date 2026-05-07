import React, { useEffect, useState } from "react";
import "../styles/Startseite.css";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import heroImage from "../assets/media/hero-medscoutx.png";
import demoVideo from "../assets/media/medscoutx-demo.mp4";

import {
  IconSymptomChat,
  IconBodyMap,
  IconImageAnalysis,
  IconPreVisit,
} from "../components/MedScoutIcons";

export default function Startseite() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const copy = language === "en"
    ? {
        title: "MedScoutX — Prepare for your doctor visit",
        skip: "Skip to main content",
        tagline:
          "Structured preparation for medical conversations — not diagnosis or treatment advice.",
        heroTitle: "Prepare medical appointments better — in any language.",
        heroText:
          "MedScoutX helps you structure symptoms, medication, documents and questions before an appointment. You can export a clear PDF in the language your practice uses.",
        heroPrimary: "Prepare doctor visit",
        heroSecondary: "Learn more",
        heroHelp:
          "Optional modules help describe symptoms, locate regions on a body map, or attach images — always patient-controlled and transparent.",
        audienceTitle: "Who MedScoutX supports",
        audienceBullets: [
          "Patients navigating language barriers when describing concerns",
          "Practices with diverse, international patients",
          "Clinics preparing clearer conversations before the visit",
        ],
        stepsEyebrow: "How it works",
        stepsItems: [
          "Choose your language",
          "Capture details in a structured flow",
          "Select the doctor-facing language",
          "Create a PDF for the appointment",
        ],
        safetyStripTitle: "Safety boundary",
        safetyStripBody:
          "MedScoutX does not diagnose, recommend treatment, assess urgency, or triage. It supports structuring and documenting what you choose to share.",
        featuresTitle: "Explore the toolkit",
        featuresSubtitle:
          "Start with appointment preparation, or use supporting tools when you need them.",
        featuresAria: "Main MedScoutX functions",
        trustTitle: "Privacy and transparency",
        trustText:
          "Designed for minimal data use; you decide what you enter and what you save locally.",
        trust1: "No emergency care:",
        trust1Text:
          "For acute complaints call emergency services or seek immediate clinical care.",
        trust2: "No substitute for medical judgment:",
        trust2Text:
          "Outputs support preparation only — they do not replace examination or advice from licensed clinicians.",
        trust3: "Data-conscious:",
        trust3Text:
          "Local PDF copies only when you explicitly consent; doctor-version creation sends structured answers for formatting — see Privacy Policy for details.",
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
        footerNote:
          "MedScoutX supports structured preparation of your statements — not diagnosis, treatment advice, or urgency assessment.",
        cards: [
          {
            key: "previsit",
            title: "Prepare doctor visit",
            description:
              "Structure complaints, medication, documents and questions — multilingual, exportable PDF for the practice.",
            to: "/pre-visit",
            Icon: IconPreVisit,
          },
          {
            key: "symptom",
            title: "Symptom dialogue",
            description:
              "Describe symptoms in a structured way and receive general orientation. The output does not replace medical advice and is not intended for diagnosis.",
            to: "/symptom",
            Icon: IconSymptomChat,
          },
          {
            key: "bodymap",
            title: "Body map",
            description:
              "Select the affected region and answer guided questions to describe what you feel — for orientation, not diagnosis.",
            to: "/region-start",
            Icon: IconBodyMap,
          },
          {
            key: "image",
            title: "Image review",
            description:
              "Upload a photo if needed; the tool describes what is visible and asks follow-up questions — not a stand-alone diagnosis.",
            to: "/bild",
            Icon: IconImageAnalysis,
          },
        ],
      }
    : {
        title: "MedScoutX — Arztgespräch vorbereiten",
        skip: "Zum Hauptinhalt springen",
        tagline:
          "Strukturierte Vorbereitung fürs Gespräch — keine Diagnose und keine Therapieempfehlung.",
        heroTitle: "Arztgespräche besser vorbereiten – in jeder Sprache.",
        heroText:
          "MedScoutX hilft dir, Beschwerden, Medikamente, Dokumente und Fragen strukturiert für den Termin vorzubereiten und als PDF in der Sprache der Praxis zusammenzustellen.",
        heroPrimary: "Arztgespräch vorbereiten",
        heroSecondary: "Mehr erfahren",
        heroHelp:
          "Zusätzliche Module unterstützen dich bei Symptomen, Körperregion oder Bildern — immer unter deiner Kontrolle und nachvollziehbar.",
        audienceTitle: "Für wen MedScoutX gedacht ist",
        audienceBullets: [
          "Für Patientinnen und Patienten mit Sprachbarrieren",
          "Für Praxen mit internationalem Patientenaufkommen",
          "Für Kliniken und Ambulanzen zur besseren Vorbereitung von Gesprächen",
        ],
        stepsEyebrow: "So funktioniert's",
        stepsItems: [
          "Sprache wählen",
          "Angaben strukturiert erfassen",
          "Arzt-Sprache auswählen",
          "PDF für den Termin erstellen",
        ],
        safetyStripTitle: "Sicherheitsgrenze",
        safetyStripBody:
          "MedScoutX stellt keine Diagnose, keine Behandlungsempfehlung und keine Notfall- oder Dringlichkeitseinschätzung. Es unterstützt nur die strukturierte Vorbereitung und Dokumentation deiner Angaben.",
        featuresTitle: "Funktionen entdecken",
        featuresSubtitle:
          "Beginne mit der Terminvorbereitung oder nutze ergänzende Werkzeuge bei Bedarf.",
        featuresAria: "Hauptfunktionen von MedScoutX",
        trustTitle: "Datenschutz und Transparenz",
        trustText:
          "Datensparsam konzipiert: Du entscheidest, was du eingibst und was du lokal speicherst.",
        trust1: "Keine Notfallversorgung:",
        trust1Text:
          "Bei akuten Beschwerden Notruf 112 oder direkt ärztliche Hilfe.",
        trust2: "Kein Ersatz für ärztliche Bewertung:",
        trust2Text:
          "Ausgaben dienen der Vorbereitung — sie ersetzen keine Untersuchung oder Beratung durch behandelnde Personen.",
        trust3: "Datenbewusst:",
        trust3Text:
          "Lokale Speicherung nur mit ausdrücklicher Zustimmung; bei lokaler PDF-Erstellung keine Übertragung der Inhalte. Details in der Datenschutzerklärung.",
        proTitle: "Mehr Antworten mit MedScoutX Pro",
        proText: "Für Vielnutzerinnen, Vielnutzer und Power-User: höhere Limits, erweiterte Analysefunktionen und priorisierte Antworten.",
        pro1: "Mehr Anfragen pro Monat",
        pro2: "Detailliertere KI-Antworten",
        pro3: "Schnellere Antworten (Priorisierung)",
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
        footerNote:
          "MedScoutX unterstützt die strukturierte Vorbereitung deiner Angaben — keine Diagnose, keine Therapieempfehlung, keine Dringlichkeitseinschätzung.",
        cards: [
          {
            key: "previsit",
            title: "Arztgespräch vorbereiten",
            description:
              "Beschwerden, Medikamente, Dokumente und Fragen strukturieren — mehrsprachig, als PDF für die Praxis.",
            to: "/pre-visit",
            Icon: IconPreVisit,
          },
          {
            key: "symptom",
            title: "Symptome einordnen",
            description:
              "Symptome strukturiert beschreiben und allgemeine Orientierung erhalten. Die Ausgabe ersetzt keine ärztliche Beratung und dient nicht der Diagnose.",
            to: "/symptom",
            Icon: IconSymptomChat,
          },
          {
            key: "bodymap",
            title: "Körperkarte",
            description:
              "Betroffene Region wählen und per geführten Fragen beschreiben, was du spürst — zur Orientierung, nicht zur Diagnose.",
            to: "/region-start",
            Icon: IconBodyMap,
          },
          {
            key: "image",
            title: "Bildhinweis",
            description:
              "Optional ein Bild hochladen; sichtbare Details werden beschrieben und nachgefragt — keine eigenständige Diagnose.",
            to: "/bild",
            Icon: IconImageAnalysis,
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

                  <div
                    className="startseite__hero-actions"
                    aria-describedby="hero-primary-desc"
                  >
                    <button
                      type="button"
                      className="startseite__btn startseite__btn--primary"
                      onClick={() => navigate("/pre-visit")}
                    >
                      {copy.heroPrimary}
                    </button>
                    <button
                      type="button"
                      className="startseite__btn startseite__btn--secondary"
                      onClick={() => navigate("/info")}
                    >
                      {copy.heroSecondary}
                    </button>
                  </div>

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
              className="startseite__prep-strip"
              aria-labelledby="audience-heading"
            >
              <div className="startseite__prep-grid">
                <div>
                  <h2
                    id="audience-heading"
                    className="startseite__section-title"
                  >
                    {copy.audienceTitle}
                  </h2>
                  <ul className="startseite__prep-list">
                    {copy.audienceBullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="startseite__prep-eyebrow">{copy.stepsEyebrow}</p>
                  <ol className="startseite__prep-steps">
                    {copy.stepsItems.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
              <div className="startseite__safety-strip">
                <h3>{copy.safetyStripTitle}</h3>
                <p>{copy.safetyStripBody}</p>
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
