import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { authFetch } from "../../../api/authFetch.js";
import { PRE_VISIT_LANGUAGE_OPTIONS } from "../constants/languages.js";
import {
  PRE_VISIT_QUESTION_STEPS,
} from "../constants/questionFlow.js";
import {
  computePreVisitAiFingerprint,
  PREVISIT_LOCALE_STORAGE_KEY,
  savePreVisitSession,
} from "../constants/preVisitSession.js";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome.jsx";
import "../styles/PreVisitAccountHistoryPage.css";

const copy = {
  de: {
    title: "Meine Vorbereitungen",
    subtitle:
      "Hier sehen Sie die Vorbereitungen, die Sie ausdrücklich in Ihrem MedScoutX-Konto gespeichert haben.",
    loginHint:
      "Melden Sie sich an, um gespeicherte Vorbereitungen zu sehen.",
    loginCta: "Zum Login",
    loading: "Wird geladen …",
    loadError:
      "Die Liste konnte gerade nicht geladen werden. Bitte versuchen Sie es später erneut.",
    empty:
      "Es sind noch keine Vorbereitungen in Ihrem Konto gespeichert.",
    patientLang: "Patientensprache",
    doctorLang: "Arztsprache",
    created: "Erstellt",
    statusLabel: "Status",
    open: "Öffnen",
    deleteOne: "Löschen",
    deleteAll: "Alle Vorbereitungen löschen",
    confirmDeleteAll:
      "Möchten Sie wirklich alle in Ihrem Konto gespeicherten Vorbereitungen löschen? Dies kann nicht rückgängig gemacht werden.",
    privacyNote:
      "Gespeicherte Vorbereitungen können jederzeit gelöscht werden. Diese Funktion ersetzt keine Patientenakte.",
    defaultTitle: "Arztgespräch-Vorbereitung",
    deleteError:
      "Die Vorbereitung konnte gerade nicht gelöscht werden.",
    deleteAllError:
      "Die Vorbereitungen konnten gerade nicht gelöscht werden.",
    statusDraft: "Entwurf",
    statusPdfCreated: "PDF erstellt",
    statusCompleted: "Abgeschlossen",
  },
  en: {
    title: "My preparations",
    subtitle:
      "Here you can see the preparations you explicitly saved to your MedScoutX account.",
    loginHint: "Sign in to view saved preparations.",
    loginCta: "Sign in",
    loading: "Loading…",
    loadError:
      "The list could not be loaded right now. Please try again later.",
    empty: "No preparations have been saved to your account yet.",
    patientLang: "Patient language",
    doctorLang: "Doctor language",
    created: "Created",
    statusLabel: "Status",
    open: "Open",
    deleteOne: "Delete",
    deleteAll: "Delete all preparations",
    confirmDeleteAll:
      "Delete all preparations saved to your account? This cannot be undone.",
    privacyNote:
      "Saved preparations can be deleted at any time. This feature does not replace a medical record.",
    defaultTitle: "Doctor visit preparation",
    deleteError: "The preparation could not be deleted right now.",
    deleteAllError: "Preparations could not be deleted right now.",
    statusDraft: "Draft",
    statusPdfCreated: "PDF created",
    statusCompleted: "Completed",
  },
};

function langLabel(code, uiLang) {
  const opt = PRE_VISIT_LANGUAGE_OPTIONS.find((o) => o.id === code);
  if (!opt) return code || "—";
  return uiLang === "en" ? opt.labelEn : opt.labelDe;
}

