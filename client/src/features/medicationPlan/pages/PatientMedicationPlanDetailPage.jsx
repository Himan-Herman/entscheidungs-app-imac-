import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPatientMedicationPlan } from "../api/patientMedicationPlansApi.js";
import MedicationPlanItemCard from "../components/MedicationPlanItemCard.jsx";
import "../../../styles/PatientInboxPage.css";
import "../../visitMedications/styles/VisitMedications.css";

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

  const title =
    plan?.title?.trim() || t.planTitleFallback;

  useEffect(() => {
    if (plan) document.title = `${title} – MedScoutX`;
  }, [plan, title]);

  return (
    <div className="patient-inbox">
      <Link className="patient-inbox__back" to="/patient/medication-plans">
        {t.backList}
      </Link>
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{title}</h1>
        {plan ? (
          <p className="patient-inbox__intro">
            {plan.practiceName || t.fromPractice}
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

      {plan && !loading && !error ? (
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
      ) : null}
    </div>
  );
}
