import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { authFetch } from "../../../api/authFetch.js";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome.jsx";
import "../styles/PreVisitFollowUpsPage.css";

function fmt(iso, lang) {
  try {
    return new Date(iso).toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default function PreVisitFollowUpThreadPage() {
  const { threadId } = useParams();
  const { language } = useLanguage();
  const t = useMemo(() => getMessages(language).preVisit.followUps, [language]);
  const [row, setRow] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");

  const load = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`/api/previsit/follow-ups/${encodeURIComponent(threadId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setRow(data.thread || null);
    } catch (e) {
      if (e?.message !== "SESSION_EXPIRED") setError(t.threadLoadError);
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [t.threadLoadError, threadId]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!threadId || !text.trim()) return;
    setSendError("");
    try {
      const res = await authFetch(`/api/previsit/follow-ups/${encodeURIComponent(threadId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("send_failed");
      setText("");
      await load();
    } catch (e) {
      if (e?.message !== "SESSION_EXPIRED") setSendError(t.threadSendError);
    }
  }

  const senderLabel = (v) => {
    if (v === "practice") return t.senderPractice;
    if (v === "patient") return t.senderPatient;
    return t.senderSystem;
  };

  return (
    <div className="previsit-followups">
      <div className="previsit-followups__inner">
        <PreVisitModuleChrome />
        <Link className="previsit-followups__back-link" to="/pre-visit/follow-ups">
          {t.threadBack}
        </Link>
        <h1 className="previsit-followups__title">{t.title}</h1>
        <p className="previsit-followups__safety">{t.safetyNote}</p>
        {loading ? (
          <p className="previsit-followups__status" role="status" aria-live="polite">
            {t.loading}
          </p>
        ) : null}
        {error ? (
          <p className="previsit-followups__error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && row ? (
          <>
            <p className="previsit-followups__lead"><strong>{t.practiceLabel}:</strong> {row.practice?.practiceName || "—"}</p>
            <p className="previsit-followups__lead"><strong>{t.relatedPreparation}:</strong> {row.session?.title || "—"}</p>
            <div className="previsit-followups__thread">
              {Array.isArray(row.messages) && row.messages.length > 0 ? row.messages.map((m) => (
                <article key={m.id} className="previsit-followups__message">
                  <p>
                    <strong>{senderLabel(m.senderType)}</strong> · {fmt(m.createdAt, language)}
                  </p>
                  <p>{m.body}</p>
                </article>
              )) : <p className="previsit-followups__lead">{t.threadEmpty}</p>}
            </div>
            <label className="previsit-followups__label" htmlFor="followup-reply-textarea">
              {t.threadPlaceholder}
            </label>
            <textarea
              id="followup-reply-textarea"
              className="previsit-followups__textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.threadPlaceholder}
              rows={5}
              autoComplete="off"
            />
            {sendError ? (
              <p className="previsit-followups__error" role="alert">
                {sendError}
              </p>
            ) : null}
            <button
              type="button"
              className="previsit-followups__btn-primary"
              onClick={() => void send()}
            >
              {t.threadSend}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
