import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  archivePatientInboxItem,
  fetchPatientInbox,
  markPatientInboxRead,
  postPatientInboxAiSummary,
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

function isSafeInternalUrl(url) {
  if (!url || typeof url !== "string") return false;
  const v = url.trim();
  return v.startsWith("/") && !v.startsWith("//");
}

const TYPE_FILTERS = [
  { id: "all", type: "" },
  { id: "unread", status: "unread" },
  { id: "message", type: "message" },
  { id: "document", type: "document" },
  { id: "medication", type: "medication" },
  { id: "data_request", type: "data_request" },
  { id: "profile", type: "profile" },
  { id: "system", type: "system" },
];

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
  const [filterId, setFilterId] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const filterLabel = useCallback(
    (id) => {
      const map = {
        all: t.filterAll,
        unread: t.filterUnread,
        message: t.filterMessages,
        document: t.filterDocuments,
        medication: t.filterMedication,
        data_request: t.filterDataRequests,
        profile: t.filterProfile,
        system: t.filterSystem,
      };
      return map[id] || id;
    },
    [t],
  );

  const resolveTitle = useCallback(
    (item) => {
      const key = item.titleKey || item.type;
      return t.titles?.[key] || item.title;
    },
    [t],
  );

  const statusLabel = useCallback(
    (status) => {
      const map = {
        unread: t.statusUnread,
        read: t.statusRead,
        archived: t.statusArchived,
      };
      return map[status] || status;
    },
    [t],
  );

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const f = TYPE_FILTERS.find((x) => x.id === filterId) || TYPE_FILTERS[0];
      const { res, data } = await fetchPatientInbox({
        status: showArchived ? "archived" : f.status,
        type: showArchived ? undefined : f.type || undefined,
        limit: 100,
      });
      if (res.status === 404 && data.error === "feature_disabled") {
        setItems([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("inbox_load_failed");
      let rows = Array.isArray(data.items) ? data.items : [];
      if (f.id === "unread" && !showArchived) {
        rows = rows.filter((r) => r.status === "unread");
      }
      setItems(rows);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setItems([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [filterId, showArchived, t.featureDisabled, t.loadError]);

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
          setItems((prev) => prev.map((row) => (row.id === item.id ? data.item : row)));
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

  const sourceLabel = (item) => {
    if (item.sourceLabel?.trim()) return item.sourceLabel.trim();
    if (item.practice?.practiceName) return item.practice.practiceName;
    return t.sourceUnknown;
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

      <div className="patient-inbox__toolbar" role="toolbar" aria-label={t.filterAll}>
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`patient-inbox__filter-btn${filterId === f.id && !showArchived ? " patient-inbox__filter-btn--active" : ""}`}
            aria-pressed={filterId === f.id && !showArchived}
            onClick={() => {
              setShowArchived(false);
              setFilterId(f.id);
            }}
          >
            {filterLabel(f.id)}
          </button>
        ))}
        <button
          type="button"
          className={`patient-inbox__toggle${showArchived ? " patient-inbox__filter-btn--active" : ""}`}
          onClick={() => setShowArchived((v) => !v)}
          aria-pressed={showArchived}
        >
          {showArchived ? t.hideArchived : t.showArchived}
        </button>
      </div>

      <section className="patient-inbox__ai-block" aria-labelledby="patient-inbox-ai-heading">
        <h2 id="patient-inbox-ai-heading" className="patient-inbox__ai-heading">
          {t.aiHeading}
        </h2>
        <p className="patient-inbox__muted">{t.aiDisclaimer}</p>
        <button
          type="button"
          className="patient-inbox__btn patient-inbox__btn--primary"
          disabled={aiBusy}
          onClick={async () => {
            setAiBusy(true);
            setAiSummary("");
            try {
              const { res, data } = await postPatientInboxAiSummary(language);
              if (!res.ok || !data.ok) throw new Error("ai_failed");
              setAiSummary(data.summary || "");
            } catch {
              setAiSummary(t.aiError);
            } finally {
              setAiBusy(false);
            }
          }}
        >
          {aiBusy ? t.aiLoading : t.aiRun}
        </button>
        {aiSummary ? (
          <article className="patient-inbox__ai" aria-live="polite">
            <p className="patient-inbox__ai-label">{t.aiSuggestionLabel}</p>
            <pre className="patient-inbox__ai-pre">{aiSummary}</pre>
          </article>
        ) : null}
      </section>

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
            const title = resolveTitle(item);
            const statusText = statusLabel(item.status);
            const statusAria = t.statusAria.replace("{status}", statusText);
            const canOpen = Boolean(item.targetUrl && isSafeInternalUrl(item.targetUrl));
            const isBusy = busyId === item.id;

            return (
              <li key={item.id} className="patient-inbox__item">
                <div className="patient-inbox__item-top">
                  <h2 className="patient-inbox__item-title">{title}</h2>
                  <span
                    className={`patient-inbox__status patient-inbox__status--${item.status}`}
                    aria-label={statusAria}
                  >
                    {statusText}
                  </span>
                </div>
                <p className="patient-inbox__meta">
                  {t.colSource}: {sourceLabel(item)}
                </p>
                <p className="patient-inbox__meta">
                  {t.colDate}: {fmt(item.createdAt, language)}
                </p>
                <div className="patient-inbox__actions">
                  {canOpen ? (
                    <button
                      type="button"
                      className="patient-inbox__btn patient-inbox__btn--primary"
                      onClick={() => void handleOpen(item)}
                      disabled={isBusy}
                    >
                      {t.open}
                    </button>
                  ) : null}
                  {item.status !== "archived" ? (
                    <button
                      type="button"
                      className="patient-inbox__btn patient-inbox__btn--secondary"
                      onClick={() => void handleArchive(item.id)}
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
