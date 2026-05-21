import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';
import {
  fetchPatientTelemedicineSession,
  grantTelemedicineConsent,
  patientJoinTelemedicine,
  patientLeaveTelemedicine,
} from "../api/patientTelemedicineApi.js";
import "../../../styles/WorkspaceHubPages.css";
import "../styles/TelemedicinePages.css";

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

export default function PatientTelemedicineDetailPage() {
  const { sessionId } = useParams();
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).patientTelemedicine || getMessages("en").patientTelemedicine,
    [language],
  );
  const [session, setSession] = useState(null);
  const [joinUrl, setJoinUrl] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    const { res, data } = await fetchPatientTelemedicineSession(sessionId);
    if (!res.ok || !data.ok) {
      setError(res.status === 404 ? t.featureDisabled : t.loadError);
      setSession(null);
    } else {
      setSession(data.session);
    }
    setLoading(false);
  }, [sessionId, t.featureDisabled, t.loadError]);

  useEffect(() => {
    document.title = t.detailTitle;
  }, [t.detailTitle]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const hasConsent = Boolean(session?.consentGranted);

  const onConsent = async () => {
    if (!consentChecked) return;
    setBusy(true);
    const { res, data } = await grantTelemedicineConsent(sessionId);
    setBusy(false);
    if (res.ok && data.ok) {
      setSession(data.session);
    } else if (data.error === "link_revoked") {
      setError(t.linkRevoked);
    }
  };

  const onJoin = async () => {
    setBusy(true);
    setError("");
    const { res, data } = await patientJoinTelemedicine(sessionId);
    setBusy(false);
    if (!res.ok) {
      if (data.error === "consent_required") setError(t.consentRequired);
      else if (data.error === "link_revoked") setError(t.linkRevoked);
      else setError(t.loadError);
      return;
    }
    if (data.session) setSession(data.session);
    if (data.joinUrl) setJoinUrl(data.joinUrl);
  };

  const onLeave = async () => {
    setBusy(true);
    await patientLeaveTelemedicine(sessionId);
    setBusy(false);
    setJoinUrl("");
    await reload();
  };

  return (
    <main className="telemedicine-page workspace-hub" lang={language}>
      <nav className="telemedicine-page__nav">
        <Link to="/patient/telemedicine">{t.backList}</Link>
        <Link to="/patient">{t.backHub}</Link>
      </nav>
      <h1>{session?.title || t.heading}</h1>

      {loading ? <p aria-live="polite">{t.loading}</p> : null}
      {error ? (
        <p role="alert" className="practice-overview__status--error">
          {error}
        </p>
      ) : null}

      {session ? (
        <div className="telemedicine-panel">
          <p>
            <span className="telemedicine-status" aria-label={t.status}>
              {t[`status_${session.status}`] || session.status}
            </span>
          </p>
          {(session.status === "cancelled" || session.status === "failed") && session.endedAt ? (
            <p role="status" className="telemedicine-closed-hint" aria-live="polite">
              {t.sessionClosed}
            </p>
          ) : null}
          <p>
            <strong>{t.scheduled}:</strong> {fmt(session.scheduledStartAt, language)}
          </p>

          <section aria-labelledby="tm-tech-heading">
            <h2 id="tm-tech-heading">{t.technicalHints}</h2>
            <ul className="telemedicine-checklist">
              <li>{t.technicalMic}</li>
              <li>{t.technicalConnection}</li>
              <li>{t.technicalPrivacy}</li>
            </ul>
          </section>

          {session.linkRevoked ? (
            <p role="alert">{t.linkRevoked}</p>
          ) : (
            <>
              {!hasConsent ? (
                <section className="telemedicine-consent" aria-labelledby="tm-consent-heading">
                  <h2 id="tm-consent-heading">{t.consentHeading}</h2>
                  <p>{t.consentRequired}</p>
                  <label>
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      aria-describedby="tm-consent-text"
                    />
                    <span id="tm-consent-text">{t.consentText}</span>
                  </label>
                  <div className="telemedicine-actions">
                    <button
                      type="button"
                      className="telemedicine-btn telemedicine-btn--primary"
                      disabled={busy || !consentChecked}
                      onClick={() => void onConsent()}
                    >
                      {t.consentConfirm}
                    </button>
                  </div>
                </section>
              ) : (
                <p aria-live="polite">{t.consentGranted}</p>
              )}

              {hasConsent && session.hasJoinLink ? (
                <div className="telemedicine-actions">
                  <button
                    type="button"
                    className="telemedicine-btn telemedicine-btn--primary"
                    disabled={busy}
                    onClick={() => void onJoin()}
                    aria-label={t.joinWaiting}
                  >
                    {t.joinWaiting}
                  </button>
                  {joinUrl ? (
                    <a
                      className="telemedicine-btn telemedicine-btn--primary"
                      href={joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t.openVideo}
                    >
                      {t.openVideo}
                    </a>
                  ) : null}
                  {session.status === "waiting" ? (
                    <p aria-live="polite">{t.waitingStatus}</p>
                  ) : null}
                  <button type="button" className="telemedicine-btn" disabled={busy} onClick={() => void onLeave()}>
                    {t.leaveSession}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </main>
  );
}
