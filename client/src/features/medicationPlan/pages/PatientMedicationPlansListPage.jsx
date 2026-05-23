import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPatientMedicationPlans } from "../api/patientMedicationPlansApi.js";
import PracticeBrandingBar from "../../../components/practice/PracticeBrandingBar.jsx";
import { groupByPracticeBranding, practiceDisplayLabel } from "../../../utils/groupByPracticeBranding.js";
import PatientOwnMedicationForm from "../../patientOwnMedication/components/PatientOwnMedicationForm.jsx";
import PatientOwnMedicationCard from "../../patientOwnMedication/components/PatientOwnMedicationCard.jsx";
import {
  deleteOwnMedication,
  getReminderConsent,
  listOwnMedications,
  setReminderConsent,
  upsertOwnMedication,
} from "../../patientOwnMedication/patientOwnMedicationStore.js";
import "../../../styles/PatientInboxPage.css";
import "../../patientOwnMedication/styles/PatientOwnMedication.css";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";

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

export default function PatientMedicationPlansListPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).patientMedicationPlan ||
      getMessages("en").patientMedicationPlan,
    [language],
  );

  const [ownMeds, setOwnMeds] = useState(() => listOwnMedications());
  const [reminderConsent, setReminderConsentState] = useState(() =>
    getReminderConsent(),
  );
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [practicePlans, setPracticePlans] = useState([]);
  const [practiceLoading, setPracticeLoading] = useState(true);
  const [practiceError, setPracticeError] = useState("");

  const reloadOwn = useCallback(() => {
    setOwnMeds(listOwnMedications());
    setReminderConsentState(getReminderConsent());
  }, []);

  const loadPractice = useCallback(async () => {
    setPracticeLoading(true);
    setPracticeError("");
    try {
      const { res, data } = await fetchPatientMedicationPlans();
      if (res.status === 404 && data.error === "feature_disabled") {
        setPracticePlans([]);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setPracticePlans(Array.isArray(data.plans) ? data.plans : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setPracticePlans([]);
      setPracticeError(t.loadError);
    } finally {
      setPracticeLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    loadPractice();
  }, [loadPractice]);

  const groupedPractice = useMemo(
    () => groupByPracticeBranding(practicePlans, (plan) => plan.practice),
    [practicePlans],
  );

  const handleConsentChange = (e) => {
    setReminderConsent(e.target.checked);
    reloadOwn();
  };

  const handleSaveOwn = (entry) => {
    upsertOwnMedication(entry);
    setShowForm(false);
    setEditing(null);
    reloadOwn();
  };

  const handleDeleteOwn = (id) => {
    if (!window.confirm(t.ownCard.deleteConfirm)) return;
    deleteOwnMedication(id);
    reloadOwn();
  };

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

      <section className="patient-own-med__section" aria-labelledby="own-meds-heading">
        <h2 id="own-meds-heading" className="patient-own-med__section-title">
          {t.listCaption}
        </h2>

        <div className="patient-own-med__consent">
          <input
            id="own-med-reminder-consent"
            type="checkbox"
            checked={reminderConsent}
            onChange={handleConsentChange}
          />
          <label htmlFor="own-med-reminder-consent">
            <strong>{t.reminderConsentLabel}</strong>
            <span className="patient-own-med__hint">{t.reminderConsentHint}</span>
          </label>
        </div>

        {!showForm && !editing ? (
          <button
            type="button"
            className="patient-own-med__btn patient-own-med__btn--primary"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            {t.addMedication}
          </button>
        ) : null}

        {showForm || editing ? (
          <PatientOwnMedicationForm
            initial={editing}
            reminderConsent={reminderConsent}
            onSave={handleSaveOwn}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
            labels={t}
          />
        ) : null}

        {ownMeds.length === 0 && !showForm ? (
          <p className="patient-inbox__muted">{t.empty}</p>
        ) : null}

        {ownMeds.length > 0 ? (
          <ul className="patient-own-med__list" aria-label={t.listCaption}>
            {ownMeds.map((entry) => (
              <li key={entry.id}>
                <PatientOwnMedicationCard
                  entry={entry}
                  labels={t}
                  onEdit={() => {
                    setShowForm(false);
                    setEditing(entry);
                  }}
                  onDelete={() => handleDeleteOwn(entry.id)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {(practiceLoading || practicePlans.length > 0 || practiceError) && (
        <section
          className="patient-own-med__practice-section"
          aria-labelledby="practice-meds-heading"
        >
          <h2 id="practice-meds-heading" className="patient-own-med__section-title">
            {t.practiceSectionTitle}
          </h2>
          <p className="patient-inbox__intro">{t.practiceSectionIntro}</p>

          {practiceLoading ? (
            <p className="patient-inbox__muted">{t.loading}</p>
          ) : null}
          {practiceError ? (
            <p className="patient-inbox__error" role="alert">
              {practiceError}
            </p>
          ) : null}

          {!practiceLoading && practicePlans.length > 0 ? (
            <div aria-label={t.practiceSectionTitle}>
              {groupedPractice.map((group) => (
                <section
                  key={group.branding?.id || group.items[0]?.id}
                  className="patient-inbox__practice-group"
                >
                  <PracticeBrandingBar branding={group.branding} compact />
                  <ul className="patient-inbox__list">
                    {group.items.map((plan) => {
                      const title = plan.title?.trim() || t.planTitleFallback;
                      const practiceName =
                        practiceDisplayLabel(plan.practice) ||
                        plan.practiceName ||
                        t.fromPractice;
                      const published = plan.publishedAt
                        ? t.publishedAt.replace(
                            "{date}",
                            fmt(plan.publishedAt, language),
                          )
                        : "";

                      return (
                        <li key={plan.id} className="patient-inbox__item">
                          <Link
                            className="patient-inbox__link"
                            to={`/patient/medication-plans/practice/${plan.id}`}
                          >
                            <span className="patient-inbox__item-title">{title}</span>
                            <span className="patient-inbox__item-meta">
                              {practiceName}
                              {published ? ` · ${published}` : ""}
                              {" · "}
                              {t.versionLabel.replace(
                                "{version}",
                                String(plan.version),
                              )}
                            </span>
                            <span className="patient-inbox__item-action">
                              {t.openPlan}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
