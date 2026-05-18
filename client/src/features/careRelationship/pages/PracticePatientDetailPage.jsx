import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchPracticePatientLink } from "../api/practicePatientsApi.js";
import { patientDisplayName } from "../utils/patientDisplayName.js";
import PracticePatientMessagesSection from "../../communication/components/PracticePatientMessagesSection.jsx";
import PracticePatientMedicationPlanSection from "../../medicationPlan/components/PracticePatientMedicationPlanSection.jsx";
import PracticePatientDocumentsSection from "../../practiceDocuments/components/PracticePatientDocumentsSection.jsx";
import PracticePatientProfileSection from "../components/PracticePatientProfileSection.jsx";
import "../../../styles/PracticeDashboardPage.css";
import "../../../styles/PracticePatientsPage.css";

function fmt(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function statusLabel(status, t) {
  const map = {
    invited: t.statusInvited,
    active: t.statusActive,
    revoked: t.statusRevoked,
    archived: t.statusArchived,
  };
  return map[status] || status;
}

function DetailRow({ label, value }) {
  return (
    <div className="practice-patients__detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function PracticePatientDetailPage() {
  const { linkId } = useParams();
  const [searchParams] = useSearchParams();
  const practiceId = searchParams.get("practiceId") || "";
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practicePatients || getMessages("en").practicePatients,
    [language],
  );

  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const listPath = practiceId
    ? `/practice/patients?practiceId=${encodeURIComponent(practiceId)}`
    : "/practice/patients";

  const loadDetail = useCallback(async () => {
    if (!linkId || !practiceId) {
      setLoading(false);
      setError(t.loadDetailError);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticePatientLink(linkId, practiceId);
      if (res.status === 404 && data.error === "feature_disabled") {
        setLink(null);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok || !data.link) throw new Error("detail_load_failed");
      setLink(data.link);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setLink(null);
      setError(t.loadDetailError);
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId, t.featureDisabled, t.loadDetailError]);

  useEffect(() => {
    document.title = t.detailTitle;
  }, [t.detailTitle]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (loading) {
    return (
      <div className="practice-dashboard practice-patients">
        <div className="practice-dashboard__inner">
          <p className="practice-dashboard__muted">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="practice-dashboard practice-patients">
        <div className="practice-dashboard__inner">
          <Link className="practice-dashboard__back" to={listPath}>
            {t.backList}
          </Link>
          <p className="practice-dashboard__error" role="alert">
            {error || t.loadDetailError}
          </p>
        </div>
      </div>
    );
  }

  const name = patientDisplayName(link, t.patientFallback);
  const email = link.patient?.email?.trim() || t.emailMissing;
  const statusText = statusLabel(link.status, t);
  const statusAria = t.statusAria.replace("{status}", statusText);

  return (
    <div className="practice-dashboard practice-patients">
      <div className="practice-dashboard__inner">
        <Link className="practice-dashboard__back" to={listPath}>
          {t.backList}
        </Link>
        <header className="practice-dashboard__header">
          <h1 className="practice-dashboard__title">{t.detailTitle}</h1>
          <p className="practice-dashboard__intro">{name}</p>
        </header>

        <section className="practice-dashboard__card" aria-labelledby="patient-section-heading">
          <h2 id="patient-section-heading" className="practice-dashboard__analytics-heading">
            {t.detailSectionPatient}
          </h2>
          <dl className="practice-patients__detail-dl">
            <DetailRow label={t.colName} value={name} />
            <DetailRow label={t.colEmail} value={email} />
            {link.patientProfile?.relationLabel ? (
              <DetailRow label={t.detailRelationLabel} value={link.patientProfile.relationLabel} />
            ) : null}
          </dl>
        </section>

        <section
          className="practice-dashboard__card"
          aria-labelledby="relationship-section-heading"
        >
          <h2 id="relationship-section-heading" className="practice-dashboard__analytics-heading">
            {t.detailSectionRelationship}
          </h2>
          <dl className="practice-patients__detail-dl">
            <DetailRow
              label={t.detailStatus}
              value={
                <span
                  className={`practice-patients__status practice-patients__status--${link.status}`}
                  aria-label={statusAria}
                >
                  {statusText}
                </span>
              }
            />
            <DetailRow label={t.detailLinkedAt} value={fmt(link.linkedAt, language)} />
            <DetailRow label={t.detailUpdatedAt} value={fmt(link.updatedAt, language)} />
            {link.revokedAt ? (
              <DetailRow label={t.detailRevokedAt} value={fmt(link.revokedAt, language)} />
            ) : null}
            <DetailRow
              label={t.detailConsentAcceptedAt}
              value={
                link.consentAcceptedAt
                  ? fmt(link.consentAcceptedAt, language)
                  : t.detailConsentMissing
              }
            />
            {link.consentVersion ? (
              <DetailRow label={t.detailConsentVersion} value={link.consentVersion} />
            ) : null}
            <DetailRow label={t.detailLinkId} value={link.id} />
            <DetailRow label={t.detailPracticeId} value={link.practiceProfileId} />
            {link.patientProfileId ? (
              <DetailRow label={t.detailPatientProfileId} value={link.patientProfileId} />
            ) : null}
          </dl>
        </section>

        {practiceId && linkId ? (
          <PracticePatientMessagesSection linkId={linkId} practiceId={practiceId} />
        ) : null}

        {practiceId && linkId ? (
          <PracticePatientMedicationPlanSection linkId={linkId} practiceId={practiceId} />
        ) : null}

        {practiceId && linkId ? (
          <PracticePatientDocumentsSection linkId={linkId} practiceId={practiceId} />
        ) : null}

        {practiceId && linkId ? (
          <PracticePatientProfileSection linkId={linkId} practiceId={practiceId} />
        ) : null}
      </div>
    </div>
  );
}
