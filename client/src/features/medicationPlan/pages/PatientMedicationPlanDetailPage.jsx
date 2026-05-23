import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';
import {
  fetchPatientMedicationPlan,
  fetchPatientMedicationPlanAiSimple,
  submitPatientMedicationPlanQuestion,
} from "../api/patientMedicationPlansApi.js";
import MedicationPlanItemCard from "../components/MedicationPlanItemCard.jsx";
import PracticeBrandingBar from "../../../components/practice/PracticeBrandingBar.jsx";
import { practiceDisplayLabel } from "../../../utils/groupByPracticeBranding.js";
import "../../../styles/PatientInboxPage.css";
import "../../visitMedications/styles/VisitMedications.css";
import "../styles/MedicationPlan.css";

function fmt(iso, lang) {
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default function PatientMedicationPlanDetailPage() {
  const { planId } = useParams();
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).patientMedicationPlan ||
      getMessages("en").patientMedicationPlan,
    [language],
  );

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPreview, setAiPreview] = useState("");

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPatientMedicationPlan(planId);
      if (res.status === 404 && data.error === "feature_disabled") {
        setPlan(null);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setPlan(data.plan);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setPlan(null);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [planId, t.featureDisabled, t.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const title = plan?.title?.trim() || t.planTitleFallback;

  useEffect(() => {
    if (plan) document.title = `${title} – MedScoutX`;
  }, [plan, title]);

  const handleQuestion = async () => {
    setBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const { res, data } = await submitPatientMedicationPlanQuestion(planId);
      if (!res.ok || !data.ok) {
        setError(t.questionError);
        return;
      }
      setStatusMsg(t.questionSent);
    } finally {
      setBusy(false);
    }
  };

  const handleAiSimple = async () => {
    setAiBusy(true);
    setError("");
    try {
      const { res, data } = await fetchPatientMedicationPlanAiSimple(planId, {
        locale: language,
      });
      if (res.status === 503 && data.error === "ai_not_configured") {
        setError(t.aiNotConfigured);
        return;
      }
      if (!res.ok || !data.ok || !data.text) {
        setError(t.aiError);
        return;
      }
      setAiPreview(data.text);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="patient-inbox">
      <Link className="patient-inbox__back" to="/patient/medication-plans#practice-meds-heading">
        {t.backList}
      </Link>
      {plan?.practice ? <PracticeBrandingBar branding={plan.practice} /> : null}
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{title}</h1>
        {plan ? (
          <p className="patient-inbox__intro">
            {practiceDisplayLabel(plan.practice) || plan.practiceName || t.fromPractice}
            {plan.publishedAt
              ? ` · ${t.publishedAt.replace("{date}", fmt(plan.publishedAt, language))}`
              : ""}
            {" · "}
            {t.versionLabel.replace("{version}", String(plan.version))}
          </p>
        ) : null}
        <p className="patient-inbox__safety">{t.safetyNote}</p>
      </header>

      {loading ? <p className="patient-inbox__muted">{t.loading}</p> : null}
      {error ? (
        <p className="patient-inbox__error" role="alert">
          {error}
        </p>
      ) : null}
      {statusMsg ? (
        <p className="medication-plan__success" role="status">
          {statusMsg}
        </p>
      ) : null}

      {plan && !loading && !error ? (
        <>
          <div className="medication-plan__actions patient-inbox__actions">
            <button
              type="button"
              className="patient-threads__btn patient-threads__btn--secondary"
              onClick={handleQuestion}
              disabled={busy || aiBusy}
            >
              {t.askQuestion}
            </button>
            <button
              type="button"
              className="patient-threads__btn patient-threads__btn--secondary"
              onClick={handleAiSimple}
              disabled={busy || aiBusy}
              aria-busy={aiBusy}
            >
              {aiBusy ? t.aiBusy : t.aiSimpleLanguage}
            </button>
            <Link
              className="patient-threads__btn patient-threads__btn--secondary"
              to="/patient/messages"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              {t.messagesLink}
            </Link>
          </div>

          {aiPreview ? (
            <div
              className="medication-plan__ai-preview"
              role="region"
              aria-labelledby="patient-mp-ai-heading"
            >
              <h2 id="patient-mp-ai-heading" className="medication-plan__ai-title">
                {t.aiDraftLabel}
              </h2>
              <p className="patient-inbox__safety">{t.aiDisclaimer}</p>
              <pre className="medication-plan__ai-text">{aiPreview}</pre>
            </div>
          ) : null}

          <div className="vm-list" role="list" aria-label={t.listCaption}>
            {(plan.items || []).map((item) => (
              <MedicationPlanItemCard
                key={item.id}
                item={item}
                t={t}
                language={language}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
