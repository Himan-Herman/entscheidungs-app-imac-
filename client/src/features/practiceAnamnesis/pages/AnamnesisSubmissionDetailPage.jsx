import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  deleteAnamnesisSubmission,
  fetchAnamnesisSubmission,
  patchAnamnesisSubmission,
} from "../api/practiceAnamnesisSubmissionsApi.js";
import "../PracticeAnamnesisPages.css";

export default function AnamnesisSubmissionDetailPage() {
  const { templateId, submissionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMemo(() => getMessages(language).anamnesisSubmissions || getMessages("en").anamnesisSubmissions, [language]);
  const practiceId = searchParams.get("practiceId") || "";

  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const backUrl = `/practice/anamnesis/${templateId}/submissions${practiceId ? `?practiceId=${encodeURIComponent(practiceId)}` : ""}`;

  useEffect(() => {
    if (!practiceId) return;
    setLoading(true);
    fetchAnamnesisSubmission(practiceId, submissionId)
      .then(({ res, data }) => {
        if (!res.ok) { setError("loadError"); return; }
        setSubmission(data.submission);
      })
      .catch(() => setError("loadError"))
      .finally(() => setLoading(false));
  }, [practiceId, submissionId]);

  const handleArchive = async () => {
    await patchAnamnesisSubmission(practiceId, submissionId, {
      status: submission?.status === "archived" ? "viewed" : "archived",
    });
    navigate(backUrl);
  };

  const handleDelete = async () => {
    await deleteAnamnesisSubmission(practiceId, submissionId);
    navigate(backUrl);
  };

  if (loading) return <div className="anamnesis-hub__loading">…</div>;
  if (error || !submission) return <div className="anamnesis-hub__error">{t.loadError || error}</div>;

  const answers = Array.isArray(submission.answersJson) ? submission.answersJson : [];

  const grouped = answers.reduce((acc, a) => {
    const key = a.sectionId || "__top";
    const label = a.sectionLabel || t.sectionLabel;
    if (!acc[key]) acc[key] = { label, items: [] };
    acc[key].items.push(a);
    return acc;
  }, {});

  const formatValue = (type, value) => {
    if (value === null || value === undefined || value === "") return t.noAnswer;
    if (type === "yes_no") return value ? "✓" : "✗";
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  };

  return (
    <div className="anamnesis-editor">
      <nav className="anamnesis-editor__top-nav">
        <Link className="anamnesis-editor__back-link" to={backUrl}>← {t.backToSubmissions}</Link>
      </nav>

      <div className="anamnesis-view__header">
        <div>
          <h1 className="anamnesis-view__title">{t.heading}</h1>
          <p className="anamnesis-view__desc">
            {t.submittedAt}: {new Date(submission.submittedAt).toLocaleString(language)}
            {" · "}{t.patientLanguage}: {submission.patientLanguage.toUpperCase()}
            {submission.link && ` · ${t.via}: ${submission.link.label || `#${submission.link.tokenPrefix}`}`}
          </p>
        </div>
        <div className="anamnesis-view__header-actions">
          <button
            type="button"
            className="anamnesis-hub__btn anamnesis-hub__btn--outline"
            onClick={handleArchive}
          >
            {submission.status === "archived" ? t.unarchive : t.archive}
          </button>
          {confirmDelete ? (
            <>
              <button type="button" className="anamnesis-hub__btn" style={{ background: "var(--color-danger, #e53)" }} onClick={handleDelete}>✓</button>
              <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--ghost" onClick={() => setConfirmDelete(false)}>✕</button>
            </>
          ) : (
            <button type="button" className="anamnesis-hub__btn anamnesis-hub__btn--ghost" onClick={() => setConfirmDelete(true)}>
              🗑 {t.deleteSubmission}
            </button>
          )}
        </div>
      </div>

      {confirmDelete && (
        <p className="anamnesis-submissions__confirm-text" style={{ color: "var(--color-danger, #e53)" }}>
          {t.confirmDeleteSubmission}
        </p>
      )}

      <div className="anamnesis-submission__meta-row">
        <span>{t.consentGranted}: {new Date(submission.consentGrantedAt).toLocaleString(language)}</span>
        <span>{t.consentVersion}: {submission.consentVersion}</span>
      </div>

      {submission.patientInfoJson && (
        <section className="anamnesis-submission__patient-box">
          <h2 className="anamnesis-view__section-title">{t.patientDataHeading}</h2>
          <dl className="anamnesis-submission__patient-dl">
            {(submission.patientInfoJson.firstName || submission.patientInfoJson.lastName) && (
              <>
                <dt>{t.patientName}</dt>
                <dd>{[submission.patientInfoJson.firstName, submission.patientInfoJson.lastName].filter(Boolean).join(" ")}</dd>
              </>
            )}
            {submission.patientInfoJson.dateOfBirth && (
              <>
                <dt>{t.patientDob}</dt>
                <dd>{submission.patientInfoJson.dateOfBirth}</dd>
              </>
            )}
            {submission.patientInfoJson.email && (
              <>
                <dt>{t.patientEmail}</dt>
                <dd>{submission.patientInfoJson.email}</dd>
              </>
            )}
            {submission.patientInfoJson.phone && (
              <>
                <dt>{t.patientPhone}</dt>
                <dd>{submission.patientInfoJson.phone}</dd>
              </>
            )}
            {submission.patientInfoJson.insuranceName && (
              <>
                <dt>{t.patientInsurance}</dt>
                <dd>{submission.patientInfoJson.insuranceName}{submission.patientInfoJson.insuranceType ? ` (${submission.patientInfoJson.insuranceType.toUpperCase()})` : ""}</dd>
              </>
            )}
            {submission.patientInfoJson.insuranceNumber && (
              <>
                <dt>{t.patientInsuranceNumber}</dt>
                <dd>{submission.patientInfoJson.insuranceNumber}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      <h2 className="anamnesis-view__section-title">{t.answersHeading}</h2>

      {Object.values(grouped).map((group) => (
        <section key={group.label} className="anamnesis-view__section">
          <h3 className="anamnesis-view__section-title anamnesis-view__section-title--sub">{group.label}</h3>
          <ul className="anamnesis-submission__answers">
            {group.items.map((a, i) => (
              <li key={i} className="anamnesis-submission__answer-row">
                <span className="anamnesis-submission__question-label">{a.questionLabel}</span>
                <span className="anamnesis-submission__answer-value">{formatValue(a.type, a.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
