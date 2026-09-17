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
  const { linkId, isActiveRelationship } = usePracticeContext();
  const { language } = useLanguage();
  const t = getMessages(language).practiceContext || getMessages("en").practiceContext;

  return (
    <div className="practice-context">
      <h1 className="practice-context__title">{t.hubTitle}</h1>

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

      <Link className="patient-inbox__back" to="/patient/practice">
        {t.backToOverview}
      </Link>
    </div>
  );
}
