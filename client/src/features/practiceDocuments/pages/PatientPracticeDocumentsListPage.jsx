import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPatientPracticeDocuments } from "../api/patientPracticeDocumentsApi.js";
import "../../../styles/PatientInboxPage.css";

function fmt(iso, lang) {
  try {
    return new Date(iso).toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function typeLabel(type, t) {
  const map = {
    report: t.typeReport,
    lab: t.typeLab,
    imaging: t.typeImaging,
    referral: t.typeReferral,
    discharge: t.typeDischarge,
    prescription_info: t.typePrescriptionInfo,
    other: t.typeOther,
  };
  return map[type] || type;
}

export default function PatientPracticeDocumentsListPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).patientPracticeDocuments ||
      getMessages("en").patientPracticeDocuments,
    [language],
  );

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPatientPracticeDocuments();
      if (res.status === 404 && data.error === "feature_disabled") {
        setDocuments([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setDocuments([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.featureDisabled, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="patient-inbox">
      <Link className="patient-inbox__back" to="/patient">
        {t.backHub}
      </Link>
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{t.heading}</h1>
        <p className="patient-inbox__intro">{t.intro}</p>
        <p className="patient-inbox__safety">{t.safetyNote}</p>
      </header>

      {loading ? <p className="patient-inbox__muted">{t.loading}</p> : null}
      {error ? (
        <p className="patient-inbox__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && documents.length === 0 ? (
        <p className="patient-inbox__muted">{t.empty}</p>
      ) : null}

      {!loading && !error && documents.length > 0 ? (
        <ul className="patient-inbox__list" aria-label={t.listCaption}>
          {documents.map((doc) => {
            const practiceName = doc.practiceName || t.fromPractice;
            const shared = doc.sharedAt
              ? t.sharedAt.replace("{date}", fmt(doc.sharedAt, language))
              : "";

            return (
              <li key={doc.id} className="patient-inbox__item">
                <Link
                  className="patient-inbox__link"
                  to={`/patient/practice-documents/${doc.id}`}
                >
                  <span className="patient-inbox__item-title">{doc.title}</span>
                  <span className="patient-inbox__item-meta">
                    {practiceName} · {typeLabel(doc.type, t)}
                    {shared ? ` · ${shared}` : ""}
                  </span>
                  <span className="patient-inbox__item-action">{t.openDocument}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
