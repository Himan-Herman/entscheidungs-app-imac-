import { Link } from "react-router-dom";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';

function fmt(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
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

/**
 * @param {{
 *   link: object;
 *   overview: object;
 *   language: string;
 *   t: Record<string, string>;
 *   statusAria: string;
 *   practiceId: string;
 *   onNavigateTab: (tab: string) => void;
 * }} props
 */
export default function PracticePatientOverviewTab({
  link,
  overview,
  language,
  t,
  statusAria,
  practiceId,
  onNavigateTab,
}) {
  const name =
    link.patientProfile?.displayName?.trim() ||
    [link.patient?.firstName, link.patient?.lastName].filter(Boolean).join(" ") ||
    t.patientFallback;
  const statusText = statusLabel(link.status, t);

  return (
    <section className="practice-dashboard__card" aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="practice-dashboard__analytics-heading">
        {t.tabOverview}
      </h2>

      {overview?.hasPatientProvidedInfo ? (
        <p className="practice-record__patient-hint" role="note">
          {t.patientProvidedHint}
        </p>
      ) : null}

      {overview?.openDataRequest ? (
        <p className="practice-record__alert" role="status">
          {t.openDataRequestHint}
        </p>
      ) : null}

      <dl className="practice-patients__detail-dl">
        <div className="practice-patients__detail-row">
          <dt>{t.colName}</dt>
          <dd>{name}</dd>
        </div>
        <div className="practice-patients__detail-row">
          <dt>{t.detailStatus}</dt>
          <dd>
            <span
              className={`practice-patients__status practice-patients__status--${link.status}`}
              aria-label={statusAria}
            >
              {statusText}
            </span>
          </dd>
        </div>
        <div className="practice-patients__detail-row">
          <dt>{t.detailLinkedAt}</dt>
          <dd>{fmt(link.linkedAt, language)}</dd>
        </div>
        <div className="practice-patients__detail-row">
          <dt>{t.colLastActivity}</dt>
          <dd>{fmt(overview?.lastActivityAt, language)}</dd>
        </div>
        <div className="practice-patients__detail-row">
          <dt>{t.overviewLastMessage}</dt>
          <dd>{fmt(overview?.lastMessageAt, language)}</dd>
        </div>
        <div className="practice-patients__detail-row">
          <dt>{t.overviewLastDocument}</dt>
          <dd>{fmt(overview?.lastDocumentSharedAt, language)}</dd>
        </div>
        <div className="practice-patients__detail-row">
          <dt>{t.overviewLastMedication}</dt>
          <dd>
            {overview?.lastMedicationPlanTitle
              ? `${overview.lastMedicationPlanTitle} · ${fmt(overview.lastMedicationPlanPublishedAt, language)}`
              : fmt(overview?.lastMedicationPlanPublishedAt, language)}
          </dd>
        </div>
        <div className="practice-patients__detail-row">
          <dt>{t.overviewLastPreVisit}</dt>
          <dd>
            {overview?.lastPreVisitTitle
              ? `${overview.lastPreVisitTitle} · ${fmt(overview?.lastPreVisitAt, language)}`
              : fmt(overview?.lastPreVisitAt, language)}
          </dd>
        </div>
        <div className="practice-patients__detail-row">
          <dt>{t.overviewProfileAccess}</dt>
          <dd>
            {overview?.profileAccessGranted ? t.profileAccessOn : t.profileAccessOff}
          </dd>
        </div>
      </dl>

      <nav className="practice-record__quick-links" aria-label={t.quickLinksLabel}>
        <button
          type="button"
          className="practice-dashboard__link-btn"
          onClick={() => onNavigateTab("messages")}
        >
          {t.openMessages} ({overview?.messageCount ?? 0})
        </button>
        <button
          type="button"
          className="practice-dashboard__link-btn"
          onClick={() => onNavigateTab("documents")}
        >
          {t.openDocuments} ({overview?.documentCount ?? 0})
        </button>
        <button
          type="button"
          className="practice-dashboard__link-btn"
          onClick={() => onNavigateTab("previsits")}
        >
          {t.openPreVisits} ({overview?.preVisitCount ?? 0})
        </button>
        <Link
          className="practice-dashboard__link-btn"
          to={`/practice/data-requests?practiceId=${encodeURIComponent(practiceId)}`}
        >
          {t.openDataRequests}
        </Link>
      </nav>
    </section>
  );
}
