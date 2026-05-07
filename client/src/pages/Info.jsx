import React, { useEffect } from "react";
import "../styles/Info.css";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import heroPrepImg from "../assets/media/hero-medscoutx.png";
import symptomDemoImg from "../assets/media/symptom-demo.jpg";
import bodymapDemoImg from "../assets/media/bodymap-demo.jpg";
import imageDemoImg from "../assets/media/image-demo.jpg";

import {
  IconSymptomChat,
  IconBodyMap,
  IconImageAnalysis,
  IconPreVisit,
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
        tagline:
          "Structured preparation for doctor visits — no diagnosis, no treatment advice.",
        ctaTop: "Prepare doctor visit",
        mainAria: "How MedScoutX works",
        introTitle: "How does MedScoutX work?",
        lead:
          "MedScoutX helps you prepare for medical appointments: capture complaints, medications, documents and questions in a structured way, choose languages for you and for the practice, and export a clear PDF. Optional tools help describe symptoms, map the body or review an image — always under your control.",
        note:
          "MedScoutX does not provide a diagnosis, treatment recommendation or urgency assessment. It supports structured preparation of your own statements only.",
        stepsTitle: "Four practical steps",
        step1Title: "Choose your language",
        step1Text:
          "Select the language you want to use while entering your information.",
        step2Title: "Capture details in a structured way",
        step2Text:
          "Work through complaints, medication, documents and questions step by step so nothing important is forgotten.",
        step3Title: "Choose the practice language",
        step3Text:
          "Select the language your medical practice uses so materials can be aligned for the appointment.",
        step4Title: "Create a PDF for your visit",
        step4Text:
          "Generate a readable PDF you can bring to the appointment or share as agreed. MedScoutX does not provide diagnosis or treatment recommendations.",
        featuresTitle: "Four ways MedScoutX can support you",
        previsitTitle: "Prepare doctor visit",
        previsitText:
          "The core flow for multilingual communication: structure what you want to say and export a PDF tailored to the practice language.",
        previsitAlt: "MedScoutX overview for preparing a doctor visit",
        symptomTitle: "Symptom chat",
        symptomText:
          "Describe symptoms in a structured way and receive general orientation. The output does not replace medical advice and is not intended for diagnosis.",
        symptomAlt: "Example view of the MedScoutX symptom chat",
        bodyTitle: "Body map",
        bodyText:
          "Select affected regions on the body so follow-up questions can focus on location, sensations and context — as orientation before your appointment.",
        bodyAlt: "Example view of the MedScoutX body map",
        imageTitle: "Image analysis",
        imageText:
          "Upload a photo for a structured description of what is visible and focused follow-up questions — without replacing examination by a clinician.",
        imageAlt: "Example view of MedScoutX image analysis",
        safetyTitle: "What MedScoutX does not do — and what matters for you",
        safety1Title: "Not an emergency service",
        safety1Text:
          "For acute symptoms such as shortness of breath, chest pain, paralysis or severe injuries, call emergency services immediately or contact a doctor directly.",
        safety2Title: "No diagnosis or treatment recommendation",
        safety2Text:
          "MedScoutX does not diagnose, recommend treatment or assess urgency. Use it only to prepare and document your own statements for medical conversations.",
        safety3Title: "Conceived for careful data use",
        safety3Text:
          "MedScoutX is designed to be data-efficient. Local storage on your device occurs only with explicit consent; local PDF creation without transmission follows the options you choose.",
        ctaTitle: "Ready to prepare your visit?",
        ctaText:
          "Structure your information and create a PDF for your next appointment — without diagnosis or treatment advice from the app.",
        ctaButton: "Prepare doctor visit",
      }
    : {
        title: "Wie funktioniert MedScoutX?",
        skip: "Zum Hauptinhalt springen",
        back: "Zurück",
        backAria: "Zurück",
        tagline:
          "Vorbereitung fürs Arztgespräch — keine Diagnose, keine Therapieempfehlung.",
        ctaTop: "Arztgespräch vorbereiten",
        mainAria: "Wie MedScoutX funktioniert",
        introTitle: "Wie funktioniert MedScoutX?",
        lead:
          "MedScoutX hilft dir, Arzttermine vorzubereiten: Beschwerden, Medikamente, Dokumente und Fragen strukturiert erfassen, Sprachen für dich und für die Praxis wählen und ein übersichtliches PDF erstellen. Ergänzend kannst du Symptome im Chat beschreiben, die Körperkarte nutzen oder ein Bild einbinden — immer unter deiner Kontrolle.",
        note:
          "MedScoutX erstellt keine Diagnose, keine Behandlungsempfehlung und keine Dringlichkeitseinschätzung. Die Anwendung unterstützt ausschließlich die strukturierte Vorbereitung und Dokumentation deiner eigenen Angaben.",
        stepsTitle: "Vier praktische Schritte",
        step1Title: "Sprache wählen",
        step1Text:
          "Wähle die Sprache, in der du deine Angaben machen möchtest.",
        step2Title: "Angaben strukturiert erfassen",
        step2Text:
          "Gehe Beschwerden, Medikamente, Dokumente und Fragen Schritt für Schritt durch, damit nichts Wichtiges fehlt.",
        step3Title: "Arzt-Sprache auswählen",
        step3Text:
          "Lege die Sprache der Praxis fest, damit Unterlagen zum Termin passen.",
        step4Title: "PDF für den Termin erstellen",
        step4Text:
          "Erzeuge ein lesbares PDF für den Termin oder zur Weitergabe nach Absprache. MedScoutX liefert dabei keine Diagnose und keine Therapieempfehlung.",
        featuresTitle: "Vier unterstützende Bereiche",
        previsitTitle: "Arztgespräch vorbereiten",
        previsitText:
          "Der Kernablauf für mehrsprachige Kommunikation: strukturiert vorbereiten und ein PDF in der Sprache der Praxis erstellen.",
        previsitAlt: "MedScoutX Überblick zur Vorbereitung eines Arztgesprächs",
        symptomTitle: "Symptom-Chat",
        symptomText:
          "Symptome strukturiert beschreiben und allgemeine Orientierung erhalten. Die Ausgabe ersetzt keine ärztliche Beratung und dient nicht der Diagnose.",
        symptomAlt: "Beispielansicht des MedScoutX-Symptom-Chats",
        bodyTitle: "Körperkarte",
        bodyText:
          "Betroffene Regionen markieren, damit Rückfragen zu Ort, Empfindungen und Kontext gezielt werden können — als Orientierung vor dem Termin.",
        bodyAlt: "Beispielansicht der MedScoutX-Körperkarte",
        imageTitle: "Bildanalyse",
        imageText:
          "Ein Foto strukturiert beschreiben lassen und gezielte Rückfragen erhalten — ohne ärztliche Untersuchung zu ersetzen.",
        imageAlt: "Beispielansicht der MedScoutX-Bildanalyse",
        safetyTitle: "Was MedScoutX nicht macht — und was dir wichtig sein sollte",
        safety1Title: "Kein Notfall-Dienst",
        safety1Text:
          "Bei akuten Beschwerden wie Atemnot, Brustschmerz, Lähmungserscheinungen oder starken Verletzungen wähle bitte sofort den Notruf oder wende dich direkt an Ärztinnen und Ärzte.",
        safety2Title: "Keine Diagnose oder Therapieempfehlung",
        safety2Text:
          "MedScoutX bewertet keine Dringlichkeit, stellt keine Diagnose und empfiehlt keine Behandlung. Nutze die App nur zur Vorbereitung und Dokumentation deiner eigenen Aussagen.",
        safety3Title: "Datensparsam konzipiert",
        safety3Text:
          "MedScoutX ist datensparsam angelegt: lokale Speicherung nur mit ausdrücklicher Zustimmung; bei rein lokaler PDF-Erstellung ohne Übertragung gelten die von dir gewählten Einstellungen.",
        ctaTitle: "Termin vorbereiten?",
        ctaText:
          "Strukturiere deine Angaben und erstelle ein PDF für den nächsten Termin — ohne Diagnose oder Therapiehinweis durch die App.",
        ctaButton: "Arztgespräch vorbereiten",
      };

  useEffect(() => {
    document.title = copy.title;
  }, [copy.title]);

  return (
    <>
      <a href="#info-main" className="sr-only sr-only-focusable">
        {copy.skip}
      </a>
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
              onClick={() => navigate("/pre-visit")}
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

              <li className="info-step">
                <div className="info-step__badge" aria-hidden="true">
                  <span>4</span>
                </div>
                <div className="info-step__content">
                  <h3 className="info-step__title">{copy.step4Title}</h3>
                  <p className="info-step__text">{copy.step4Text}</p>
                </div>
              </li>
            </ol>
          </section>

          <section className="info-section" aria-labelledby="info-features-heading">
            <h2 id="info-features-heading" className="info-heading-section">
              {copy.featuresTitle}
            </h2>

            <div className="info-feature-grid" role="list">
              <article className="info-feature-card" role="listitem" aria-label={copy.previsitTitle}>
                <div className="info-feature-card__icon" aria-hidden="true">
                  <IconPreVisit />
                </div>
                <h3 className="info-feature-card__title">{copy.previsitTitle}</h3>
                <p className="info-feature-card__text">{copy.previsitText}</p>
                <figure className="info-feature-media">
                  <img
                    src={heroPrepImg}
                    alt={copy.previsitAlt}
                    className="info-feature-image"
                    loading="lazy"
                  />
                </figure>
              </article>

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
              onClick={() => navigate("/pre-visit")}
            >
              {copy.ctaButton}
            </button>
          </section>
        </main>
      </div>
    </>
  );
}
