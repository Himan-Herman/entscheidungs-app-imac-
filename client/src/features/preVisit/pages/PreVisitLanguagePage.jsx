import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations/index.js";
import { PRE_VISIT_LANGUAGE_OPTIONS } from "../constants/languages";
import {
  buildInitialSession,
  DEFAULT_PREVISIT_DOCTOR_LANGUAGE,
  PREVISIT_LOCALE_STORAGE_KEY,
  loadPreVisitSession,
  savePreVisitSession,
} from "../constants/preVisitSession.js";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome.jsx";
import { detectDeviceType, sendPracticeAnalyticsEvent } from "../../../api/productAnalytics.js";
import "../styles/PreVisitLanguagePage.css";

function readInitialPatientLocale(uiLanguage) {
  const allowed = new Set(PRE_VISIT_LANGUAGE_OPTIONS.map((o) => o.id));
  try {
    const stored = sessionStorage.getItem(PREVISIT_LOCALE_STORAGE_KEY);
    if (stored && allowed.has(stored)) return stored;
  } catch {
    /* ignore */
  }
  const session = loadPreVisitSession();
  const fromSession = session?.patientLanguage;
  if (fromSession && allowed.has(fromSession)) return fromSession;
  if (allowed.has(uiLanguage)) return uiLanguage;
  return "de";
}

function readInitialDoctorLocale() {
  const allowed = new Set(PRE_VISIT_LANGUAGE_OPTIONS.map((o) => o.id));
  const session = loadPreVisitSession();
  const fromSession = session?.doctorLanguage;
  if (fromSession && allowed.has(fromSession)) return fromSession;
  const fromPractice = session?.practiceContext?.preferredDoctorLanguage;
  if (fromPractice && allowed.has(fromPractice)) return fromPractice;
  return DEFAULT_PREVISIT_DOCTOR_LANGUAGE;
}

export default function PreVisitLanguagePage() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const [selectedLocale, setSelectedLocale] = useState(() =>
    readInitialPatientLocale(language)
  );
  const [selectedDoctorLocale, setSelectedDoctorLocale] = useState(() =>
    readInitialDoctorLocale()
  );
  const previewLanguage = selectedLocale || language;
  const t = useMemo(
    () => getMessages(previewLanguage).preVisit.language,
    [previewLanguage]
  );

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  const options = useMemo(
    () =>
      PRE_VISIT_LANGUAGE_OPTIONS.map((row) => ({
        value: row.id,
        label: row.nativeName,
      })),
    []
  );

  function handleContinue() {
    try {
      sessionStorage.setItem(PREVISIT_LOCALE_STORAGE_KEY, selectedLocale);
    } catch {
      /* ignore quota / private mode */
    }
    const pv = loadPreVisitSession();
    const base =
      pv && typeof pv === "object" ? pv : buildInitialSession(selectedLocale);
    const next = {
      ...base,
      patientLanguage: selectedLocale,
      doctorLanguage: selectedDoctorLocale,
    };
    delete next.assistantQuestions;
    delete next.aiDoctorVersion;
    delete next.aiDoctorVersionFingerprint;
    delete next.aiSafetyNotice;
    savePreVisitSession(next);
    const qr =
      base?.practiceContext?.qrToken != null
        ? String(base.practiceContext.qrToken).trim()
        : "";
    const deviceType = detectDeviceType();
    void sendPracticeAnalyticsEvent({
      eventType: "previsit_language_selected",
      ...(qr ? { qrToken: qr } : {}),
      metadata: {
        patientLanguage: selectedLocale,
        doctorLanguage: selectedDoctorLocale,
        uiLanguage: language,
        deviceType,
        source: qr ? "qr" : "manual",
      },
    });
    void sendPracticeAnalyticsEvent({
      eventType: "language_pair_used",
      ...(qr ? { qrToken: qr } : {}),
      metadata: {
        patientLanguage: selectedLocale,
        doctorLanguage: selectedDoctorLocale,
        deviceType,
      },
    });
    navigate("/pre-visit/chat");
  }

  return (
    <div className="pre-visit-page">
      <div className="pre-visit-page__shell">
        <PreVisitModuleChrome languageOverride={previewLanguage} />
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

          <div className="pre-visit-card__field">
            <label
              className="pre-visit-card__label"
              htmlFor="previsit-doctor-language"
            >
              {t.doctorLanguageLabel}
            </label>
            <select
              id="previsit-doctor-language"
              className="pre-visit-card__select"
              value={selectedDoctorLocale}
              onChange={(e) => setSelectedDoctorLocale(e.target.value)}
              aria-describedby="previsit-doctor-language-hint"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p
              id="previsit-doctor-language-hint"
              className="pre-visit-card__field-hint"
            >
              {t.doctorLanguageHint}
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
