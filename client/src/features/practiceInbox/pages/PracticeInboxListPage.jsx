import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { authFetch } from "../../../api/authFetch.js";
import {
  fetchPracticeInbox,
  postPracticeInboxListAiSummary,
} from "../api/practiceInboxApi.js";
import "../../../styles/PracticeDashboardPage.css";
import "../../../styles/PracticePatientsPage.css";
import "../../../styles/PatientInboxPage.css";

function fmt(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function patientName(item, fallback) {
  const p = item.patient;
  if (!p) return fallback;
  return (
    p.displayName?.trim() ||
    [p.firstName, p.lastName].filter(Boolean).join(" ") ||
    fallback
  );
}

function statusLabel(status, t) {
  const map = {
    new: t.statusNew,
    read: t.statusRead,
    done: t.statusDone,
    archived: t.statusArchived,
  };
  return map[status] || status;
}

function priorityLabel(priority, t) {
  return priority === "important" ? t.priorityImportant : t.priorityNormal;
}

function typeLabel(type, t) {
  const map = {
    message: t.typeMessage,
    previsit: t.typePrevisit,
    follow_up: t.typeFollowUp,
    document: t.typeDocument,
    medication: t.typeMedication,
    data_request: t.typeDataRequest,
    profile: t.typeProfile,
    system: t.typeSystem,
  };
  return map[type] || type;
}

const FILTER_TYPE_MAP = {
  message: "message",
  previsit: "previsit",
  document: "document",
  medication: "medication",
  data_request: "data_request",
  profile: "profile",
};

export default function PracticeInboxListPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceInbox || getMessages("en").practiceInbox,
    [language],
  );
  const [searchParams, setSearchParams] = useSearchParams();

  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("activity");
  const [aiSummary, setAiSummary] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("load_practices_failed");
    const rows = Array.isArray(data.practices) ? data.practices : [];
    setPractices(rows);
    if (!practiceId && rows.length > 0) setPracticeId(rows[0].id);
  }, [practiceId]);

  const loadInbox = useCallback(async () => {
    if (!practiceId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      let apiFilter;
      let apiType;
      if (filter === "archived") apiFilter = "archived";
      else if (filter === "unread") apiFilter = "unread";
      else if (FILTER_TYPE_MAP[filter]) apiType = FILTER_TYPE_MAP[filter];

      const { res, data } = await fetchPracticeInbox(practiceId, {
        filter: apiFilter,
        type: apiType,
        q: search.trim() || undefined,
        sort: sortBy,
        limit: 200,
      });
      if (res.status === 404 && data.error === "feature_disabled") {
        setItems([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("load_failed");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setItems([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, filter, search, sortBy, t.featureDisabled, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    loadPractices().catch(() => setPractices([]));
  }, [loadPractices]);

  useEffect(() => {
    if (practiceId && searchParams.get("practiceId") !== practiceId) {
      const next = new URLSearchParams(searchParams);
      next.set("practiceId", practiceId);
      setSearchParams(next, { replace: true });
    }
  }, [practiceId, searchParams, setSearchParams]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const detailPath = (id) =>
    `/practice/inbox/${encodeURIComponent(id)}?practiceId=${encodeURIComponent(practiceId)}`;

  const renderRow = (item) => {
    const name = patientName(item, t.patientFallback);
    const st = statusLabel(item.status, t);
    const pr = priorityLabel(item.priority, t);

    return (
      <tr key={item.id}>
        <td>{name}</td>
        <td>{typeLabel(item.type, t)}</td>
        <td>{item.title}</td>
        <td>
          <span
            className={`practice-patients__status practice-patients__status--${item.status === "new" ? "invited" : item.status === "done" ? "active" : "archived"}`}
            aria-label={t.statusAria.replace("{status}", st)}
          >
            {st}
          </span>
        </td>
        <td>
          <span aria-label={t.priorityAria.replace("{priority}", pr)}>{pr}</span>
        </td>
        <td>{fmt(item.lastActivityAt, language)}</td>
        <td>
          <Link className="practice-dashboard__link-btn" to={detailPath(item.id)}>
            {t.openItem}
          </Link>
        </td>
      </tr>
    );
  };

  const renderCard = (item) => {
    const name = patientName(item, t.patientFallback);
    const st = statusLabel(item.status, t);

    return (
      <article key={item.id} className="practice-patients__card-item">
        <div className="practice-dashboard__card-top">
          <h2 style={{ margin: 0, fontSize: "1rem" }}>{item.title}</h2>
          <span className="practice-patients__status practice-patients__status--active">{st}</span>
        </div>
        <p className="practice-patients__card-meta">{name}</p>
        <p className="practice-patients__card-meta">
          {typeLabel(item.type, t)} · {fmt(item.lastActivityAt, language)}
        </p>
        <Link className="practice-dashboard__link-btn" to={detailPath(item.id)}>
          {t.openItem}
        </Link>
      </article>
    );
  };

  return (
    <div className="practice-dashboard practice-patients patient-inbox">
      <div className="practice-dashboard__inner">
        <header className="practice-dashboard__header">
          <h1 className="practice-dashboard__title">{t.heading}</h1>
          <p className="practice-dashboard__intro">{t.intro}</p>
          <p className="practice-dashboard__safety">{t.safetyNote}</p>
          <nav className="practice-dashboard__header-links" aria-label={t.heading}>
            <Link to="/practice">{t.backHub}</Link>
          </nav>
        </header>

        <section className="practice-dashboard__filters" aria-label={t.selectPractice}>
          <label className="practice-dashboard__field">
            <span>{t.selectPractice}</span>
            <select
              value={practiceId}
              onChange={(e) => setPracticeId(e.target.value)}
              aria-label={t.selectPractice}
            >
              <option value="">{t.selectPracticePlaceholder}</option>
              {practices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.practiceName}
                </option>
              ))}
            </select>
          </label>
        </section>

        {practiceId ? (
          <section className="practice-patients__toolbar" aria-label={t.listCaption}>
            <label className="practice-dashboard__field">
              <span>{t.searchLabel}</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchLabel}
              />
            </label>
            <label className="practice-dashboard__field">
              <span>{t.filterLabel}</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label={t.filterLabel}
              >
                <option value="all">{t.filterAll}</option>
                <option value="unread">{t.filterUnread}</option>
                <option value="message">{t.filterMessages}</option>
                <option value="previsit">{t.filterPreVisit}</option>
                <option value="document">{t.filterDocuments}</option>
                <option value="medication">{t.filterMedication}</option>
                <option value="data_request">{t.filterDataRequests}</option>
                <option value="profile">{t.filterProfile}</option>
                <option value="archived">{t.filterArchived}</option>
              </select>
            </label>
            <label className="practice-dashboard__field">
              <span>{t.sortLabel}</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label={t.sortLabel}
              >
                <option value="activity">{t.sortActivity}</option>
                <option value="created">{t.sortCreated}</option>
                <option value="status">{t.sortStatus}</option>
              </select>
            </label>
            <div className="practice-dashboard__field">
              <button
                type="button"
                className="practice-dashboard__link-btn"
                disabled={aiBusy || !practiceId}
                onClick={async () => {
                  setAiBusy(true);
                  setAiSummary("");
                  try {
                    const { res, data } = await postPracticeInboxListAiSummary(
                      practiceId,
                      language,
                    );
                    if (!res.ok || !data.ok) throw new Error("ai_failed");
                    setAiSummary(data.summary || "");
                  } catch {
                    setAiSummary(t.aiError);
                  } finally {
                    setAiBusy(false);
                  }
                }}
              >
                {aiBusy ? t.aiLoading : t.aiListSummaryBtn}
              </button>
            </div>
          </section>
        ) : null}

        {aiSummary ? (
          <section className="patient-inbox__ai" aria-live="polite">
            <p className="patient-inbox__ai-label">{t.aiListSuggestionLabel}</p>
            <p className="patient-inbox__muted">{t.aiListDisclaimer}</p>
            <pre className="patient-inbox__ai-pre">{aiSummary}</pre>
          </section>
        ) : null}

        {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}
        {error ? (
          <p className="practice-dashboard__error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <p className="practice-dashboard__muted">
            {search || filter !== "all" ? t.emptyFiltered : t.empty}
          </p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <>
            <div className="practice-patients__table-wrap">
              <table className="practice-patients__table">
                <caption className="practice-dashboard__muted">{t.listCaption}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t.colPatient}</th>
                    <th scope="col">{t.colType}</th>
                    <th scope="col">{t.colSubject}</th>
                    <th scope="col">{t.colStatus}</th>
                    <th scope="col">{t.colPriority}</th>
                    <th scope="col">{t.colActivity}</th>
                    <th scope="col">{t.openItem}</th>
                  </tr>
                </thead>
                <tbody>{items.map(renderRow)}</tbody>
              </table>
            </div>
            <div className="practice-patients__cards" aria-label={t.listCaption}>
              {items.map(renderCard)}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
