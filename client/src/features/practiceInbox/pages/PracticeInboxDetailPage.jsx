import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';
import {
  fetchPracticeInboxItem,
  patchPracticeInboxArchive,
  patchPracticeInboxDone,
  patchPracticeInboxRead,
  postPracticeInboxAiReplyDraft,
  postPracticeInboxAiSummary,
} from "../api/practiceInboxApi.js";
import { safeInternalPath } from "../../../lib/safeNavigation.js";
import { notifyUnreadChanged } from "../../../lib/notificationSignal.js";
import "../../../styles/PracticeDashboardPage.css";
import "../../../styles/PracticePatientsPage.css";
import "../../../styles/PatientInboxPage.css";

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

function patientName(item, fallback) {
  const p = item?.patient;
  if (!p) return fallback;
  return (
    p.displayName?.trim() ||
    [p.firstName, p.lastName].filter(Boolean).join(" ") ||
    fallback
  );
}

export default function PracticeInboxDetailPage() {
  const { itemId } = useParams();
  const [searchParams] = useSearchParams();
  const practiceId = searchParams.get("practiceId") || "";
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceInbox || getMessages("en").practiceInbox,
    [language],
  );

  const [item, setItem] = useState(null);
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const listPath = practiceId
    ? `/practice/inbox?practiceId=${encodeURIComponent(practiceId)}`
    : "/practice/inbox";

  const load = useCallback(async () => {
    if (!itemId || !practiceId) {
      setLoading(false);
      setError(t.detailLoadError);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticeInboxItem(itemId, practiceId);
      if (!res.ok || !data.ok || !data.item) throw new Error("load_failed");
      setItem(data.item);
      setContext(data.context || null);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setItem(null);
      setError(t.detailLoadError);
    } finally {
      setLoading(false);
    }
  }, [itemId, practiceId, t.detailLoadError]);

  useEffect(() => {
    document.title = t.detailPageTitle;
  }, [t.detailPageTitle]);

  useEffect(() => {
    load();
  }, [load]);

  /*
   * Opening the item is what marks it read.
   *
   * Reaching this page means the user clicked "Öffnen" on one specific notice —
   * merely visiting the inbox list leaves everything unread, which is the
   * behaviour we want and already had. What was missing is this half: the list
   * link navigated here and nothing ever recorded that the item had been
   * looked at, so the header badge kept showing a count that no longer matched
   * what the user had seen.
   *
   * `new` only. The server is idempotent either way, but there is no reason to
   * send a request for an item that is already read, done or archived — and
   * archived items are refused there, which would surface as a pointless
   * error.
   */
  useEffect(() => {
    if (!item || item.status !== "new" || !itemId || !practiceId) return;

    let cancelled = false;
    (async () => {
      try {
        const { res, data } = await patchPracticeInboxRead(itemId, practiceId);
        if (cancelled) return;
        if (!res.ok || !data?.ok || !data.item) {
          // Not marked read, so the badge is still telling the truth. Nothing
          // is claimed here that the server did not confirm; the user can
          // still use the explicit "mark read" control.
          return;
        }
        setItem(data.item);
        // Confirmed by the server, so the count really has moved.
        notifyUnreadChanged();
      } catch (err) {
        if (err?.message === "SESSION_EXPIRED") return;
        // Deliberately not surfaced: the page loaded and shows the notice,
        // which is what the user asked for. Swallowing it silently would be
        // wrong, so it is at least visible to a developer.
        console.warn("[practice-inbox] could not mark item read:", err?.message ?? err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item, itemId, practiceId]);

  async function runAction(fn) {
    setBusy(true);
    setStatusMsg("");
    try {
      const { res, data } = await fn();
      if (!res.ok || !data.ok) {
        setStatusMsg(t.actionError);
        return;
      }
      if (data.item) setItem(data.item);
      // Marking read, done or archived all change how many notices are still
      // unread, and the badge is fetched, not computed here — so it is told to
      // ask again rather than being handed a number by a second writer.
      notifyUnreadChanged();
      setStatusMsg(t.actionSuccess);
    } finally {
      setBusy(false);
    }
  }

  async function runAi(mode) {
    setAiLoading(true);
    setAiError("");
    setAiText("");
    try {
      const call =
        mode === "summary" ? postPracticeInboxAiSummary : postPracticeInboxAiReplyDraft;
      const { res, data } = await call(itemId, practiceId, language);
      if (res.status === 503 && data.error === "ai_not_configured") {
        setAiError(t.aiNotConfigured);
        return;
      }
      if (!res.ok || !data.ok) {
        setAiError(t.aiError);
        return;
      }
      setAiText(data.text || "");
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="practice-dashboard">
        <p className="practice-dashboard__muted">{t.loading}</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="practice-dashboard">
        <Link className="practice-dashboard__back" to={listPath}>
          {t.backList}
        </Link>
        <p className="practice-dashboard__error" role="alert">
          {error || t.detailLoadError}
        </p>
      </div>
    );
  }

  const recordPath =
    item.practicePatientLinkId && practiceId
      ? `/practice/patients/${encodeURIComponent(item.practicePatientLinkId)}?practiceId=${encodeURIComponent(practiceId)}`
      : null;

  const messages = context?.thread?.messages || context?.followUp?.messages || [];

  return (
    <div className="practice-dashboard practice-patients patient-inbox">
      <div className="practice-dashboard__inner">
        <Link className="practice-dashboard__back" to={listPath}>
          {t.backList}
        </Link>

        <header className="practice-dashboard__header">
          <h1 className="practice-dashboard__title">{item.title}</h1>
          <p className="practice-dashboard__intro">
            {patientName(item, t.patientFallback)} · {fmt(item.lastActivityAt, language)}
          </p>
          {item.summary ? (
            <p className="practice-dashboard__muted">{item.summary}</p>
          ) : null}
        </header>

        {statusMsg ? (
          <p className="practice-dashboard__muted" role="status">
            {statusMsg}
          </p>
        ) : null}

        <section className="practice-dashboard__card" aria-labelledby="ctx-heading">
          <h2 id="ctx-heading" className="practice-dashboard__analytics-heading">
            {t.contextHeading}
          </h2>
          <dl className="practice-patients__detail-dl">
            <div className="practice-patients__detail-row">
              <dt>{t.colPatient}</dt>
              <dd>{patientName(item, t.patientFallback)}</dd>
            </div>
            <div className="practice-patients__detail-row">
              <dt>{t.colType}</dt>
              <dd>{item.type}</dd>
            </div>
            <div className="practice-patients__detail-row">
              <dt>{t.colCreated}</dt>
              <dd>{fmt(item.createdAt, language)}</dd>
            </div>
          </dl>
        </section>

        {messages.length > 0 ? (
          <section className="practice-dashboard__card" aria-labelledby="content-heading">
            <h2 id="content-heading" className="practice-dashboard__analytics-heading">
              {t.contentHeading}
            </h2>
            <ul className="practice-record__activity-list">
              {messages.map((m) => (
                <li key={m.id} className="practice-record__activity-item">
                  <span>{m.senderType}</span>
                  <time dateTime={m.createdAt}>{fmt(m.createdAt, language)}</time>
                  <p style={{ flex: "1 1 100%", margin: "0.35rem 0 0" }}>{m.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <nav className="practice-record__quick-links" aria-label={t.contextHeading}>
          {item.status !== "read" && item.status !== "done" && item.status !== "archived" ? (
            <button
              type="button"
              className="practice-dashboard__link-btn"
              disabled={busy}
              onClick={() => runAction(() => patchPracticeInboxRead(itemId, practiceId))}
            >
              {t.markRead}
            </button>
          ) : null}
          {item.status !== "done" && item.status !== "archived" ? (
            <button
              type="button"
              className="practice-dashboard__link-btn"
              disabled={busy}
              onClick={() => runAction(() => patchPracticeInboxDone(itemId, practiceId))}
            >
              {t.markDone}
            </button>
          ) : null}
          {item.status !== "archived" ? (
            <button
              type="button"
              className="practice-dashboard__link-btn"
              disabled={busy}
              onClick={() => runAction(() => patchPracticeInboxArchive(itemId, practiceId))}
            >
              {t.archive}
            </button>
          ) : null}
          {recordPath ? (
            <Link className="practice-dashboard__link-btn" to={recordPath}>
              {t.openRecord}
            </Link>
          ) : null}
          {safeInternalPath(item.targetUrl) ? (
            <Link className="practice-dashboard__link-btn" to={item.targetUrl}>
              {item.type === "message" ? t.replyInMessages : t.openTarget}
            </Link>
          ) : null}
        </nav>

        <section className="practice-dashboard__card" aria-labelledby="ai-heading">
          <h2 id="ai-heading" className="practice-dashboard__analytics-heading">
            {t.aiHeading}
          </h2>
          <p className="practice-record__patient-hint" role="note">
            {t.aiDisclaimer}
          </p>
          <div className="practice-record__quick-links">
            <button
              type="button"
              className="practice-dashboard__link-btn"
              disabled={aiLoading}
              onClick={() => runAi("summary")}
            >
              {t.aiSummaryBtn}
            </button>
            {(item.type === "message" || item.type === "follow_up") && (
              <button
                type="button"
                className="practice-dashboard__link-btn"
                disabled={aiLoading}
                onClick={() => runAi("reply")}
              >
                {t.aiReplyBtn}
              </button>
            )}
          </div>
          {aiLoading ? <p className="practice-dashboard__muted">{t.aiLoading}</p> : null}
          {aiError ? (
            <p className="practice-dashboard__error" role="alert">
              {aiError}
            </p>
          ) : null}
          {aiText ? (
            <div className="practice-record__alert" role="region" aria-label={t.aiSuggestionLabel}>
              <strong>{t.aiSuggestionLabel}</strong>
              <p style={{ margin: "0.5rem 0 0", whiteSpace: "pre-wrap" }}>{aiText}</p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
