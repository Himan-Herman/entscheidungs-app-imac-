import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';
import {
  cancelPracticeSession,
  completePracticeSession,
  fetchPracticeTelemedicineSession,
  revokePracticeSessionLink,
  startPracticeSession,
  telemedicineAiFollowup,
  telemedicineAiInstructions,
} from "../api/practiceTelemedicineApi.js";
import {
  participantLabelKey,
  statusLabelKey,
  waitingPatients as selectWaitingPatients,
} from "../telemedicineSessionUtils.js";
import "../../../styles/PracticeDashboardPage.css";
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

export default function PracticeTelemedicineDetailPage() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const practiceId = searchParams.get("practiceId") || "";
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceTelemedicine || getMessages("en").practiceTelemedicine,
    [language],
  );
  const [session, setSession] = useState(null);
  const [hostUrl, setHostUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiText, setAiText] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [followupDraft, setFollowupDraft] = useState("");

  const reload = useCallback(async () => {
    if (!practiceId || !sessionId) return;
    setLoading(true);
    setError("");
    const { res, data } = await fetchPracticeTelemedicineSession(practiceId, sessionId);
    if (!res.ok || !data.ok) {
      setError(res.status === 404 ? t.featureDisabled : t.loadError);
      setSession(null);
    } else {
      setSession(data.session);
    }
    setLoading(false);
  }, [practiceId, sessionId, t.featureDisabled, t.loadError]);

  useEffect(() => {
    document.title = t.detailTitle;
  }, [t.detailTitle]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const waitingPatients = useMemo(
    () => selectWaitingPatients(session?.participants),
    [session],
  );

  const runStart = async () => {
    setBusy(true);
    const { res, data } = await startPracticeSession(practiceId, sessionId);
    setBusy(false);
    if (res.ok && data.ok) {
      setSession(data.session);
      if (data.hostUrl) setHostUrl(data.hostUrl);
    }
  };

  const runComplete = async () => {
    setBusy(true);
    await completePracticeSession(practiceId, sessionId);
    setBusy(false);
    await reload();
  };

  const runCancel = async () => {
    setBusy(true);
    await cancelPracticeSession(practiceId, sessionId);
    setBusy(false);
    await reload();
  };

  const runRevoke = async () => {
    setBusy(true);
    await revokePracticeSessionLink(practiceId, sessionId);
    setBusy(false);
    await reload();
  };

  const runAiInstructions = async () => {
    setBusy(true);
    const { res, data } = await telemedicineAiInstructions(practiceId, { locale: language });
    setBusy(false);
    if (res.ok && data.text) setAiText(data.text);
  };

  const runAiFollowup = async () => {
    setBusy(true);
    const { res, data } = await telemedicineAiFollowup(practiceId, sessionId, {
      locale: language,
      notes: followupNote,
    });
    setBusy(false);
    if (res.ok && data.text) setFollowupDraft(data.text);
  };

  return (
    <main className="telemedicine-page practice-dashboard" lang={language}>
      <nav className="telemedicine-page__nav">
        <Link to={`/practice/telemedicine?practiceId=${encodeURIComponent(practiceId)}`}>
          {t.backList}
        </Link>
      </nav>
      <h1>{session?.title || t.heading}</h1>

      {loading ? <p aria-live="polite">{t.loading}</p> : null}
      {error ? (
        <p role="alert" className="practice-overview__status--error">
          {error}
        </p>
      ) : null}

      {session ? (
        <div className="telemedicine-page__layout telemedicine-page__layout--split">
          <section className="telemedicine-panel" aria-labelledby="tm-detail-info">
            <h2 id="tm-detail-info">{t.status}</h2>
            <p>
              <span className="telemedicine-status">{t[statusLabelKey(session.status)] || session.status}</span>
            </p>
            {(session.status === "cancelled" || session.status === "failed") && session.endedAt ? (
              <p role="status" className="telemedicine-closed-hint" aria-live="polite">
                {t.sessionClosed}
              </p>
            ) : null}
            <p>
              <strong>{t.scheduled}:</strong> {fmt(session.scheduledStartAt, language)}
            </p>
            <p>
              <strong>{t.consentStatusLabel}:</strong>{" "}
              <span className="telemedicine-status">
                {session.consentGranted ? t.consentYes : t.consentNo}
              </span>
            </p>
            {session.practicePatientLinkId ? (
              <p>
                <strong>{t.patientLink}:</strong> {session.practicePatientLinkId}
              </p>
            ) : null}
            <ul className="telemedicine-checklist" aria-label={t.technicalChecklist}>
              <li>{t.checklistMic}</li>
              <li>{t.checklistCamera}</li>
              <li>{t.checklistQuiet}</li>
              <li>{t.checklistConnection}</li>
            </ul>
            <div className="telemedicine-actions">
              <button
                type="button"
                className="telemedicine-btn telemedicine-btn--primary"
                disabled={busy}
                onClick={() => void runStart()}
                aria-label={t.startVideo}
              >
                {t.startVideo}
              </button>
              {hostUrl ? (
                <a
                  className="telemedicine-btn"
                  href={hostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.hostLinkLabel}
                >
                  {t.hostLinkLabel}
                </a>
              ) : null}
              <button type="button" className="telemedicine-btn" disabled={busy} onClick={() => void runComplete()}>
                {t.completeSession}
              </button>
              <button type="button" className="telemedicine-btn" disabled={busy} onClick={() => void runRevoke()}>
                {t.revokeLink}
              </button>
              <button type="button" className="telemedicine-btn" disabled={busy} onClick={() => void runCancel()}>
                {t.cancelSession}
              </button>
            </div>
          </section>

          <section className="telemedicine-panel" aria-labelledby="tm-waiting-heading">
            <h2 id="tm-waiting-heading">{t.waitingPatients}</h2>
            {waitingPatients.length === 0 ? (
              <p>{t.noWaiting}</p>
            ) : (
              <ul className="telemedicine-list">
                {waitingPatients.map((p) => (
                  <li key={p.id}>
                    <span className="telemedicine-status">
                      {t[participantLabelKey(p.status)] || p.status}
                    </span>
                    {p.joinedAt ? ` · ${fmt(p.joinedAt, language)}` : null}
                  </li>
                ))}
              </ul>
            )}

            <div className="telemedicine-ai" aria-labelledby="tm-ai-heading">
              <h3 id="tm-ai-heading">{t.aiSuggestion}</h3>
              <p>{t.aiDisclaimer}</p>
              <button type="button" className="telemedicine-btn" disabled={busy} onClick={() => void runAiInstructions()}>
                {t.aiLoadInstructions}
              </button>
              {aiText ? <pre aria-live="polite">{aiText}</pre> : null}
              <label htmlFor="tm-followup">{t.followupPlaceholder}</label>
              <textarea
                id="tm-followup"
                value={followupNote}
                onChange={(e) => setFollowupNote(e.target.value)}
              />
              <button type="button" className="telemedicine-btn" disabled={busy} onClick={() => void runAiFollowup()}>
                {t.aiFollowup}
              </button>
              {followupDraft ? <pre aria-live="polite">{followupDraft}</pre> : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
