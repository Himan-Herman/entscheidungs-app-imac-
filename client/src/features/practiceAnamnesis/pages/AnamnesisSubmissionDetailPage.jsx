import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  deleteAnamnesisSubmission,
  fetchAnamnesisSubmission,
  patchAnamnesisSubmission,
} from "../api/practiceAnamnesisSubmissionsApi.js";
import { generateAnamnesisPdf, normalizePracticeSubmission } from "../pdf/anamnesisPdfBuilder.js";
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
  const [pdfError, setPdfError] = useState(false);

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

  const handlePdfDownload = () => {
    setPdfError(false);
    const pdfData = normalizePracticeSubmission(submission, language);
    const safeName = `anamnesis-${submission.id.slice(0, 8)}.pdf`;
    const ok = generateAnamnesisPdf(pdfData, safeName);
    if (!ok) setPdfError(true);
  };

  if (loading) return <div className="anamnesis-hub__loading">…</div>;
  if (error || !submission) return <div className="anamnesis-hub__error">{t.loadError || error}</div>;

  const answers = Array.isArray(submission.answersJson) ? submission.answersJson : [];
  const translatedAnswers = Array.isArray(submission.translatedAnswersJson) ? submission.translatedAnswersJson : [];
  const translationMap = new Map(translatedAnswers.map((a) => [a.questionId, a]));

  const hasTranslation = submission.translationStatus === "completed";
  const showTranslationBanner = submission.translationStatus && submission.translationStatus !== "skipped";

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

  const translationStatusLabel = (status) => {
    if (status === "completed") return t.translationStatusCompleted;
    if (status === "skipped") return t.translationStatusSkipped;
    if (status === "failed") return t.translationStatusFailed;
    if (status === "pending") return t.translationStatusPending;
    if (status === "unavailable") return t.translationStatusUnavailable;
    return null;
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
            onClick={handlePdfDownload}
            title={t.pdfDownload}
          >
            ↓ {t.pdfDownload || "PDF"}
          </button>
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

      {pdfError && (
        <p className="anamnesis-submissions__confirm-text" style={{ color: "var(--color-danger, #e53)" }}>
          {t.pdfError || "PDF konnte nicht erstellt werden."}
        </p>
      )}

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

      {showTranslationBanner && (
        <div className={`anamnesis-submission__translation-banner${submission.translationStatus === "failed" ? " anamnesis-submission__translation-banner--failed" : ""}`}>
          <span className={`anamnesis-submission__translation-badge${submission.translationStatus === "failed" ? " anamnesis-submission__translation-badge--failed" : ""}`}>
            {translationStatusLabel(submission.translationStatus)}
          </span>
          <span className="anamnesis-submission__translation-disclaimer">
            {hasTranslation ? t.translationDisclaimer : translationStatusLabel(submission.translationStatus)}
          </span>
        </div>
      )}

      {Object.values(grouped).map((group) => (
        <section key={group.label} className="anamnesis-view__section">
          <h3 className="anamnesis-view__section-title anamnesis-view__section-title--sub">{group.label}</h3>
          <ul className="anamnesis-submission__answers">
            {group.items.map((a, i) => {
              const tr = hasTranslation ? translationMap.get(a.questionId) : null;
              const showTr = tr && tr.translatedText != null;
              return (
                <li key={i} className={`anamnesis-submission__answer-row${showTr ? " anamnesis-submission__answer-row--translated" : ""}`}>
                  <span className={`anamnesis-submission__question-label${showTr ? " anamnesis-submission__question-label--translated" : ""}`}>
                    {a.questionLabel}
                  </span>
                  {showTr ? (
                    <>
                      <div>
                        <div className="anamnesis-submission__answer-col-label">{t.translationTranslated}</div>
                        <span className={`anamnesis-submission__answer-value${tr.uncertain ? " anamnesis-submission__answer-value--uncertain" : ""}`}>
                          {tr.translatedText}
                        </span>
                      </div>
                      <div>
                        <div className="anamnesis-submission__answer-col-label">{t.translationOriginal}</div>
                        <span className="anamnesis-submission__answer-value anamnesis-submission__answer-value--original">
                          {formatValue(a.type, a.value)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="anamnesis-submission__answer-value">{formatValue(a.type, a.value)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
