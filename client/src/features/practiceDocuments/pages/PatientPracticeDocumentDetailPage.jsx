import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  downloadPatientPracticeDocumentFile,
  fetchPatientPracticeDocument,
  submitPatientPracticeDocumentQuestion,
  viewPatientPracticeDocumentFile,
} from "../api/patientPracticeDocumentsApi.js";
import PracticeBrandingBar from "../../../components/practice/PracticeBrandingBar.jsx";
import PatientStructuredDocumentSection from "../components/PatientStructuredDocumentSection.jsx";
import { practiceDisplayLabel } from "../../../utils/groupByPracticeBranding.js";
import "../../../styles/PatientInboxPage.css";
import "../styles/PracticeDocuments.css";

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

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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

export default function PatientPracticeDocumentDetailPage() {
  const { documentId } = useParams();
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).patientPracticeDocuments ||
      getMessages("en").patientPracticeDocuments,
    [language],
  );

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError("");
    setUnavailable(false);
    try {
      const { res, data } = await fetchPatientPracticeDocument(documentId);
      if (res.status === 404 && data.error === "feature_disabled") {
        setDoc(null);
        setError(t.featureDisabled);
        return;
      }
      if (res.status === 410 && data.error === "document_unavailable") {
        setDoc(null);
        setUnavailable(true);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setDoc(data.document);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setDoc(null);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [documentId, t.featureDisabled, t.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (doc?.title) document.title = `${doc.title} – MedScoutX`;
  }, [doc?.title]);

  async function handleQuestion() {
    setBusy(true);
    setDownloadError("");
    setStatusMsg("");
    try {
      const { res, data } = await submitPatientPracticeDocumentQuestion(documentId);
      if (!res.ok || !data.ok) {
        setDownloadError(t.questionError);
        return;
      }
      setStatusMsg(t.questionSent);
    } finally {
      setBusy(false);
    }
  }

  function mapDownloadError(message) {
    if (message === "forbidden") return t.permissionDenied;
    if (message === "link_expired") return t.linkExpired;
    if (message === "link_revoked") return t.linkRevoked;
    if (message === "document_unavailable") return t.notAvailable;
    return t.downloadError;
  }

  async function handleView(file) {
    setDownloadError("");
    try {
      await viewPatientPracticeDocumentFile(documentId, file.id, file.originalFileName);
    } catch (e) {
      if (e?.message === "document_unavailable") {
        setUnavailable(true);
        setDoc(null);
        return;
      }
      setDownloadError(mapDownloadError(e?.message));
    }
  }

  async function handleDownload(file) {
    setDownloadError("");
    try {
      await downloadPatientPracticeDocumentFile(documentId, file.id, file.originalFileName);
    } catch (e) {
      if (e?.message === "document_unavailable") {
        setUnavailable(true);
        setDoc(null);
        return;
      }
      setDownloadError(mapDownloadError(e?.message));
    }
  }

  return (
    <div className="patient-inbox">
      <Link className="patient-inbox__back" to="/patient/practice-documents">
        {t.backList}
      </Link>
      {doc?.practice ? <PracticeBrandingBar branding={doc.practice} /> : null}
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{doc?.title || t.heading}</h1>
        {doc ? (
          <p className="patient-inbox__intro">
            {practiceDisplayLabel(doc.practice) || doc.practiceName || t.fromPractice} ·{" "}
            {typeLabel(doc.type, t)} · {t.statusShared}
            {doc.sharedAt
              ? ` · ${t.sharedAt.replace("{date}", fmt(doc.sharedAt, language))}`
              : ""}
          </p>
        ) : null}
        <p className="patient-inbox__safety">{t.safetyNote}</p>
      </header>

      {loading ? <p className="patient-inbox__muted">{t.loading}</p> : null}
      {unavailable ? (
        <p className="patient-inbox__error" role="alert">
          {t.notAvailable}
        </p>
      ) : null}
      {error ? (
        <p className="patient-inbox__error" role="alert">
          {error}
        </p>
      ) : null}
      {downloadError ? (
        <p className="patient-inbox__error" role="alert">
          {downloadError}
        </p>
      ) : null}
      {statusMsg ? (
        <p className="medication-plan__success" role="status">
          {statusMsg}
        </p>
      ) : null}

      {doc && !loading && !error ? (
        <div className="patient-inbox__actions">
          <button
            type="button"
            className="patient-threads__btn patient-threads__btn--secondary"
            onClick={handleQuestion}
            disabled={busy}
          >
            {t.askQuestion}
          </button>
          <Link
            className="patient-threads__btn patient-threads__btn--secondary"
            to="/patient/messages"
            style={{ textAlign: "center", textDecoration: "none" }}
          >
            {t.messagesLink}
          </Link>
        </div>
      ) : null}

      {doc?.description ? (
        <p className="patient-inbox__muted">{doc.description}</p>
      ) : null}

      {doc && !loading && !error ? (
        <PatientStructuredDocumentSection documentId={documentId} />
      ) : null}

      {doc && !loading && !error ? (
        <section aria-labelledby="ppd-files-heading">
          <h2 id="ppd-files-heading" className="patient-inbox__title" style={{ fontSize: "1.1rem" }}>
            {t.filesHeading}
          </h2>
          <ul className="practice-documents__file-list">
            {(doc.files || []).map((file) => (
              <li key={file.id}>
                <span>
                  {file.originalFileName} ·{" "}
                  {t.fileSize.replace("{size}", formatBytes(file.sizeBytes))}
                </span>
                <div className="practice-documents__file-actions">
                  <button
                    type="button"
                    className="patient-threads__btn patient-threads__btn--secondary"
                    onClick={() => void handleView(file)}
                    aria-label={`${t.viewDocument} ${file.originalFileName}`}
                  >
                    {t.viewDocument}
                  </button>
                  <button
                    type="button"
                    className="patient-threads__btn patient-threads__btn--primary"
                    onClick={() => void handleDownload(file)}
                    aria-label={`${t.download} ${file.originalFileName}`}
                  >
                    {t.download}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
