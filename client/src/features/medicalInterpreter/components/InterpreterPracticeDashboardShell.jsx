import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchInterpreterPracticeStatus } from "../api/interpreterPracticeApi.js";
import { useMedicalInterpreterPracticeMessages } from "../hooks/useMedicalInterpreterPracticeMessages.js";
import {
  practiceInterpreterPath,
  usePracticeIdFromQuery,
} from "../utils/practiceContextQuery.js";

/**
 * B2B practice dashboard shell (Phase 4.4) — structure only, no patient sessions.
 */
export default function InterpreterPracticeDashboardShell() {
  const t = useMedicalInterpreterPracticeMessages();
  const practiceId = usePracticeIdFromQuery();
  const [statusLoad, setStatusLoad] = useState({ loading: true, data: null });

  useEffect(() => {
    document.title = t.dashboard.pageTitle;
  }, [t.dashboard.pageTitle]);

  useEffect(() => {
    let cancelled = false;
    void fetchInterpreterPracticeStatus({ practiceId }).then((result) => {
      if (!cancelled) {
        setStatusLoad({ loading: false, data: result });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  const interpreterHref = practiceInterpreterPath("/practice/interpreter", practiceId);
  const hubHref = practiceInterpreterPath("/practice", practiceId);
  const invitesHref = practiceInterpreterPath(
    "/practice/interpreter/invites",
    practiceId,
  );
  const sessionsHref = practiceInterpreterPath(
    "/practice/interpreter/sessions",
    practiceId,
  );

  const access = statusLoad.data?.practiceAccess;
  const statusLabel = () => {
    if (statusLoad.loading) return t.dashboard.statusLoading;
    if (!statusLoad.data?.enabled) return t.dashboard.statusOff;
    if (access?.canView) return t.dashboard.statusActive;
    return t.dashboard.statusLimited;
  };

  const statusDetail = () => {
    if (statusLoad.loading) return t.dashboard.statusLoadingDetail;
    if (!statusLoad.data?.enabled) return t.dashboard.statusOffDetail;
    if (!statusLoad.data?.interpreterEnabled) return t.dashboard.statusModuleOffDetail;
    if (access?.canView) return t.dashboard.statusActiveDetail;
    return t.dashboard.statusLimitedDetail;
  };

  return (
    <main
      className="medical-interpreter-page interp-practice-dash interp-root"
      id="main-content"
    >
      <nav className="interp-practice-dash__nav" aria-label={t.dashboard.navAria}>
        <Link className="medical-interpreter-page__back" to={interpreterHref}>
          {t.chrome.backToInterpreter}
        </Link>
        <Link className="medical-interpreter-page__nav-link" to={hubHref}>
          {t.chrome.backToPractice}
        </Link>
      </nav>

      <header className="interp-practice-dash__hero">
        <h1 className="medical-interpreter-page__title">{t.dashboard.heading}</h1>
        <p className="medical-interpreter-page__intro">{t.dashboard.intro}</p>
        <p className="interp-practice-dash__overview" role="note">
          {t.dashboard.overview}
        </p>
      </header>

      <section
        className="interp-practice-dash__cards"
        aria-labelledby="interp-practice-dash-cards-heading"
      >
        <h2 id="interp-practice-dash-cards-heading" className="interp-practice-dash__section-title">
          {t.dashboard.cardsHeading}
        </h2>
        <div className="interp-practice-dash__cards-grid">
          <article
            className="interp-practice-dash__card"
            aria-labelledby="interp-dash-card-status"
          >
            <h3 id="interp-dash-card-status" className="interp-practice-dash__card-title">
              {t.dashboard.cardStatusTitle}
            </h3>
            <p className="interp-practice-dash__card-status" role="status">
              <span className="interp-practice-dash__card-status-label">
                {statusLabel()}
              </span>
            </p>
            <p className="interp-practice-dash__card-body">{statusDetail()}</p>
          </article>

          <article
            className="interp-practice-dash__card"
            aria-labelledby="interp-dash-card-sessions"
          >
            <h3 id="interp-dash-card-sessions" className="interp-practice-dash__card-title">
              {t.dashboard.cardSessionsTitle}
            </h3>
            <p className="interp-practice-dash__card-body">{t.dashboard.cardSessionsBody}</p>
            <Link className="medical-interpreter-page__nav-link" to={sessionsHref}>
              {t.dashboard.openSessions}
            </Link>
          </article>

          <article
            className="interp-practice-dash__card interp-practice-dash__card--notice"
            aria-labelledby="interp-dash-card-consent"
          >
            <h3 id="interp-dash-card-consent" className="interp-practice-dash__card-title">
              {t.dashboard.cardConsentTitle}
            </h3>
            <p className="interp-practice-dash__card-body">{t.dashboard.cardConsentBody}</p>
          </article>

          <article
            className="interp-practice-dash__card interp-practice-dash__card--notice"
            aria-labelledby="interp-dash-card-safety"
          >
            <h3 id="interp-dash-card-safety" className="interp-practice-dash__card-title">
              {t.dashboard.cardSafetyTitle}
            </h3>
            <p className="interp-practice-dash__card-body">{t.dashboard.cardSafetyBody}</p>
          </article>
        </div>
      </section>

      <section
        className="interp-practice-dash__future"
        aria-labelledby="interp-practice-dash-future-heading"
      >
        <h2 id="interp-practice-dash-future-heading" className="interp-practice-dash__section-title">
          {t.dashboard.futureSessionsHeading}
        </h2>
        <p className="interp-practice-dash__future-intro">{t.dashboard.futureSessionsIntro}</p>
        <p className="interp-practice-dash__future-intro">{t.dashboard.futureSessionsEmptyBody}</p>
        <Link className="medical-interpreter-page__nav-link" to={sessionsHref}>
          {t.dashboard.openSessions}
        </Link>
      </section>

      <section className="interp-practice-dash__invites-link" aria-label={t.dashboard.openInvites}>
        <Link className="medical-interpreter-page__nav-link" to={invitesHref}>
          {t.dashboard.openInvites}
        </Link>
      </section>

      <section
        className="interp-practice-dash__privacy"
        aria-labelledby="interp-practice-dash-privacy-heading"
      >
        <h2 id="interp-practice-dash-privacy-heading" className="interp-practice-dash__section-title">
          {t.dashboard.privacyHeading}
        </h2>
        <ul className="interp-practice-dash__privacy-list">
          <li>{t.dashboard.privacyNoDiagnosis}</li>
          <li>{t.dashboard.privacyNoTriage}</li>
          <li>{t.dashboard.privacyNoTreatment}</li>
          <li>{t.dashboard.privacyNoHiddenAccess}</li>
          <li>{t.dashboard.privacyPatientControl}</li>
        </ul>
        <p className="medical-interpreter-safety" role="note">
          {t.safety.communicationOnly}
        </p>
      </section>
    </main>
  );
}
