import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';
import {
  archivePracticeThread,
  closePracticeThread,
  createPracticeThread,
  fetchPracticeThread,
  fetchPracticeThreads,
  fetchPracticeThreadAiDraft,
  sendPracticeThreadMessage,
} from "../api/practiceThreadsApi.js";
import "../../../styles/PatientThreadsPage.css";

function fmt(iso, lang) {
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

function statusLabel(status, t) {
  const map = {
    open: t.statusOpen,
    closed: t.statusClosed,
    archived: t.statusArchived,
  };
  return map[status] || status;
}

/**
 * @param {{ linkId: string, practiceId: string }} props
 */
export default function PracticePatientMessagesSection({
  linkId,
  practiceId,
  readOnly = false,
}) {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceMessages || getMessages("en").practiceMessages,
    [language],
  );

  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [activeThread, setActiveThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiHintVisible, setAiHintVisible] = useState(false);

  const loadList = useCallback(async () => {
    if (!linkId || !practiceId) return;
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticeThreads(linkId, practiceId);
      if (res.status === 404 && data.error === "feature_disabled") {
        setThreads([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setThreads(Array.isArray(data.threads) ? data.threads : []);
    } catch {
      setThreads([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [linkId, practiceId, t.featureDisabled, t.loadError]);

  const loadThread = useCallback(
    async (threadId) => {
      if (!threadId) {
        setActiveThread(null);
        return;
      }
      setBusy(true);
      try {
        const { res, data } = await fetchPracticeThread(linkId, practiceId, threadId);
        if (res.ok && data.ok) setActiveThread(data.thread);
      } finally {
        setBusy(false);
      }
    },
    [linkId, practiceId],
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (activeId) loadThread(activeId);
    else setActiveThread(null);
  }, [activeId, loadThread]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newBody.trim()) return;
    setBusy(true);
    try {
      const { res, data } = await createPracticeThread(linkId, practiceId, {
        subject: subject.trim() || undefined,
        body: newBody.trim(),
      });
      if (!res.ok || !data.ok) {
        setError(t.createError);
        return;
      }
      setSubject("");
      setNewBody("");
      await loadList();
      setActiveId(data.thread.id);
    } finally {
      setBusy(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!activeId || !reply.trim()) return;
    setBusy(true);
    try {
      const { res, data } = await sendPracticeThreadMessage(
        linkId,
        practiceId,
        activeId,
        reply.trim(),
      );
      if (!res.ok || !data.ok) {
        setError(t.sendError);
        return;
      }
      setReply("");
      setActiveThread(data.thread);
      await loadList();
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (!activeId) return;
    setBusy(true);
    try {
      const { res, data } = await closePracticeThread(linkId, practiceId, activeId);
      if (res.ok && data.ok) {
        setActiveThread(data.thread);
        await loadList();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAiDraft = async () => {
    if (!activeId) return;
    setAiBusy(true);
    setError("");
    try {
      const { res, data } = await fetchPracticeThreadAiDraft(
        linkId,
        practiceId,
        activeId,
        { locale: language, draftInput: reply.trim() || undefined },
      );
      if (res.status === 503 && data.error === "ai_not_configured") {
        setError(t.aiNotConfigured);
        return;
      }
      if (!res.ok || !data.ok || !data.text) {
        setError(t.aiError);
        return;
      }
      setReply(data.text);
      setAiHintVisible(true);
    } finally {
      setAiBusy(false);
    }
  };

  const handleArchive = async () => {
    if (!activeId) return;
    setBusy(true);
    try {
      const { res, data } = await archivePracticeThread(linkId, practiceId, activeId);
      if (res.ok && data.ok) {
        setActiveThread(data.thread);
        await loadList();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="practice-dashboard__card practice-messages"
      aria-labelledby="practice-messages-heading"
    >
      <h2 id="practice-messages-heading" className="practice-dashboard__analytics-heading">
        {t.sectionTitle}
      </h2>
      <p className="practice-dashboard__muted">{t.sectionIntro}</p>

      {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}
      {error ? (
        <p className="practice-dashboard__error" role="alert">
          {error}
        </p>
      ) : null}

      {readOnly ? (
        <p className="practice-dashboard__muted" role="status">
          {t.viewerReadOnly}
        </p>
      ) : null}

      {!readOnly ? (
      <form className="practice-messages__new" onSubmit={handleCreate}>
        <p className="practice-dashboard__muted" style={{ fontWeight: 600 }}>
          {t.newThread}
        </p>
        <label htmlFor="practice-new-subject">{t.subjectLabel}</label>
        <input
          id="practice-new-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t.subjectPlaceholder}
          disabled={busy}
        />
        <label htmlFor="practice-new-body">{t.messageLabel}</label>
        <textarea
          id="practice-new-body"
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder={t.messagePlaceholder}
          disabled={busy}
        />
        <button
          type="submit"
          className="patient-threads__btn patient-threads__btn--primary"
          disabled={busy || !newBody.trim()}
        >
          {t.send}
        </button>
      </form>
      ) : null}

      {!loading && threads.length === 0 && !error ? (
        <p className="practice-dashboard__muted">{t.empty}</p>
      ) : null}

      {threads.length > 0 ? (
        <ul className="patient-threads__list" style={{ marginTop: "1rem" }}>
          {threads.map((th) => {
            const st = statusLabel(th.status, t);
            return (
              <li key={th.id} className="patient-threads__item">
                <button
                  type="button"
                  className="patient-threads__btn patient-threads__btn--secondary"
                  style={{ width: "100%", textAlign: "left", marginBottom: "0.35rem" }}
                  onClick={() => setActiveId(th.id)}
                  aria-pressed={activeId === th.id}
                >
                  {th.subject?.trim() || t.noSubject} · {st}
                </button>
                <span className="practice-dashboard__muted" style={{ fontSize: "0.85rem" }}>
                  {fmt(th.updatedAt, language)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {activeThread ? (
        <div className="practice-messages__thread-view">
          <div
            className="patient-threads__messages"
            role="log"
            aria-live="polite"
            aria-label={t.sectionTitle}
          >
            {(activeThread.messages || []).map((msg) => (
              <div
                key={msg.id}
                className={`patient-threads__bubble patient-threads__bubble--${msg.senderType === "patient" ? "patient" : "practice"}`}
              >
                {msg.body}
                <span className="patient-threads__bubble-meta">
                  {msg.senderType === "patient" ? t.patientSide : t.youPractice} ·{" "}
                  {fmt(msg.createdAt, language)}
                  {msg.senderType === "patient"
                    ? ` · ${msg.readAt ? t.readAt : t.notReadYet}`
                    : null}
                </span>
              </div>
            ))}
          </div>

          {activeThread.status === "open" && !readOnly ? (
            <form className="patient-threads__compose" onSubmit={handleReply}>
              {aiHintVisible ? (
                <p className="patient-inbox__safety" role="status">
                  <strong>{t.aiDraftLabel}</strong> — {t.aiDisclaimer}
                </p>
              ) : null}
              <label htmlFor="practice-reply">{t.replyLabel}</label>
              <textarea
                id="practice-reply"
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value);
                  if (aiHintVisible) setAiHintVisible(false);
                }}
                placeholder={t.messagePlaceholder}
                disabled={busy || aiBusy}
                aria-describedby={aiHintVisible ? "practice-ai-hint" : undefined}
              />
              <div className="patient-threads__actions">
                <button
                  type="button"
                  className="patient-threads__btn patient-threads__btn--secondary"
                  onClick={handleAiDraft}
                  disabled={busy || aiBusy}
                  aria-busy={aiBusy}
                >
                  {aiBusy ? t.aiBusy : t.aiReplyDraft}
                </button>
                <button
                  type="submit"
                  className="patient-threads__btn patient-threads__btn--primary"
                  disabled={busy || aiBusy || !reply.trim()}
                >
                  {t.send}
                </button>
              </div>
            </form>
          ) : null}

          {!readOnly ? (
          <div className="patient-threads__actions">
            {activeThread.status === "open" ? (
              <button
                type="button"
                className="patient-threads__btn patient-threads__btn--secondary"
                onClick={handleClose}
                disabled={busy}
              >
                {t.close}
              </button>
            ) : null}
            {activeThread.status !== "archived" ? (
              <button
                type="button"
                className="patient-threads__btn patient-threads__btn--secondary"
                onClick={handleArchive}
                disabled={busy}
              >
                {t.archive}
              </button>
            ) : null}
          </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
