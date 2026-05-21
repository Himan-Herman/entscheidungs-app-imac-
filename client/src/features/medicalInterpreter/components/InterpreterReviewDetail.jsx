import {
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_DRAFT,
  SESSION_STATUS_ENDED,
} from "../constants.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { formatInterpreterDateOnly, formatInterpreterDateTime } from "../utils/formatInterpreterDate.js";
import {
  getLanguageNativeName,
  getSessionDisplayTitle,
} from "../utils/sessionDisplayTitle.js";
import { getSessionSummaryStats } from "../utils/sessionSummary.js";
import { sessionIsMixedDirection } from "../utils/interpreterLocale.js";
import InterpreterReviewTimeline from "./InterpreterReviewTimeline.jsx";

/**
 * @param {{
 *   session: import('../types.js').InterpreterSession;
 *   labels: object;
 * }} props
 */
export default function InterpreterReviewDetail({ session, labels: t }) {
  const { language: uiLanguage } = useLanguage();
  const title = getSessionDisplayTitle(session, t, uiLanguage);
  const patientLang = getLanguageNativeName(session.patientLanguage);
  const doctorLang = getLanguageNativeName(session.doctorLanguage);
  const stats = getSessionSummaryStats(session);

  const statusText =
    session.status === SESSION_STATUS_ENDED
      ? t.history.statusEnded
      : session.status === SESSION_STATUS_ACTIVE
        ? t.history.statusActive
        : t.history.statusDraft;

  const summaryLine = t.review.summaryLine
    .replace("{{turns}}", String(stats.turnCount))
    .replace("{{translated}}", String(stats.translatedCount));

  return (
    <div className="interpreter-review__detail">
      <header className="interpreter-review__header">
        <h1 className="medical-interpreter-page__title">{title}</h1>
        <p className="interpreter-review__subtitle">{t.review.notMedicalRecord}</p>
        <p className="interpreter-review__summary" role="status">
          {summaryLine}
          {stats.draftCount > 0
            ? ` ${t.review.summaryDrafts.replace("{{count}}", String(stats.draftCount))}`
            : ""}
        </p>
      </header>

      <p className="medical-interpreter-safety" role="note">
        {t.safety.strip}
      </p>
      <p className="interpreter-review__verify" role="note">
        {t.review.documentationNotice}
      </p>
      {sessionIsMixedDirection(session) ? (
        <p className="interpreter-review__mixed-direction-note" role="note">
          {t.languages.mixedDirectionNote}
        </p>
      ) : null}

      <section
        className="interpreter-review__meta-panel"
        aria-labelledby="interp-review-meta-heading"
      >
        <h2 id="interp-review-meta-heading" className="interpreter-live__section-title">
          {t.review.metadataHeading}
        </h2>
        <dl className="interpreter-review__meta-list">
          <div className="interpreter-review__meta-row">
            <dt>{t.review.status}</dt>
            <dd>
              <span className={`interpreter-history__badge interpreter-history__badge--${session.status}`}>
                {statusText}
              </span>
            </dd>
          </div>
          <div className="interpreter-review__meta-row">
            <dt>{t.review.created}</dt>
            <dd>
              <time dateTime={session.createdAt}>
                {formatInterpreterDateTime(session.createdAt)}
              </time>
            </dd>
          </div>
          {session.endedAt ? (
            <div className="interpreter-review__meta-row">
              <dt>{t.review.ended}</dt>
              <dd>
                <time dateTime={session.endedAt}>
                  {formatInterpreterDateTime(session.endedAt)}
                </time>
              </dd>
            </div>
          ) : null}
          <div className="interpreter-review__meta-row">
            <dt>{t.languages.patientLabel}</dt>
            <dd>{patientLang}</dd>
          </div>
          <div className="interpreter-review__meta-row">
            <dt>{t.languages.doctorLabel}</dt>
            <dd>{doctorLang}</dd>
          </div>
          {session.doctorName?.trim() ? (
            <div className="interpreter-review__meta-row">
              <dt>{t.doctorInfo.doctorName}</dt>
              <dd>{session.doctorName}</dd>
            </div>
          ) : null}
          {session.practiceName?.trim() ? (
            <div className="interpreter-review__meta-row">
              <dt>{t.doctorInfo.practiceName}</dt>
              <dd>{session.practiceName}</dd>
            </div>
          ) : null}
          {session.specialty?.trim() ? (
            <div className="interpreter-review__meta-row">
              <dt>{t.doctorInfo.specialty}</dt>
              <dd>{session.specialty}</dd>
            </div>
          ) : null}
          {session.appointmentDateTime?.trim() ? (
            <div className="interpreter-review__meta-row">
              <dt>{t.doctorInfo.appointmentDate}</dt>
              <dd>{formatInterpreterDateOnly(session.appointmentDateTime)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section
        className="interpreter-review__turns"
        aria-labelledby="interp-review-turns-heading"
      >
        <h2 id="interp-review-turns-heading" className="interpreter-live__section-title">
          {t.review.timelineHeading}
        </h2>
        <InterpreterReviewTimeline session={session} labels={t} />
      </section>
    </div>
  );
}
