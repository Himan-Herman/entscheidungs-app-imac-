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
  computePreVisitAiFingerprint,
  isAiDoctorVersionFresh,
  loadPreVisitSession,
  savePreVisitSession,
  setDoctorLanguage,
} from "../constants/preVisitSession.js";
import { apiFetch } from "../../../lib/api.js";
import { authFetch } from "../../../api/authFetch.js";
import { generatePreVisitPdf } from "../pdf/generatePreVisitPdf.js";
import { savePreVisitArchiveItem } from "../session/localPreVisitArchive.js";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome.jsx";
import "../styles/PreVisitDocumentPage.css";

const ui = {
  de: {
    title: "Dokument für den Arzt vorbereiten",
    explanation:
      "Wählen Sie die Sprache, in der die strukturierte Arztversion erstellt werden soll.",
    doctorLangLabel: "Sprache für die Arztversion",
    doctorLangHint:
      "Wählen Sie die Sprache, in der der Arzt oder die Praxis das Dokument lesen soll.",
    sectionStructured: "Strukturierte Arztversion",
    sectionOriginal: "Originalangaben des Patienten",
    disclaimer:
      "Die Arztversion basiert ausschließlich auf den Angaben des Patienten. Es werden keine Diagnosen, Empfehlungen oder Dringlichkeitseinschätzungen erstellt.",
    empty: "nicht angegeben",
    backReview: "Zurück zur Prüfung",
    pdfDisabled: "PDF erstellen",
    pdfLocalNote:
      "Die PDF-Datei wird lokal in Ihrem Browser erstellt. Es werden keine Daten übertragen.",
    consentCheckbox:
      "Ich möchte diese Sitzung lokal im Browser speichern, um sie später erneut ansehen zu können.",
    consentExpl:
      "Die Speicherung erfolgt nur lokal in diesem Browser. Es werden keine Daten an MedScoutX übertragen.",
    saveLocal: "Sitzung lokal speichern",
    saveSuccess: "Die Sitzung wurde lokal gespeichert.",
    archiveNote:
      "Sie können gespeicherte Sitzungen später löschen. Diese Funktion ersetzt keine Patientenakte.",
    historyLink: "Gespeicherte Sitzungen anzeigen",
    consentSectionTitle: "Optionale lokale Kopie",
    createDoctorVersion: "Arztversion erstellen",
    creatingDoctorVersion: "Arztversion wird erstellt …",
    aiError:
      "Die Arztversion konnte gerade nicht erstellt werden. Sie können weiterhin die lokale PDF-Vorschau verwenden.",
    aiSuccessStatus:
      "Die Arztversion wurde auf Basis Ihrer Angaben erstellt.",
    accountSectionTitle: "In meinem Konto speichern",
    accountConsentCheckbox:
      "Ich möchte diese Vorbereitung in meinem MedScoutX-Konto speichern.",
    accountConsentExpl:
      "Diese Speicherung ist optional. Sie können gespeicherte Vorbereitungen später ansehen oder löschen.",
    saveToAccount: "Im Konto speichern",
    accountLoginHint:
      "Melden Sie sich an, um Vorbereitungen in Ihrem Konto zu speichern.",
    accountLoginLink: "Zum Login",
    accountSaveSuccess:
      "Die Vorbereitung wurde in Ihrem Konto gespeichert.",
    accountSaveError:
      "Die Vorbereitung konnte gerade nicht gespeichert werden.",
    sessionTitleDe: "Arztgespräch-Vorbereitung",
    sessionTitleEn: "Doctor visit preparation",
    viewMyPreparations: "Meine Vorbereitungen anzeigen",
  },
  en: {
    title: "Prepare document for the doctor",
    explanation:
      "Choose the language in which the structured doctor version should be created.",
    doctorLangLabel: "Language for the doctor version",
    doctorLangHint:
      "Choose the language in which the doctor or practice should read the document.",
    sectionStructured: "Structured doctor version",
    sectionOriginal: "Original patient statements",
    disclaimer:
      "The doctor version is based only on the patient’s statements. No diagnoses, recommendations or urgency assessments are created.",
    empty: "not specified",
    backReview: "Back to review",
    pdfDisabled: "Create PDF",
    pdfLocalNote:
      "The PDF file is created locally in your browser. No data is transmitted.",
    consentCheckbox:
      "I want to save this session locally in this browser so I can view it again later.",
    consentExpl:
      "The session is stored only locally in this browser. No data is transmitted to MedScoutX.",
    saveLocal: "Save session locally",
    saveSuccess: "The session was saved locally.",
    archiveNote:
      "You can delete saved sessions later. This feature does not replace a medical record.",
    historyLink: "View saved sessions",
    consentSectionTitle: "Optional local copy",
    createDoctorVersion: "Create doctor version",
    creatingDoctorVersion: "Creating doctor version …",
    aiError:
      "The doctor version could not be created right now. You can still use the local PDF preview.",
    aiSuccessStatus:
      "The doctor version was created based on your statements.",
    accountSectionTitle: "Save to my account",
    accountConsentCheckbox:
      "I want to save this preparation in my MedScoutX account.",
    accountConsentExpl:
      "This storage is optional. You can view or delete saved preparations later.",
    saveToAccount: "Save to account",
    accountLoginHint:
      "Sign in to save preparations to your account.",
    accountLoginLink: "Sign in",
    accountSaveSuccess:
      "The preparation was saved to your account.",
    accountSaveError:
      "The preparation could not be saved right now.",
    sessionTitleDe: "Arztgespräch-Vorbereitung",
    sessionTitleEn: "Doctor visit preparation",
    viewMyPreparations: "View my preparations",
  },
};

