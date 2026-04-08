import React, { useEffect } from "react";
import "../styles/Info.css";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useLanguage } from "../i18n/LanguageContext";
import symptomDemoImg from "../assets/media/symptom-demo.jpg";
import bodymapDemoImg from "../assets/media/bodymap-demo.jpg";
import imageDemoImg from "../assets/media/image-demo.jpg";

import {
  IconSymptomChat,
  IconBodyMap,
  IconImageAnalysis,
} from "../components/MedScoutIcons";

export default function Info() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const copy = language === "en"
    ? {
        title: "How does MedScoutX work?",
        skip: "Skip to main content",
        back: "Back",
        backAria: "Back",
        tagline: "Guidance for your health - without replacing a diagnosis.",
        ctaTop: "Open symptom check",
        mainAria: "How MedScoutX works",
        introTitle: "How does MedScoutX work?",
        lead:
          "MedScoutX is your smart health navigator. You describe what is bothering you, MedScoutX asks focused follow-up questions, structures your information and suggests relevant medical specialties.",
        note:
          "Important: MedScoutX does not replace medical diagnosis or emergency care. It helps you find the next sensible step.",
        stepsTitle: "More guidance in three steps",
        step1Title: "Describe your symptoms",
        step1Text:
          "Start in symptom chat, body map or image analysis. Describe your symptoms the way you would explain them to a person - in your own words.",
        step2Title: "Focused AI follow-up questions",
        step2Text:
          "MedScoutX asks follow-up questions: since when, where exactly, how severe, what accompanying symptoms, pre-existing conditions, medication - step by step and in plain language.",
        step3Title: "Summary and specialty suggestions",
        step3Text:
          "From your answers MedScoutX creates a structured overview and shows possible specialties such as general practice, neurology or dermatology that may be relevant.",
        featuresTitle: "Three ways to approach your symptoms",
        symptomTitle: "Symptom chat",
        symptomText:
          "Ideal when you are unsure: you write freely what is going on. MedScoutX follows up, organizes the details and creates a short structured overview.",
        symptomAlt: "Example view of the MedScoutX symptom chat",
        bodyTitle: "Body map",
        bodyText:
          "You select the affected region on the body. Then MedScoutX asks focused questions about location, pain type and accompanying symptoms.",
        bodyAlt: "Example view of the MedScoutX body map",
        imageTitle: "Image analysis",
        imageText:
          "You upload a photo such as a skin change. MedScoutX describes what is visible and asks follow-up questions about duration, itching or changes.",
        imageAlt: "Example view of MedScoutX image analysis",
        safetyTitle: "What MedScoutX does not do - and what matters for you",
        safety1Title: "Not an emergency service",
        safety1Text:
          "For acute symptoms such as shortness of breath, chest pain, paralysis or severe injuries, call emergency services immediately or contact a doctor directly.",
        safety2Title: "No diagnosis",
        safety2Text:
          "MedScoutX does not diagnose and does not start treatment. The guidance is meant to help you prepare for a doctor visit and identify relevant specialties.",
        safety3Title: "Privacy in focus",
        safety3Text:
          "MedScoutX was developed as a medtech project at a German university. The goal is responsible data handling aligned with European standards.",
        ctaTitle: "Ready to try it?",
        ctaText:
          "If you want to know which specialty could fit your situation, start the symptom check now and answer a few questions.",
        ctaButton: "Start symptom check",
      }
    : {
        title: "Wie funktioniert MedScoutX?",
        skip: "Zum Hauptinhalt springen",
        back: "Zurück",
        backAria: "Zurück",
        tagline: "Orientierung für deine Gesundheit - ohne Diagnose zu ersetzen.",
        ctaTop: "Symptom-Check öffnen",
        mainAria: "Wie MedScoutX funktioniert",
        introTitle: "Wie funktioniert MedScoutX?",
        lead:
          "MedScoutX ist dein smarter Gesundheits-Navigator. Du beschreibst, was dich belastet - MedScoutX stellt gezielte Rückfragen, strukturiert deine Angaben und schlägt passende Fachrichtungen vor.",
        note:
          "Wichtig: MedScoutX ersetzt keine ärztliche Diagnose oder Notfallversorgung, sondern hilft dir, den nächsten sinnvollen Schritt zu finden.",
        stepsTitle: "In drei Schritten zu mehr Orientierung",
        step1Title: "Beschwerden schildern",
        step1Text:
          "Du startest im Symptom-Chat, der Körperkarte oder der Bildanalyse. Beschreibe deine Beschwerden so, wie du sie einem Menschen erklären würdest - in deinen eigenen Worten.",
        step2Title: "Gezielte Rückfragen der KI",
        step2Text:
          "MedScoutX stellt Rückfragen: seit wann, wo genau, wie stark, welche Begleitsymptome, Vorerkrankungen, Medikamente - Schritt für Schritt und in verständlicher Sprache.",
        step3Title: "Zusammenfassung und Facharzt-Hinweise",
        step3Text:
          "Aus deinen Angaben erstellt MedScoutX eine strukturierte Übersicht und zeigt dir mögliche Fachrichtungen wie Hausarzt, Neurologie oder Dermatologie, die relevant sein könnten.",
        featuresTitle: "Drei Perspektiven auf deine Beschwerden",
        symptomTitle: "Symptom-Chat",
        symptomText:
          "Ideal, wenn du dir unsicher bist: Du schreibst frei, was los ist. MedScoutX fragt nach, sortiert deine Angaben und erstellt eine kurze strukturierte Übersicht.",
        symptomAlt: "Beispielansicht des MedScoutX-Symptom-Chats",
        bodyTitle: "Körperkarte",
        bodyText:
          "Du wählst die betroffene Region am Körper aus. Danach folgen gezielte Fragen zur Lokalisation, Art des Schmerzes und eventuellen Begleitsymptomen.",
        bodyAlt: "Beispielansicht der MedScoutX-Körperkarte",
        imageTitle: "Bildanalyse",
        imageText:
          "Du lädst ein Foto hoch, zum Beispiel einer Hautveränderung. MedScoutX beschreibt, was auf dem Bild zu sehen ist, und stellt Rückfragen zu Dauer, Juckreiz oder Veränderungen.",
        imageAlt: "Beispielansicht der MedScoutX-Bildanalyse",
        safetyTitle: "Was MedScoutX nicht macht - und was dir wichtig sein sollte",
        safety1Title: "Kein Notfall-Dienst",
        safety1Text:
          "Bei akuten Beschwerden wie Atemnot, Brustschmerz, Lähmungserscheinungen oder starken Verletzungen wähle bitte sofort den Notruf oder wende dich direkt an Ärztinnen und Ärzte.",
        safety2Title: "Keine Diagnose",
        safety2Text:
          "MedScoutX stellt keine Diagnose und startet keine Behandlung. Die Hinweise helfen dir, deinen Arztbesuch besser vorzubereiten und passende Fachrichtungen zu finden.",
        safety3Title: "Datenschutz im Fokus",
        safety3Text:
          "MedScoutX wurde als MedTech-Projekt an einer deutschen Hochschule entwickelt. Ziel ist ein verantwortungsvoller Umgang mit Daten nach europäischen Standards.",
        ctaTitle: "Bereit, es auszuprobieren?",
        ctaText:
          "Wenn du wissen möchtest, zu welcher Fachrichtung du gehen könntest, starte jetzt den Symptom-Check und beantworte ein paar Fragen.",
        ctaButton: "Symptom-Check starten",
      };

  useEffect(() => {
    document.title = copy.title;
  }, [copy.title]);

  return (
    <>
      <a href="#info-main" className="sr-only sr-only-focusable">
        {copy.skip}
      </a>
      <Header />
      <div className="info-page" data-page="info">
        <header className="startseite__header info-header-merged" role="banner">
          <div className="startseite__header-left">
            <button
              type="button"
              className="back-btn"
              onClick={() => navigate(-1)}
              aria-label={copy.backAria}
            >
              <span aria-hidden="true">←</span>
              {copy.back}
            </button>

            <div className="startseite__branding">
              <span className="startseite__app-name">MedScoutX</span>
              <span className="startseite__app-tagline">{copy.tagline}</span>
            </div>
          </div>

          <div className="startseite__header-right">
            <button
              type="button"
              className="info-header__cta"
              onClick={() => navigate("/symptom")}
            >
              {copy.ctaTop}
            </button>
          </div>
        </header>

        <main id="info-main" className="info-main" aria-label={copy.mainAria}>
          <section
            className="info-section info-section--intro"
            aria-labelledby="info-intro-heading"
          >
            <h1 id="info-intro-heading" className="info-heading-main">
              {copy.introTitle}
            </h1>
            <p className="info-lead">{copy.lead}</p>
            <p className="info-note">{copy.note}</p>
          </section>

          <section className="info-section" aria-labelledby="info-steps-heading">
            <h2 id="info-steps-heading" className="info-heading-section">
              {copy.stepsTitle}
            </h2>

            <ol className="info-steps" aria-label={copy.stepsTitle}>
              <li className="info-step">
                <div className="info-step__badge" aria-hidden="true">
                  <span>1</span>
                </div>
                <div className="info-step__content">
                  <h3 className="info-step__title">{copy.step1Title}</h3>
                  <p className="info-step__text">{copy.step1Text}</p>
                </div>
              </li>

              <li className="info-step">
                <div className="info-step__badge" aria-hidden="true">
                  <span>2</span>
                </div>
                <div className="info-step__content">
                  <h3 className="info-step__title">{copy.step2Title}</h3>
                  <p className="info-step__text">{copy.step2Text}</p>
                </div>
              </li>

              <li className="info-step">
                <div className="info-step__badge" aria-hidden="true">
                  <span>3</span>
                </div>
                <div className="info-step__content">
                  <h3 className="info-step__title">{copy.step3Title}</h3>
                  <p className="info-step__text">{copy.step3Text}</p>
                </div>
              </li>
            </ol>
          </section>

          <section className="info-section" aria-labelledby="info-features-heading">
            <h2 id="info-features-heading" className="info-heading-section">
              {copy.featuresTitle}
            </h2>

            <div className="info-feature-grid" role="list">
              <article className="info-feature-card" role="listitem" aria-label={copy.symptomTitle}>
                <div className="info-feature-card__icon" aria-hidden="true">
                  <IconSymptomChat />
                </div>
                <h3 className="info-feature-card__title">{copy.symptomTitle}</h3>
                <p className="info-feature-card__text">{copy.symptomText}</p>
                <figure className="info-feature-media">
                  <img
                    src={symptomDemoImg}
                    alt={copy.symptomAlt}
                    className="info-feature-image"
                    loading="lazy"
                  />
                </figure>
              </article>

              <article className="info-feature-card" role="listitem" aria-label={copy.bodyTitle}>
                <div className="info-feature-card__icon" aria-hidden="true">
                  <IconBodyMap />
                </div>
                <h3 className="info-feature-card__title">{copy.bodyTitle}</h3>
                <p className="info-feature-card__text">{copy.bodyText}</p>
                <figure className="info-feature-media">
                  <img
                    src={bodymapDemoImg}
                    alt={copy.bodyAlt}
                    className="info-feature-image"
                    loading="lazy"
                  />
                </figure>
              </article>

              <article className="info-feature-card" role="listitem" aria-label={copy.imageTitle}>
                <div className="info-feature-card__icon" aria-hidden="true">
                  <IconImageAnalysis />
                </div>
                <h3 className="info-feature-card__title">{copy.imageTitle}</h3>
                <p className="info-feature-card__text">{copy.imageText}</p>
                <figure className="info-feature-media">
                  <img
                    src={imageDemoImg}
                    alt={copy.imageAlt}
                    className="info-feature-image"
                    loading="lazy"
                  />
                </figure>
              </article>
            </div>
          </section>

          <section
            className="info-section info-section--safety"
            aria-labelledby="info-safety-heading"
          >
            <h2 id="info-safety-heading" className="info-heading-section">
              {copy.safetyTitle}
            </h2>

            <div className="info-safety-grid">
              <div className="info-safety-card">
                <h3 className="info-safety-card__title">{copy.safety1Title}</h3>
                <p className="info-safety-card__text">{copy.safety1Text}</p>
              </div>

              <div className="info-safety-card">
                <h3 className="info-safety-card__title">{copy.safety2Title}</h3>
                <p className="info-safety-card__text">{copy.safety2Text}</p>
              </div>

              <div className="info-safety-card">
                <h3 className="info-safety-card__title">{copy.safety3Title}</h3>
                <p className="info-safety-card__text">{copy.safety3Text}</p>
              </div>
            </div>
          </section>

          <section
            className="info-section info-section--cta"
            aria-labelledby="info-cta-heading"
          >
            <h2
              id="info-cta-heading"
              className="info-heading-section info-heading-section--center"
            >
              {copy.ctaTitle}
            </h2>
            <p className="info-cta-text">{copy.ctaText}</p>
            <button
              type="button"
              className="info-cta-button"
              onClick={() => navigate("/symptom")}
            >
              {copy.ctaButton}
            </button>
          </section>
        </main>
      </div>
    </>
  );
}
