import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import heroPoster from "../assets/media/hero-medscoutx.png";
import demoVideo from "../assets/media/medscoutx-demo.mp4";
import "../styles/LandingPage.css";

const copy = {
  de: {
    skip: "Zum Inhalt springen",
    badge: "Arztgespräch strukturiert vorbereiten",
    headline: "Arztgespräche besser vorbereiten – in jeder Sprache.",
    description:
      "MedScoutX hilft Patientinnen und Patienten, Beschwerden, Medikamente, Dokumente und Fragen strukturiert für den Arzttermin vorzubereiten. Die Angaben können als übersichtliches PDF in der Sprache der Praxis erstellt werden.",
    primaryCta: "Arztgespräch vorbereiten",
    secondaryCta: "Mehr erfahren",
    trustLine:
      "Keine Diagnose. Keine Therapieempfehlung. Keine Dringlichkeitseinschätzung. Nur strukturierte Vorbereitung Ihrer Angaben.",
    metricA: "Mehrsprachige Kommunikation",
    metricB: "PDF für den Arzttermin",
    metricC: "Sie behalten die Kontrolle",
    forWhomTitle: "Für wen",
    forWhom: [
      "Für Patientinnen und Patienten mit Sprachbarrieren",
      "Für Praxen mit internationalem Patientenaufkommen",
      "Für Kliniken und Ambulanzen zur besseren Vorbereitung von Gesprächen",
    ],
    howTitle: "So funktioniert's",
    howSteps: [
      "Sprache wählen",
      "Angaben strukturiert erfassen",
      "Arzt-Sprache auswählen",
      "PDF für den Termin erstellen",
    ],
    safetyTitle: "Sicherheitsgrenze",
    safetyBody:
      "MedScoutX erstellt keine Diagnose, keine Behandlungsempfehlung und keine Notfallbewertung. Die Anwendung unterstützt ausschließlich bei der strukturierten Vorbereitung und Dokumentation von Patientenaussagen.",
    mediaEyebrow: "Einblick",
    mediaTitle: "Klare Oberfläche — auch auf dem Smartphone",
    mediaText:
      "Die Darstellung ist bewusst ruhig gehalten: Fokus auf Ihre eigenen Angaben und eine übersichtliche Zusammenstellung für das Gespräch in der Praxis.",
    footerDisclaimer:
      "MedScoutX ist keine Diagnose-App und kein Notfalldienst. Bei akuten Beschwerden wenden Sie sich an den ärztlichen Notdienst oder die Notaufnahme.",
    imprint: "Impressum",
    privacy: "Datenschutz",
    login: "Login",
  },
  en: {
    skip: "Skip to content",
    badge: "Structured preparation for your appointment",
    headline: "Prepare medical appointments better — in any language.",
    description:
      "MedScoutX helps patients structure symptoms, medication, documents and questions before a doctor’s appointment. The information can be prepared as a clear PDF in the language of the medical practice.",
    primaryCta: "Prepare doctor visit",
    secondaryCta: "Learn more",
    trustLine:
      "No diagnosis. No treatment recommendation. No urgency assessment. Only structured preparation of your own statements.",
    metricA: "Multilingual communication",
    metricB: "PDF for your visit",
    metricC: "You stay in control",
    forWhomTitle: "Who it is for",
    forWhom: [
      "For patients facing language barriers",
      "For practices with an international patient mix",
      "For hospitals and clinics to support better conversation preparation",
    ],
    howTitle: "How it works",
    howSteps: [
      "Choose language",
      "Capture details in a structured way",
      "Select the doctor-facing language",
      "Create a PDF for the appointment",
    ],
    safetyTitle: "Safety boundary",
    safetyBody:
      "MedScoutX does not provide a diagnosis, treatment recommendation, or emergency assessment. It only supports structured preparation and documentation of patient statements.",
    mediaEyebrow: "Preview",
    mediaTitle: "A calm interface — mobile-first",
    mediaText:
      "The experience stays professional and readable: your own wording, structured for the clinical team that will see you.",
    footerDisclaimer:
      "MedScoutX is not for diagnosis or emergencies. For acute symptoms, contact emergency services or a clinician immediately.",
    imprint: "Imprint",
    privacy: "Privacy",
    login: "Login",
  },
};

export default function LandingPage() {
  const { language } = useLanguage();
  const currentCopy = useMemo(() => copy[language] ?? copy.de, [language]);

  useEffect(() => {
    document.title =
      language === "en"
        ? "MedScoutX — Prepare for your doctor visit"
        : "MedScoutX — Arztgespräch vorbereiten";
  }, [language]);

  return (
    <div className="landing-page">
      <a href="#landing-main" className="landing-page__skip-link">
        {currentCopy.skip}
      </a>

      <main id="landing-main" className="landing-page__main">
        <section className="landing-page__hero">
          <div className="landing-page__hero-copy">
            <p className="landing-page__eyebrow">{currentCopy.badge}</p>
            <h1 className="landing-page__headline">{currentCopy.headline}</h1>
            <p className="landing-page__description">{currentCopy.description}</p>

            <div className="landing-page__cta-row">
              <Link
                className="landing-page__cta landing-page__cta--primary"
                to="/pre-visit"
              >
                {currentCopy.primaryCta}
              </Link>
              <Link
                className="landing-page__cta landing-page__cta--secondary"
                to="/info"
              >
                {currentCopy.secondaryCta}
              </Link>
            </div>

            <p className="landing-page__trust-line">{currentCopy.trustLine}</p>

            <div
              className="landing-page__metrics"
              aria-label={currentCopy.howTitle}
            >
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
                <p className="landing-page__media-eyebrow">
                  {currentCopy.mediaEyebrow}
                </p>
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

        <section
          className="landing-page__value-grid"
          aria-labelledby="landing-for-whom"
        >
          <div className="landing-page__value-card">
            <h2 id="landing-for-whom" className="landing-page__value-title">
              {currentCopy.forWhomTitle}
            </h2>
            <ul className="landing-page__value-list">
              {currentCopy.forWhom.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="landing-page__value-card">
            <h2 className="landing-page__value-title">{currentCopy.howTitle}</h2>
            <ol className="landing-page__value-steps">
              {currentCopy.howSteps.map((step, i) => (
                <li key={step}>
                  <span className="landing-page__step-num">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="landing-page__value-card landing-page__value-card--wide">
            <h2 className="landing-page__value-title">
              {currentCopy.safetyTitle}
            </h2>
            <p className="landing-page__safety-body">{currentCopy.safetyBody}</p>
          </div>
        </section>
      </main>

      <footer className="landing-page__footer">
        <p>{currentCopy.footerDisclaimer}</p>
        <div className="landing-page__footer-links">
          <Link to="/login">{currentCopy.login}</Link>
          <span className="landing-page__footer-sep" aria-hidden="true">
            ·
          </span>
          <Link to="/impressum?public=1">{currentCopy.imprint}</Link>
          <Link to="/datenschutz?public=1">{currentCopy.privacy}</Link>
        </div>
      </footer>
    </div>
  );
}
