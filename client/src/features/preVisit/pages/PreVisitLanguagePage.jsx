import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { PRE_VISIT_LANGUAGE_OPTIONS } from "../constants/languages";
import "../styles/PreVisitLanguagePage.css";

const copy = {
  de: {
    eyebrow: "Pre-Visit",
    title: "Arztgespräch vorbereiten",
    explanation:
      "Dieses System hilft Ihnen dabei, Ihre Beschwerden und Fragen strukturiert für einen Arzttermin vorzubereiten. Es werden keine Diagnosen oder medizinischen Empfehlungen erstellt.",
    trust: "Alle Angaben beruhen ausschließlich auf Ihren eigenen Aussagen.",
    languageLabel: "Sprache für Ihre Angaben",
    continue: "Weiter",
    saved: "Die Sprachauswahl wurde gespeichert.",
    backHome: "Zurück zur Startseite",
  },
  en: {
    eyebrow: "Pre-visit",
    title: "Prepare for your appointment",
    explanation:
      "This tool helps you structure your concerns and questions for a medical appointment. It does not provide diagnoses or medical recommendations.",
    trust: "All information is based solely on your own statements.",
    languageLabel: "Language for your entries",
    continue: "Continue",
    saved: "Your language selection has been saved.",
    backHome: "Back to home",
  },
};

const STORAGE_KEY = "medscoutx_previsit_locale";

export default function PreVisitLanguagePage() {
  const { language } = useLanguage();
  const t = copy[language] ?? copy.de;

  const [selectedLocale, setSelectedLocale] = useState("de");
  const [confirmed, setConfirmed] = useState(false);

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
      sessionStorage.setItem(STORAGE_KEY, selectedLocale);
    } catch {
      /* ignore quota / private mode */
    }
    setConfirmed(true);
  }

  return (
    <div className="pre-visit-page">
      <div className="pre-visit-page__shell">
        <article
          className="pre-visit-card"
          aria-labelledby="previsit-title"
        >
          <p className="pre-visit-card__eyebrow">{t.eyebrow}</p>
          <h1 id="previsit-title" className="pre-visit-card__title">
            {t.title}
          </h1>
          <p className="pre-visit-card__lead">{t.explanation}</p>
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
              disabled={confirmed}
              onChange={(e) => setSelectedLocale(e.target.value)}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pre-visit-card__actions">
            <button
              type="button"
              className="pre-visit-card__submit"
              disabled={confirmed}
              onClick={handleContinue}
            >
              {t.continue}
            </button>
            {confirmed ? (
              <p className="pre-visit-card__status" role="status">
                {t.saved}
              </p>
            ) : null}
          </div>
        </article>

        <Link className="pre-visit-page__back" to="/">
          {t.backHome}
        </Link>
      </div>
    </div>
  );
}