export default function PreVisitDocumentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const t = ui[language] ?? ui.de;

  const [session, setSession] = useState(() => loadPreVisitSession());
  const [consentLocalSave, setConsentLocalSave] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [consentAccountSave, setConsentAccountSave] = useState(false);
  const [accountSaveSuccess, setAccountSaveSuccess] = useState(false);
  const [accountSaveError, setAccountSaveError] = useState(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [hasAuthToken, setHasAuthToken] = useState(() =>
    typeof window !== "undefined"
      ? !!window.localStorage.getItem("medscout_token")
      : false
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiSuccessNote, setAiSuccessNote] = useState(null);

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
    setHasAuthToken(!!localStorage.getItem("medscout_token"));
  }, [location.pathname, location.key]);

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
    setAiError(null);
    setAiSuccessNote(null);
    const next = setDoctorLanguage(code);
    setSession(next ?? loadPreVisitSession());
  }

  async function handleCreateDoctorVersion() {
    if (!session?.answers) return;

    const dl = doctorLang;
    if (isAiDoctorVersionFresh(session)) {
      setAiError(null);
      setAiSuccessNote(t.aiSuccessStatus);
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiSuccessNote(null);

    try {
      const data = await apiFetch("/api/previsit/doctor-version", {
        method: "POST",
        body: JSON.stringify({
          patientLanguage: session.patientLanguage,
          doctorLanguage: dl,
          answers: session.answers,
        }),
      });

      const fpSession = loadPreVisitSession() || session;
      const next = {
        ...fpSession,
        aiDoctorVersion: data.doctorVersion,
        aiSafetyNotice:
          typeof data.safetyNotice === "string" ? data.safetyNotice : "",
        aiDoctorVersionFingerprint: computePreVisitAiFingerprint(
          fpSession.answers,
          dl
        ),
      };
      savePreVisitSession(next);
      setSession(next);
      setAiSuccessNote(t.aiSuccessStatus);
    } catch {
      setAiError(t.aiError);
    } finally {
      setAiLoading(false);
    }
  }

  function structuredHeading(key) {
    const rec = STRUCTURED_DOCTOR_LABELS[key];
    if (!rec) return "";
    return language === "en" ? rec.en : rec.de;
  }

  function handleDownloadPdf() {
    const latest = loadPreVisitSession();
    if (!latest?.answers) return;
    const next = { ...latest, pdfDownloaded: true };
    savePreVisitSession(next);
    setSession(next);
    generatePreVisitPdf({
      session: next,
      uiLanguage: language,
      labels: {},
    });
  }

  async function handleSaveToAccount() {
    if (!consentAccountSave || !hasAuthToken) return;

    setAccountSaving(true);
    setAccountSaveError(null);
    setAccountSaveSuccess(false);

    try {
      const latest = loadPreVisitSession();
      if (!latest?.answers || typeof latest.answers !== "object") {
        setAccountSaveError(t.accountSaveError);
        return;
      }

      const dl =
        latest.doctorLanguage || latest.patientLanguage || doctorLang;

      const payload = {
        patientLanguage: latest.patientLanguage || "de",
        doctorLanguage: dl || null,
        answers: latest.answers,
        aiDoctorVersion: latest.aiDoctorVersion ?? null,
        aiSafetyNotice:
          typeof latest.aiSafetyNotice === "string" &&
          latest.aiSafetyNotice.trim()
            ? latest.aiSafetyNotice.trim()
            : null,
        title: language === "en" ? t.sessionTitleEn : t.sessionTitleDe,
        status: "pdf_created",
      };

      const res = await authFetch("/api/previsit/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setAccountSaveError(t.accountSaveError);
        return;
      }

      setAccountSaveSuccess(true);
      setConsentAccountSave(false);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setAccountSaveError(t.accountSaveError);
    } finally {
      setAccountSaving(false);
    }
  }

  function handleSaveArchive() {
    if (!consentLocalSave) return;
    const latest = loadPreVisitSession();
    if (!latest?.answers) return;
    try {
      savePreVisitArchiveItem(latest);
      setSaveSuccess(true);
      setConsentLocalSave(false);
    } catch {
      setSaveSuccess(false);
    }
  }

  if (!session?.answers) {
    return null;
  }

  const aiFresh = isAiDoctorVersionFresh(session);
  const structuredSource =
    aiFresh && session.aiDoctorVersion
      ? session.aiDoctorVersion
      : session.answers;

  return (
    <div className="pre-visit-doc">
      <div className="pre-visit-doc__inner">
        <PreVisitModuleChrome />
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
            aria-describedby="previsit-doctor-lang-hint"
          >
            {langOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p id="previsit-doctor-lang-hint" className="pre-visit-doc__field-hint">
            {t.doctorLangHint}
          </p>
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
                const text = structuredSource[key] ?? "";
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
            {aiFresh && session.aiSafetyNotice?.trim() ? (
              <p className="pre-visit-doc__ai-safety-inline" role="note">
                {session.aiSafetyNotice.trim()}
              </p>
            ) : null}
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

        <nav
          className="pre-visit-doc__main-actions"
          aria-label={
            language === "en"
              ? "Doctor version, PDF export, return to review"
              : "Arztversion, PDF-Export, Rückkehr zur Prüfung"
          }
        >
          <div className="pre-visit-doc__ai-block">
            <button
              type="button"
              className="pre-visit-doc__btn pre-visit-doc__btn--create-ai"
              onClick={handleCreateDoctorVersion}
              disabled={aiLoading}
              aria-busy={aiLoading}
            >
              {t.createDoctorVersion}
            </button>
            {aiLoading ? (
              <p
                className="pre-visit-doc__ai-loading"
                aria-live="polite"
                role="status"
              >
                {t.creatingDoctorVersion}
              </p>
            ) : null}
            {aiError ? (
              <p className="pre-visit-doc__ai-error" role="alert">
                {aiError}
              </p>
            ) : null}
            {aiSuccessNote ? (
              <p
                className="pre-visit-doc__ai-success-note"
                role="status"
                aria-live="polite"
              >
                {aiSuccessNote}
              </p>
            ) : null}
          </div>
          <div className="pre-visit-doc__pdf-lead">
            <button
              type="button"
              className="pre-visit-doc__btn pre-visit-doc__btn--pdf-primary"
              onClick={handleDownloadPdf}
              aria-describedby="previsit-pdf-local-note"
            >
              {t.pdfDisabled}
            </button>
            <p id="previsit-pdf-local-note" className="pre-visit-doc__pdf-hint">
              {t.pdfLocalNote}
            </p>
          </div>
          <Link className="pre-visit-doc__back-review" to="/pre-visit/review">
            {t.backReview}
          </Link>
        </nav>

        <section
          className="pre-visit-doc__consent pre-visit-doc__consent--account"
          aria-labelledby="previsit-account-heading"
        >
          <h2
            id="previsit-account-heading"
            className="pre-visit-doc__consent-title pre-visit-doc__consent-title--account"
          >
            {t.accountSectionTitle}
          </h2>

          {!hasAuthToken ? (
            <div className="pre-visit-doc__account-login">
              <p className="pre-visit-doc__account-login-hint">{t.accountLoginHint}</p>
              <Link
                className="pre-visit-doc__btn pre-visit-doc__btn--account-login"
                to="/login"
              >
                {t.accountLoginLink}
              </Link>
            </div>
          ) : (
            <>
              <label className="pre-visit-doc__checkbox-label">
                <input
                  type="checkbox"
                  className="pre-visit-doc__checkbox"
                  checked={consentAccountSave}
                  onChange={(e) => {
                    setConsentAccountSave(e.target.checked);
                    setAccountSaveSuccess(false);
                    setAccountSaveError(null);
                  }}
                />
                <span className="pre-visit-doc__checkbox-text">
                  {t.accountConsentCheckbox}
                </span>
              </label>

              <p className="pre-visit-doc__consent-expl">{t.accountConsentExpl}</p>

              <button
                type="button"
                className="pre-visit-doc__btn pre-visit-doc__btn--account"
                disabled={!consentAccountSave || accountSaving}
                aria-busy={accountSaving}
                onClick={handleSaveToAccount}
              >
                {t.saveToAccount}
              </button>

              {accountSaveSuccess ? (
                <p
                  className="pre-visit-doc__save-success"
                  role="status"
                  aria-live="polite"
                >
                  {t.accountSaveSuccess}
                </p>
              ) : null}

              {accountSaveError ? (
                <p className="pre-visit-doc__account-error" role="alert">
                  {accountSaveError}
                </p>
              ) : null}

              <Link
                className="pre-visit-doc__account-history-link"
                to="/pre-visit/my-preparations"
              >
                {t.viewMyPreparations}
              </Link>
            </>
          )}
        </section>

        <section
          className="pre-visit-doc__consent pre-visit-doc__consent--secondary"
          aria-labelledby="previsit-consent-heading"
        >
          <h2 id="previsit-consent-heading" className="pre-visit-doc__consent-title">
            {t.consentSectionTitle}
          </h2>

          <label className="pre-visit-doc__checkbox-label">
            <input
              type="checkbox"
              className="pre-visit-doc__checkbox"
              checked={consentLocalSave}
              onChange={(e) => {
                setConsentLocalSave(e.target.checked);
                setSaveSuccess(false);
              }}
            />
            <span className="pre-visit-doc__checkbox-text">{t.consentCheckbox}</span>
          </label>

          <p className="pre-visit-doc__consent-expl">{t.consentExpl}</p>

          <button
            type="button"
            className="pre-visit-doc__btn pre-visit-doc__btn--archive"
            disabled={!consentLocalSave}
            onClick={handleSaveArchive}
          >
            {t.saveLocal}
          </button>

          {saveSuccess ? (
            <p className="pre-visit-doc__save-success" role="status" aria-live="polite">
              {t.saveSuccess}
            </p>
          ) : null}

          <p className="pre-visit-doc__archive-note">{t.archiveNote}</p>
          <Link className="pre-visit-doc__history-link" to="/pre-visit/history">
            {t.historyLink}
          </Link>
        </section>
      </div>
    </div>
  );
}
