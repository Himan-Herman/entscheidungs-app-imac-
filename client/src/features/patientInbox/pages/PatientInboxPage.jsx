import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  archivePatientInboxItem,
  fetchPatientInbox,
  markPatientInboxRead,
} from "../api/patientInboxApi.js";
import "../../../styles/PatientInboxPage.css";

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

function statusLabel(status, t) {
  const map = {
    unread: t.statusUnread,
    read: t.statusRead,
    archived: t.statusArchived,
  };
  return map[status] || status;
}

function sourceLabel(item, t) {
  if (item.sourceLabel?.trim()) return item.sourceLabel.trim();
  if (item.practice?.practiceName) return item.practice.practiceName;
  return t.sourceUnknown;
}

function isSafeInternalUrl(url) {
  if (!url || typeof url !== "string") return false;
  const v = url.trim();
  return v.startsWith("/") && !v.startsWith("//");
}

export default function PatientInboxPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).patientInbox || getMessages("en").patientInbox,
    [language],
  );

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState("");

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPatientInbox({
        status: showArchived ? "archived" : undefined,
        limit: 100,
      });
      if (res.status === 404 && data.error === "feature_disabled") {
        setItems([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("inbox_load_failed");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setItems([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [showArchived, t.featureDisabled, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const handleOpen = async (item) => {
    setBusyId(item.id);
    try {
      if (item.status === "unread") {
        const { res, data } = await markPatientInboxRead(item.id);
        if (res.ok && data.ok) {
          setItems((prev) =>
            prev.map((row) => (row.id === item.id ? data.item : row)),
          );
        }
      }
      if (item.targetUrl && isSafeInternalUrl(item.targetUrl)) {
        navigate(item.targetUrl);
      }
    } finally {
      setBusyId("");
    }
  };

  const handleArchive = async (itemId) => {
    setBusyId(itemId);
    try {
      const { res, data } = await archivePatientInboxItem(itemId);
      if (!res.ok || !data.ok) return;
      if (showArchived) {
        setItems((prev) => prev.map((row) => (row.id === itemId ? data.item : row)));
      } else {
        setItems((prev) => prev.filter((row) => row.id !== itemId));
      }
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="patient-inbox">
      <Link className="patient-inbox__back" to="/patient">
        {t.backHub}
      </Link>

      <header className="patient-inbox__header">
        <h1 className="patient-inbox__title">{t.heading}</h1>
        <p className="patient-inbox__intro">{t.intro}</p>
        <p className="patient-inbox__safety">{t.safetyNote}</p>
      </header>

      <div className="patient-inbox__toolbar">
        <button
          type="button"
          className="patient-inbox__toggle"
          onClick={() => setShowArchived((v) => !v)}
          aria-pressed={showArchived}
        >
          {showArchived ? t.hideArchived : t.showArchived}
        </button>
      </div>

      {loading ? <p className="patient-inbox__muted">{t.loading}</p> : null}
      {error ? (
        <p className="patient-inbox__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="patient-inbox__muted">{t.empty}</p>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <ul className="patient-inbox__list" aria-label={t.listCaption}>
          {items.map((item) => {
            const statusText = statusLabel(item.status, t);
            const statusAria = t.statusAria.replace("{status}", statusText);
            const canOpen = Boolean(item.targetUrl && isSafeInternalUrl(item.targetUrl));
            const isBusy = busyId === item.id;

            return (
              <li key={item.id} className="patient-inbox__item">
                <div className="patient-inbox__item-top">
                  <h2 className="patient-inbox__item-title">{item.title}</h2>
                  <span
                    className={`patient-inbox__status patient-inbox__status--${item.status}`}
                    aria-label={statusAria}
                  >
                    {statusText}
                  </span>
                </div>
                <p className="patient-inbox__meta">
                  {t.colSource}: {sourceLabel(item, t)}
                </p>
                <p className="patient-inbox__meta">
                  {t.colDate}: {fmt(item.createdAt, language)}
                </p>
                {item.summary ? (
                  <p className="patient-inbox__summary">{item.summary}</p>
                ) : null}
                <div className="patient-inbox__actions">
                  {canOpen ? (
                    <button
                      type="button"
                      className="patient-inbox__btn patient-inbox__btn--primary"
                      onClick={() => handleOpen(item)}
                      disabled={isBusy}
                    >
                      {t.open}
                    </button>
                  ) : null}
                  {item.status !== "archived" ? (
                    <button
                      type="button"
                      className="patient-inbox__btn patient-inbox__btn--secondary"
                      onClick={() => handleArchive(item.id)}
                      disabled={isBusy}
                    >
                      {t.archive}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
