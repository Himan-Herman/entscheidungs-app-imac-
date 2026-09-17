import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePracticeContext } from "../usePracticeContext.js";
import { useScopedRequest } from "../hooks/useScopedRequest.js";
import {
  archiveScopedInboxItem,
  fetchScopedInbox,
  markScopedInboxRead,
  restoreScopedInboxItem,
} from "../api/scopedInboxApi.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
// The stylesheet the cross-practice inbox already uses — this is a context
// migration of that list, not a new inbox design.
import "../../../styles/PatientInboxPage.css";

/**
 * Inbox notices of one care relationship (Phase 2G.1).
 *
 * Shows the notices belonging to THIS relationship and nothing else — not
 * another practice's, not those of a second relationship with the same
 * practice, and not the ones that name a practice but no relationship at all.
 * That last group stays in the cross-practice inbox on purpose: a notice shown
 * under the wrong relationship is worse than one the patient has to look for.
 *
 * Destinations come from the server, built from the authorized link. The
 * notices' stored `targetUrl` values predate practice contexts and point at
 * patient-global paths, so they are never used here.
 *
 * Reading the list changes nothing: acknowledgement is explicit, which is how
 * the inbox has always worked.
 */
export default function PracticeContextInboxPage() {
  const { linkId, isActiveRelationship } = usePracticeContext();
  const { run } = useScopedRequest(linkId);
  const { language } = useLanguage();
  const t = getMessages(language).patientInbox || getMessages("en").patientInbox;
  const tc = getMessages(language).practiceContext || getMessages("en").practiceContext;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const outcome = await run(
        ({ signal }) =>
          fetchScopedInbox(linkId, { status: showArchived ? "archived" : undefined, signal }),
        ({ res, data }) => {
          if (!res.ok || !data.ok) {
            setItems([]);
            setError(res.status === 404 ? tc.notFoundBody : t.loadError);
            return;
          }
          setItems(Array.isArray(data.items) ? data.items : []);
        },
      );
      if (!outcome.applied) return;
    } catch {
      setItems([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [linkId, run, showArchived, t.loadError, tc.notFoundBody]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Every mutation goes through the scoped runner and replaces only the item it
   * returned. No optimistic state: the list is small, the round trip is short,
   * and a state that has to be undone on failure is a state that can survive a
   * context switch.
   */
  const mutate = async (itemId, work) => {
    setBusyId(itemId);
    setError("");
    try {
      await run(work, ({ res, data }) => {
        if (!res.ok || !data.ok) {
          setError(t.loadError);
          load();
          return;
        }
        if (showArchived || data.item.status === "archived") {
          load();
          return;
        }
        setItems((prev) => prev.map((i) => (i.id === data.item.id ? { ...i, ...data.item } : i)));
      });
    } catch {
      setError(t.loadError);
    } finally {
      setBusyId("");
    }
  };

  const title = (item) => t.titles?.[item.titleKey || item.type] || item.title;
  const statusText = (status) =>
    ({ unread: t.statusUnread, read: t.statusRead, archived: t.statusArchived })[status] ||
    t.notAvailable;

  const fmt = (iso) => {
    if (!iso) return t.notAvailable;
    try {
      return new Date(iso).toLocaleDateString(getPrimaryIntlLocale(language), {
        dateStyle: "medium",
      });
    } catch {
      return t.notAvailable;
    }
  };

  return (
    <div className="practice-context patient-inbox">
      <h1 className="practice-context__title">{tc.inboxTitle}</h1>
      <p className="patient-inbox__intro">{tc.inboxScopeNote}</p>

      <div className="patient-inbox__toolbar" role="toolbar" aria-label={t.filterToolbarAria}>
        <button
          type="button"
          className="patient-inbox__btn"
          aria-pressed={showArchived}
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? t.hideArchived : t.showArchived}
        </button>
      </div>

      {loading ? (
        <p className="practice-context__state" role="status" aria-live="polite">
          {t.loading}
        </p>
      ) : null}

      {error ? (
        <p className="practice-context__state" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="practice-context__state">{tc.inboxEmpty}</p>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="patient-inbox__list" aria-label={t.listCaption} data-testid="scoped-inbox-list">
          {items.map((item) => (
            <li key={item.id} className="patient-inbox__item">
              <div className="patient-inbox__item-top">
                <h2 className="patient-inbox__item-title">{title(item)}</h2>
                {/* Status is a word, never only a colour. */}
                <span
                  className={`patient-inbox__status patient-inbox__status--${item.status}`}
                  aria-label={t.statusAria.replace("{status}", statusText(item.status))}
                >
                  {statusText(item.status)}
                </span>
              </div>
              {item.summary ? <p className="patient-inbox__meta">{item.summary}</p> : null}
              <p className="patient-inbox__meta">
                {t.colDate}: {fmt(item.createdAt)}
              </p>

              <div className="patient-inbox__actions">
                {/*
                  The destination is the one the server built from THIS link, so
                  a notice can never lead into another practice's context.
                */}
                {item.targetPath ? (
                  <Link
                    className="patient-inbox__btn patient-inbox__btn--primary"
                    to={item.targetPath}
                    data-testid="scoped-inbox-open"
                  >
                    {t.open}
                  </Link>
                ) : null}

                {isActiveRelationship && item.status === "unread" ? (
                  <button
                    type="button"
                    className="patient-inbox__btn"
                    disabled={busyId === item.id}
                    onClick={() =>
                      mutate(item.id, ({ signal }) => markScopedInboxRead(linkId, item.id, { signal }))
                    }
                  >
                    {t.statusRead}
                  </button>
                ) : null}

                {isActiveRelationship && item.status !== "archived" ? (
                  <button
                    type="button"
                    className="patient-inbox__btn"
                    disabled={busyId === item.id}
                    onClick={() =>
                      mutate(item.id, ({ signal }) => archiveScopedInboxItem(linkId, item.id, { signal }))
                    }
                  >
                    {t.archive}
                  </button>
                ) : null}

                {isActiveRelationship && item.status === "archived" ? (
                  <button
                    type="button"
                    className="patient-inbox__btn"
                    disabled={busyId === item.id}
                    onClick={() =>
                      mutate(item.id, ({ signal }) => restoreScopedInboxItem(linkId, item.id, { signal }))
                    }
                  >
                    {tc.inboxRestore}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="patient-inbox__safety">{t.safetyNote}</p>
    </div>
  );
}
