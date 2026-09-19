import { Link } from "react-router-dom";
import { usePracticeContext } from "../usePracticeContext.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";

/**
 * The hub of one practice.
 *
 * Identity and switching live in the context bar above, so this page is just
 * the list of what this practice offers. Only functions that actually exist are
 * listed; the remaining practice-scoped areas move in as they are migrated.
 */
export default function PracticeContextHomePage() {
  const { linkId, isActiveRelationship, relationshipStatus, practice } = usePracticeContext();
  const { language } = useLanguage();
  const t = getMessages(language).practiceContext || getMessages("en").practiceContext;

  // Connected but nothing shared: every area below exists, but the practice
  // cannot send anything into it yet. Said first, with the one action that
  // changes it — otherwise each area just looks empty and nobody knows why.
  const consentPending = relationshipStatus === "invited";

  return (
    <div className="practice-context">
      <h1 className="practice-context__title">{t.hubTitle}</h1>

      {consentPending ? (
        <section className="practice-context__pending" aria-labelledby="consent-pending-title">
          <h2 id="consent-pending-title" className="practice-context__pending-title">
            {t.consentPendingTitle}
          </h2>
          <p className="practice-context__pending-body">
            {t.consentPendingBody.replace("{practice}", practice?.displayName || "")}
          </p>
          <Link
            className="practice-context__pending-action"
            to={`/patient/practice-links?request=${encodeURIComponent(linkId)}`}
          >
            {t.consentPendingAction}
          </Link>
        </section>
      ) : null}

      {!isActiveRelationship ? (
        <p className="practice-context__notice" role="status">
          {t.relationshipEnded}
        </p>
      ) : null}

      <ul className="practice-hub__list">
        <li>
          <Link className="practice-hub__entry" to={`/patient/practice/${linkId}/inbox`}>
            <span className="practice-hub__entry-name">{t.inboxTitle}</span>
            <span className="practice-hub__entry-hint">{t.inboxHint}</span>
          </Link>
        </li>
        <li>
          <Link className="practice-hub__entry" to={`/patient/practice/${linkId}/messages`}>
            <span className="practice-hub__entry-name">{t.messagesTitle}</span>
            <span className="practice-hub__entry-hint">{t.messagesHint}</span>
          </Link>
        </li>
        <li>
          <Link className="practice-hub__entry" to={`/patient/practice/${linkId}/appointments`}>
            <span className="practice-hub__entry-name">{t.appointmentsTitle}</span>
            <span className="practice-hub__entry-hint">{t.appointmentsHint}</span>
          </Link>
        </li>
        <li>
          <Link className="practice-hub__entry" to={`/patient/practice/${linkId}/documents`}>
            <span className="practice-hub__entry-name">{t.documentsTitle}</span>
            <span className="practice-hub__entry-hint">{t.documentsHint}</span>
          </Link>
        </li>
        <li>
          <Link
            className="practice-hub__entry"
            to={`/patient/practice/${linkId}/medication-plans`}
          >
            <span className="practice-hub__entry-name">{t.medicationTitle}</span>
            <span className="practice-hub__entry-hint">{t.medicationHint}</span>
          </Link>
        </li>
        <li>
          <Link className="practice-hub__entry" to={`/patient/practice/${linkId}/telemedicine`}>
            <span className="practice-hub__entry-name">{t.telemedicineTitle}</span>
            <span className="practice-hub__entry-hint">{t.telemedicineHint}</span>
          </Link>
        </li>
        <li>
          <Link className="practice-hub__entry" to={`/patient/practice/${linkId}/erezept`}>
            <span className="practice-hub__entry-name">{t.erezeptTitle}</span>
            <span className="practice-hub__entry-hint">{t.erezeptHint}</span>
          </Link>
        </li>
      </ul>

      {/* What this practice may see and what happened — the patient's own
          control and transparency, set apart from what the practice offers. */}
      <h2 className="practice-hub__group-title">{t.yourDataHeading}</h2>
      <ul className="practice-hub__list">
        <li>
          <Link className="practice-hub__entry" to={`/patient/practice/${linkId}/data-control`}>
            <span className="practice-hub__entry-name">{t.dataControlTitle}</span>
            <span className="practice-hub__entry-hint">{t.dataControlHint}</span>
          </Link>
        </li>
        <li>
          <Link className="practice-hub__entry" to={`/patient/practice/${linkId}/activity`}>
            <span className="practice-hub__entry-name">{t.activityTitle}</span>
            <span className="practice-hub__entry-hint">{t.activityHint}</span>
          </Link>
        </li>
      </ul>

      <Link className="patient-inbox__back" to="/patient/practice">
        {t.backToOverview}
      </Link>
    </div>
  );
}
