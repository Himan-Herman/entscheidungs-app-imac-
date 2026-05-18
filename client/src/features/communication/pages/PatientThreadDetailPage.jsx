import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  archivePatientThread,
  fetchPatientThread,
  sendPatientThreadMessage,
} from "../api/patientThreadsApi.js";
import "../../../styles/PatientInboxPage.css";
import "../../../styles/PatientThreadsPage.css";

function fmt(iso, lang) {
  try {
    return new Date(iso).toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

function senderLabel(senderType, t) {
  if (senderType === "patient") return t.youLabel;
  if (senderType === "practice") return t.practiceLabel;
  return t.systemLabel;
}

export default function PatientThreadDetailPage() {
  const { threadId } = useParams();
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).patientThreads || getMessages("en").patientThreads,
    [language],
  );

  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPatientThread(threadId);
      if (res.status === 404 && data.error === "feature_disabled") {
        setThread(null);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok || !data.thread) throw new Error("load_failed");
      setThread(data.thread);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setThread(null);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [threadId, t.featureDisabled, t.loadError]);

  useEffect(() => {
    document.title = t.detailTitle;
  }, [t.detailTitle]);

  useEffect(() => {
    load();
  }, [load]);

  const canReply = thread?.status === "open";

  const handleSend = async (e) => {
    e.preventDefault();
    if (!canReply || !reply.trim()) return;
    setBusy(true);
    setSendError("");
    try {
      const { res, data } = await sendPatientThreadMessage(threadId, reply.trim());
      if (res.status === 403 && data.error === "consent_required") {
        setSendError(t.consentRequired);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("send_failed");
      setReply("");
      setThread(data.thread);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setSendError(t.sendError);
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    setBusy(true);
    try {
      const { res, data } = await archivePatientThread(threadId);
      if (res.ok && data.ok) setThread(data.thread);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="patient-threads">
        <p className="patient-inbox__muted">{t.loading}</p>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="patient-threads">
        <Link className="patient-inbox__back" to="/patient/threads">
          {t.backList}
        </Link>
        <p className="patient-inbox__error" role="alert">
          {error || t.loadError}
        </p>
      </div>
    );
  }

  const title = thread.subject?.trim() || t.noSubject;

  return (
    <div className="patient-threads">
      <Link className="patient-inbox__back" to="/patient/threads">
        {t.backList}
      </Link>
      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{title}</h1>
        {thread.practice?.practiceName ? (
          <p className="patient-inbox__intro">{thread.practice.practiceName}</p>
        ) : null}
        {thread.status === "closed" ? (
          <p className="patient-inbox__safety" role="status">
            {t.threadClosed}
          </p>
        ) : null}
        {thread.status === "archived" ? (
          <p className="patient-inbox__safety" role="status">
            {t.threadArchived}
          </p>
        ) : null}
      </header>

      <div
        className="patient-threads__messages"
        role="log"
        aria-live="polite"
        aria-label={t.detailTitle}
      >
        {(thread.messages || []).map((msg) => (
          <div
            key={msg.id}
            className={`patient-threads__bubble patient-threads__bubble--${msg.senderType === "patient" ? "patient" : "practice"}`}
          >
            {msg.body}
            <span className="patient-threads__bubble-meta">
              {senderLabel(msg.senderType, t)} · {fmt(msg.createdAt, language)}
            </span>
          </div>
        ))}
      </div>

      {canReply ? (
        <form className="patient-threads__compose" onSubmit={handleSend}>
          <label htmlFor="patient-thread-reply">{t.replyLabel}</label>
          <textarea
            id="patient-thread-reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={t.replyPlaceholder}
            disabled={busy}
          />
          {sendError ? (
            <p className="patient-inbox__error" role="alert">
              {sendError}
            </p>
          ) : null}
          <div className="patient-threads__actions">
            <button
              type="submit"
              className="patient-threads__btn patient-threads__btn--primary"
              disabled={busy || !reply.trim()}
            >
              {t.send}
            </button>
          </div>
        </form>
      ) : null}

      {thread.status !== "archived" ? (
        <div className="patient-threads__actions">
          <button
            type="button"
            className="patient-threads__btn patient-threads__btn--secondary"
            onClick={handleArchive}
            disabled={busy}
          >
            {t.archive}
          </button>
        </div>
      ) : null}
    </div>
  );
}