function previewFromAnswers(answers, maxLen = 140) {
  const raw =
    String(answers?.appointmentReason || "").trim() ||
    String(answers?.symptomsOwnWords || "").trim() ||
    "";
  if (!raw) return "—";
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen).trim()}…`;
}

function formatCreated(iso, uiLang) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(uiLang === "en" ? "en-GB" : "de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "—";
  }
}

function statusText(status, t) {
  switch (status) {
    case "pdf_created":
      return t.statusPdfCreated;
    case "completed":
      return t.statusCompleted;
    case "draft":
    default:
      return t.statusDraft;
  }
}

function hydrateServerSessionToLocal(record) {
  const answers =
    record.answers &&
    typeof record.answers === "object" &&
    !Array.isArray(record.answers)
      ? JSON.parse(JSON.stringify(record.answers))
      : {};
  const doctorLang = record.doctorLanguage || record.patientLanguage || "de";
  const patientLang = record.patientLanguage || "de";
  const completedStep = PRE_VISIT_QUESTION_STEPS.length - 1;

  const payload = {
    patientLanguage: patientLang,
    doctorLanguage: doctorLang,
    answers,
    stepIndex: completedStep,
  };

  if (record.aiDoctorVersion != null) {
    payload.aiDoctorVersion = record.aiDoctorVersion;
    payload.aiSafetyNotice =
      typeof record.aiSafetyNotice === "string" ? record.aiSafetyNotice : "";
    payload.aiDoctorVersionFingerprint = computePreVisitAiFingerprint(
      answers,
      doctorLang,
    );
  }

  if (record.pdfDownloaded === true) {
    payload.pdfDownloaded = true;
  } else if (record.status === "pdf_created") {
    payload.pdfDownloaded = true;
  }

  savePreVisitSession(payload);
  try {
    sessionStorage.setItem(PREVISIT_LOCALE_STORAGE_KEY, patientLang);
  } catch {
    /* ignore */
  }
}

export default function PreVisitAccountHistoryPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const t = copy[language] ?? copy.de;

  const [hasAuthToken, setHasAuthToken] = useState(() =>
    typeof window !== "undefined"
      ? !!window.localStorage.getItem("medscout_token")
      : false,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);

  useEffect(() => {
    setHasAuthToken(!!localStorage.getItem("medscout_token"));
  }, [location.pathname, location.key]);

  const fetchSessions = useCallback(async () => {
    const messages = copy[language] ?? copy.de;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/previsit/sessions");
      if (!res.ok) {
        setError(messages.loadError);
        setSessions([]);
        return;
      }
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.sessions)) {
        setError(messages.loadError);
        setSessions([]);
        return;
      }
      setSessions(data.sessions);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setError(messages.loadError);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (!hasAuthToken) {
      setSessions([]);
      setLoading(false);
      setError(null);
      return;
    }
    fetchSessions();
  }, [hasAuthToken, fetchSessions]);

  useEffect(() => {
    document.title =
      language === "en"
        ? "MedScoutX — My preparations"
        : "MedScoutX — Meine Vorbereitungen";
  }, [language]);

  function cardTitle(row) {
    return (typeof row.title === "string" && row.title.trim()) || t.defaultTitle;
  }

  function handleOpen(record) {
    hydrateServerSessionToLocal(record);
    navigate("/pre-visit/document");
  }

  async function handleDeleteOne(id) {
    setDeleteBusyId(id);
    setError(null);
    try {
      const res = await authFetch(`/api/previsit/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(t.deleteError);
        return;
      }
      await fetchSessions();
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setError(t.deleteError);
    } finally {
      setDeleteBusyId(null);
    }
  }

  async function handleDeleteAll() {
    if (!window.confirm(t.confirmDeleteAll)) return;
    setDeleteAllBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/previsit/sessions", {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(t.deleteAllError);
        return;
      }
      await fetchSessions();
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setError(t.deleteAllError);
    } finally {
      setDeleteAllBusy(false);
    }
  }

  const showEmpty =
    !loading && !error && hasAuthToken && sessions.length === 0;

  return (
    <div className="pre-visit-account">
      <div className="pre-visit-account__inner">
        <PreVisitModuleChrome />

        <header className="pre-visit-account__header">
          <h1 className="pre-visit-account__title">{t.title}</h1>
          <p className="pre-visit-account__subtitle">{t.subtitle}</p>
        </header>

        {!hasAuthToken ? (
          <div className="pre-visit-account__gate">
            <p className="pre-visit-account__gate-text">{t.loginHint}</p>
            <Link className="pre-visit-account__btn pre-visit-account__btn--login" to="/login">
              {t.loginCta}
            </Link>
          </div>
        ) : null}

        {hasAuthToken && loading ? (
          <p className="pre-visit-account__loading" role="status" aria-live="polite">
            {t.loading}
          </p>
        ) : null}

        {hasAuthToken && error ? (
          <p className="pre-visit-account__error" role="alert">
            {error}
          </p>
        ) : null}

        {hasAuthToken && showEmpty ? (
          <p className="pre-visit-account__empty">{t.empty}</p>
        ) : null}

        {hasAuthToken && !loading && !error && sessions.length > 0 ? (
          <>
            <ul className="pre-visit-account__list">
              {sessions.map((row) => (
                <li key={row.id} className="pre-visit-account__card-wrap">
                  <article className="pre-visit-account__card">
                    <h3 className="pre-visit-account__card-title">
                      {cardTitle(row)}
                    </h3>
                    <div className="pre-visit-account__meta">
                      <div className="pre-visit-account__meta-item">
                        <span className="pre-visit-account__meta-label">{t.created}</span>
                        <span className="pre-visit-account__meta-value">
                          {formatCreated(row.createdAt, language)}
                        </span>
                      </div>
                      <div className="pre-visit-account__meta-item">
                        <span className="pre-visit-account__meta-label">{t.patientLang}</span>
                        <span className="pre-visit-account__meta-value">
                          {langLabel(row.patientLanguage, language)}
                        </span>
                      </div>
                      <div className="pre-visit-account__meta-item">
                        <span className="pre-visit-account__meta-label">{t.doctorLang}</span>
                        <span className="pre-visit-account__meta-value">
                          {row.doctorLanguage
                            ? langLabel(row.doctorLanguage, language)
                            : "—"}
                        </span>
                      </div>
                      <div className="pre-visit-account__meta-item">
                        <span className="pre-visit-account__meta-label">{t.statusLabel}</span>
                        <span className="pre-visit-account__meta-value">
                          {statusText(row.status, t)}
                        </span>
                      </div>
                    </div>
                    <p className="pre-visit-account__preview">
                      {previewFromAnswers(row.answers)}
                    </p>
                    <div className="pre-visit-account__actions">
                      <button
                        type="button"
                        className="pre-visit-account__btn pre-visit-account__btn--primary"
                        onClick={() => handleOpen(row)}
                      >
                        {t.open}
                      </button>
                      <button
                        type="button"
                        className="pre-visit-account__btn pre-visit-account__btn--danger"
                        disabled={deleteBusyId === row.id || deleteAllBusy}
                        onClick={() => handleDeleteOne(row.id)}
                      >
                        {t.deleteOne}
                      </button>
                    </div>
                  </article>
                </li>
              ))}
            </ul>

            <div className="pre-visit-account__danger-zone">
              <button
                type="button"
                className="pre-visit-account__btn pre-visit-account__btn--danger-secondary"
                disabled={deleteAllBusy || !!deleteBusyId || sessions.length === 0}
                onClick={handleDeleteAll}
              >
                {t.deleteAll}
              </button>
            </div>
          </>
        ) : null}

        <p className="pre-visit-account__privacy">{t.privacyNote}</p>
      </div>
    </div>
  );
}
