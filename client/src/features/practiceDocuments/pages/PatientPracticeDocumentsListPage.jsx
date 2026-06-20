import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPatientPracticeDocuments } from "../api/patientPracticeDocumentsApi.js";
import PracticeBrandingBar from "../../../components/practice/PracticeBrandingBar.jsx";
import { groupByPracticeBranding, practiceDisplayLabel } from "../../../utils/groupByPracticeBranding.js";
import { isPatientBillingExplainClientEnabled } from "../../patientBillingExplain/featureFlag.js";
import "../../../styles/PatientInboxPage.css";
import "../styles/PracticeDocuments.css";
import "../../patientBillingExplain/styles/PatientBillingExplain.css";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';

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
  const tBilling = useMemo(
    () =>
      getMessages(language).patientBillingExplain ||
      getMessages("en").patientBillingExplain,
    [language],
  );
  const billingExplainEnabled = isPatientBillingExplainClientEnabled();

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

  const grouped = useMemo(
    () => groupByPracticeBranding(documents, (doc) => doc.practice),
    [documents],
  );

  return (
    <div className="patient-inbox practice-documents-list">
      <Link className="patient-inbox__back" to="/patient/practice">
        {t.backHub}
      </Link>
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{t.heading}</h1>
        <p className="patient-inbox__intro">{t.intro}</p>
        <p className="patient-inbox__safety">{t.safetyNote}</p>
      </header>

      {billingExplainEnabled ? (
        <Link className="billing-explain-entry" to="/patient/billing-explainer">
          <span className="billing-explain-entry__text">
            <span className="billing-explain-entry__title">{tBilling.entryCardTitle}</span>
            <span className="billing-explain-entry__sub">{tBilling.entryCardSubtitle}</span>
          </span>
          <ChevronRight
            size={20}
            strokeWidth={2}
            aria-hidden="true"
            className="billing-explain-entry__chevron"
          />
        </Link>
      ) : null}

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
        <div aria-label={t.listCaption}>
          {grouped.map((group) => (
            <section key={group.branding?.id || group.items[0]?.id} className="patient-inbox__practice-group">
              <PracticeBrandingBar branding={group.branding} compact />
              <ul className="patient-inbox__list">
                {group.items.map((doc) => {
            const practiceName =
              practiceDisplayLabel(doc.practice) || doc.practiceName || t.fromPractice;
            const shared = doc.sharedAt
              ? t.sharedAt.replace("{date}", fmt(doc.sharedAt, language))
              : "";

            return (
              <li key={doc.id} className="patient-inbox__item">
                <Link
                  className="patient-inbox__link"
                  to={`/patient/practice-documents/${doc.id}`}
                  aria-label={`${t.openDocument}: ${doc.title}`}
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
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
