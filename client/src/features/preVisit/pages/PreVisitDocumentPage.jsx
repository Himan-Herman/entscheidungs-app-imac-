import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { PRE_VISIT_LANGUAGE_OPTIONS } from "../constants/languages.js";
import {
  PRE_VISIT_QUESTION_STEPS,
  pickLocalized,
} from "../constants/questionFlow.js";
import {
  STRUCTURED_DOCTOR_LABELS,
  STRUCTURED_SECTION_ORDER,
} from "../constants/structuredDoctorLabels.js";
import {
  loadPreVisitSession,
  setDoctorLanguage,
} from "../constants/preVisitSession.js";
import { generatePreVisitPdf } from "../pdf/generatePreVisitPdf.js";
import "../styles/PreVisitDocumentPage.css";

const ui = {
  de: {
    title: "Dokument für den Arzt vorbereiten",
    explanation:
      "Wählen Sie die Sprache, in der die strukturierte Arztversion erstellt werden soll.",
    doctorLangLabel: "Sprache für die Arztversion",
    sectionStructured: "Strukturierte Arztversion",
    sectionOriginal: "Originalangaben des Patienten",
    disclaimer:
      "Die Arztversion basiert ausschließlich auf den Angaben des Patienten. Es werden keine Diagnosen, Empfehlungen oder Dringlichkeitseinschätzungen erstellt.",
    empty: "nicht angegeben",
    backReview: "Zurück zur Prüfung",
    pdfDisabled: "PDF erstellen",
    pdfLocalNote:
      "Die PDF-Datei wird lokal in Ihrem Browser erstellt. Es werden keine Daten übertragen.",
  },
  en: {
    title: "Prepare document for the doctor",
    explanation:
      "Choose the language in which the structured doctor version should be created.",
    doctorLangLabel: "Language for the doctor-facing summary",
    sectionStructured: "Structured doctor version",
    sectionOriginal: "Original patient statements",
    disclaimer:
      "The doctor version is based only on the patient’s statements. No diagnoses, recommendations or urgency assessments are created.",
    empty: "not specified",
    backReview: "Back to review",
    pdfDisabled: "Create PDF",
    pdfLocalNote:
      "The PDF file is created locally in your browser. No data is transmitted.",
  },
};

export default function PreVisitDocumentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const t = ui[language] ?? ui.de;

  const [session, setSession] = useState(() => loadPreVisitSession());

  useEffect(() => {
    const s = loadPreVisitSession();
    if (!s?.answers) {
      navigate("/pre-visit", { replace: true });
      return;
    }
    if (!s.doctorLanguage) {
      setDoctorLanguage(s.patientLanguage || "de");
      setSession(loadPreVisitSession());
      return;
    }
    setSession(s);
  }, [location.pathname, location.key, navigate]);

  useEffect(() => {
    document.title =
      language === "en"
        ? "MedScoutX — Document preview"
        : "MedScoutX — Dokument";
  }, [language]);

  const patientLang = session?.patientLanguage || "de";

  const doctorLang = useMemo(() => {
    const fromSession = session?.doctorLanguage;
    if (fromSession) return fromSession;
    return patientLang;
  }, [session?.doctorLanguage, patientLang]);

  const langOptions = useMemo(
    () =>
      PRE_VISIT_LANGUAGE_OPTIONS.map((row) => ({
        value: row.id,
        label: language === "en" ? row.labelEn : row.labelDe,
      })),
    [language]
  );

  function handleDoctorLangChange(e) {
    const code = e.target.value;
    const next = setDoctorLanguage(code);
    setSession(next ?? loadPreVisitSession());
  }

  function structuredHeading(key) {
    const rec = STRUCTURED_DOCTOR_LABELS[key];
    if (!rec) return "";
    return language === "en" ? rec.en : rec.de;
  }

  function handleDownloadPdf() {
    const latest = loadPreVisitSession();
    if (!latest?.answers) return;
    generatePreVisitPdf({
      session: latest,
      uiLanguage: language,
      labels: {},
    });
  }

  if (!session?.answers) {
    return null;
  }

  return (
    <div className="pre-visit-doc">
      <div className="pre-visit-doc__inner">
        <header className="pre-visit-doc__header">
          <h1 className="pre-visit-doc__title">{t.title}</h1>
          <p className="pre-visit-doc__lead">{t.explanation}</p>
        </header>

        <div className="pre-visit-doc__field">
          <label className="pre-visit-doc__label" htmlFor="previsit-doctor-lang">
            {t.doctorLangLabel}
          </label>
          <select
            id="previsit-doctor-lang"
            className="pre-visit-doc__select"
            value={doctorLang}
            onChange={handleDoctorLangChange}
          >
            {langOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="pre-visit-doc__preview">
          <section
            className="pre-visit-doc__section-block"
            aria-labelledby="previsit-structured-heading"
          >
            <h2
              id="previsit-structured-heading"
              className="pre-visit-doc__section-heading"
            >
              {t.sectionStructured}
            </h2>
            <div className="pre-visit-doc__rows">
              {STRUCTURED_SECTION_ORDER.map((key) => {
                const text = session.answers[key] ?? "";
                const empty = !String(text).trim();
                return (
                  <div key={key} className="pre-visit-doc__row">
                    <p className="pre-visit-doc__row-label">
                      {structuredHeading(key)}
                    </p>
                    <p
                      className={`pre-visit-doc__row-value ${
                        empty ? "pre-visit-doc__row-value--empty" : ""
                      }`}
                    >
                      {empty ? t.empty : text}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            className="pre-visit-doc__section-block"
            aria-labelledby="previsit-original-heading"
          >
            <h2
              id="previsit-original-heading"
              className="pre-visit-doc__section-heading"
            >
              {t.sectionOriginal}
            </h2>
            <div className="pre-visit-doc__rows">
              {PRE_VISIT_QUESTION_STEPS.map((step) => {
                const text = session.answers[step.key] ?? "";
                const empty = !String(text).trim();
                const titleOriginal = pickLocalized(step.title, patientLang);
                return (
                  <div key={step.key} className="pre-visit-doc__row">
                    <p className="pre-visit-doc__row-label">{titleOriginal}</p>
                    <p
                      className={`pre-visit-doc__row-value ${
                        empty ? "pre-visit-doc__row-value--empty" : ""
                      }`}
                    >
                      {empty ? t.empty : text}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <p className="pre-visit-doc__block-note">{t.disclaimer}</p>
        </div>

        <div className="pre-visit-doc__footer-actions">
          <Link className="pre-visit-doc__btn" to="/pre-visit/review">
            {t.backReview}
          </Link>
          <div className="pre-visit-doc__pdf-block">
            <button
              type="button"
              className="pre-visit-doc__btn pre-visit-doc__btn--pdf-active"
              onClick={handleDownloadPdf}
              aria-describedby="previsit-pdf-local-note"
            >
              {t.pdfDisabled}
            </button>
            <p id="previsit-pdf-local-note" className="pre-visit-doc__pdf-hint">
              {t.pdfLocalNote}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
