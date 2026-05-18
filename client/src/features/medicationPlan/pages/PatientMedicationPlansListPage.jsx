import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPatientMedicationPlans } from "../api/patientMedicationPlansApi.js";
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

export default function PatientMedicationPlansListPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).patientMedicationPlan ||
      getMessages("en").patientMedicationPlan,
    [language],
  );

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPatientMedicationPlans();
      if (res.status === 404 && data.error === "feature_disabled") {
        setPlans([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setPlans(Array.isArray(data.plans) ? data.plans : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setPlans([]);
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

      {!loading && !error && plans.length === 0 ? (
        <p className="patient-inbox__muted">{t.empty}</p>
      ) : null}

      {!loading && !error && plans.length > 0 ? (
        <ul className="patient-inbox__list" aria-label={t.listCaption}>
          {plans.map((plan) => {
            const title =
              plan.title?.trim() ||
              t.planTitleFallback;
            const practiceName = plan.practiceName || t.fromPractice;
            const published = plan.publishedAt
              ? t.publishedAt.replace("{date}", fmt(plan.publishedAt, language))
              : "";

            return (
              <li key={plan.id} className="patient-inbox__item">
                <Link
                  className="patient-inbox__link"
                  to={`/patient/medication-plans/${plan.id}`}
                >
                  <span className="patient-inbox__item-title">{title}</span>
                  <span className="patient-inbox__item-meta">
                    {practiceName}
                    {published ? ` · ${published}` : ""}
                    {" · "}
                    {t.versionLabel.replace("{version}", String(plan.version))}
                  </span>
                  <span className="patient-inbox__item-action">{t.openPlan}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
