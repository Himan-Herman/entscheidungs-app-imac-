import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { PRE_VISIT_LANGUAGE_OPTIONS } from "../constants/languages";
import { PREVISIT_LOCALE_STORAGE_KEY } from "../constants/preVisitSession.js";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome.jsx";
import "../styles/PreVisitLanguagePage.css";

const copy = {
  de: {
    eyebrow: "Pre-Visit",
    title: "Arztgespräch vorbereiten",
    explanation:
      "Dieses System hilft Ihnen dabei, Ihre Beschwerden und Fragen strukturiert für einen Arzttermin vorzubereiten. Es werden keine Diagnosen oder medizinischen Empfehlungen erstellt.",
    trust: "Alle Angaben beruhen ausschließlich auf Ihren eigenen Aussagen.",
    valueProp:
      "Bereiten Sie Beschwerden, Medikamente, Dokumente und Fragen strukturiert vor – in Ihrer Sprache.",
    languageLabel:
      "Sprache, in der Sie mit MedScoutX antworten möchten",
    languageHint:
      "Sie können Ihre Angaben in der Sprache machen, in der Sie sich am sichersten ausdrücken können.",
    continue: "Weiter",
  },
  en: {
    eyebrow: "Pre-visit",
    title: "Prepare for your appointment",
    explanation:
      "This tool helps you structure your concerns and questions for a medical appointment. It does not provide diagnoses or medical recommendations.",
    trust: "All information is based solely on your own statements.",
    valueProp:
      "Prepare symptoms, medications, documents and questions in a structured way — in your language.",
    languageLabel: "Language you want to use with MedScoutX",
    languageHint:
      "You can provide your information in the language in which you feel most confident.",
    continue: "Continue",
  },
};

export default function PreVisitLanguagePage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = copy[language] ?? copy.de;

  const [selectedLocale, setSelectedLocale] = useState("de");

  useEffect(() => {
    document.title =
      language === "en"
        ? "MedScoutX — Prepare for your appointment"
        : "MedScoutX — Arztgespräch vorbereiten";
  }, [language]);

  const options = useMemo(
    () =>
      PRE_VISIT_LANGUAGE_OPTIONS.map((row) => ({
        value: row.id,
        label: language === "en" ? row.labelEn : row.labelDe,
      })),
    [language]
  );

  function handleContinue() {
    try {
      sessionStorage.setItem(PREVISIT_LOCALE_STORAGE_KEY, selectedLocale);
    } catch {
      /* ignore quota / private mode */
    }
    navigate("/pre-visit/chat");
  }

  return (
    <div className="pre-visit-page">
      <div className="pre-visit-page__shell">
        <PreVisitModuleChrome />
        <article
          className="pre-visit-card"
          aria-labelledby="previsit-title"
        >
          <p className="pre-visit-card__eyebrow">{t.eyebrow}</p>
          <h1 id="previsit-title" className="pre-visit-card__title">
            {t.title}
          </h1>
          <p className="pre-visit-card__lead">{t.explanation}</p>
          <p className="pre-visit-card__value-prop">{t.valueProp}</p>
          <p className="pre-visit-card__trust">{t.trust}</p>

          <div className="pre-visit-card__field">
            <label
              className="pre-visit-card__label"
              htmlFor="previsit-language"
            >
              {t.languageLabel}
            </label>
            <select
              id="previsit-language"
              className="pre-visit-card__select"
              value={selectedLocale}
              onChange={(e) => setSelectedLocale(e.target.value)}
              aria-describedby="previsit-language-hint"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p id="previsit-language-hint" className="pre-visit-card__field-hint">
              {t.languageHint}
            </p>
          </div>

          <div className="pre-visit-card__actions">
            <button
              type="button"
              className="pre-visit-card__submit"
              onClick={handleContinue}
            >
              {t.continue}
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
