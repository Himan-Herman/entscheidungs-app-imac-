import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations/index.js";
import { authFetch } from "../../../api/authFetch.js";
import {
  formatLanguageDisplayName,
  getPrimaryIntlLocale,
} from "../../../i18n/intlLocale.js";
import { hydrateSessionFromArchiveItem } from "../constants/preVisitSession.js";
import {
  clearPreVisitArchive,
  deletePreVisitArchiveItem,
  listPreVisitArchiveItems,
} from "../session/localPreVisitArchive.js";
import {
  hydrateServerSessionToLocal,
  isAccountSessionCompleted,
  previewFromAnswers,
  resolveAccountSessionResumeTarget,
} from "../utils/preVisitResumeUtils.js";
import PreVisitModuleChrome from "../components/PreVisitModuleChrome.jsx";
import "../styles/PreVisitAccountHistoryPage.css";

function langLabel(code, uiLang) {
  return formatLanguageDisplayName(uiLang, code);
}

function formatCreated(iso, uiLang) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const localeTag = getPrimaryIntlLocale(uiLang);
    return new Intl.DateTimeFormat(localeTag, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "—";
  }
}

function statusText(status, t) {
  switch (status) {
    case "pdf_created":
      return t.statusPdfCreated;
    case "completed":
      return t.statusCompleted;
    case "draft":
    default:
      return t.statusDraft;
  }
}

function statusClass(status) {
  switch (status) {
    case "pdf_created":
      return "pre-visit-account__status--pdf";
    case "completed":
      return "pre-visit-account__status--done";
    case "draft":
    default:
      return "pre-visit-account__status--draft";
  }
}

const STATUS_FILTERS = ["all", "draft", "pdf_created", "completed"];

export default function PreVisitAccountHistoryPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useMemo(() => getMessages(language).preVisit.accountHistory, [language]);

  const [hasAuthToken, setHasAuthToken] = useState(() =>
    typeof window !== "undefined"
      ? !!window.localStorage.getItem("medscout_token")
      : false,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [deviceItems, setDeviceItems] = useState(() => listPreVisitArchiveItems());
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const refreshDeviceItems = useCallback(() => {
    setDeviceItems(listPreVisitArchiveItems());
  }, []);

  useEffect(() => {
    setHasAuthToken(!!localStorage.getItem("medscout_token"));
  }, [location.pathname, location.key]);

  const fetchSessions = useCallback(async () => {
    const messages = getMessages(language).preVisit.accountHistory;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/previsit/sessions");
      if (!res.ok) {
        setError(messages.loadError);
        setSessions([]);
        return;
      }
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.sessions)) {
        setError(messages.loadError);
        setSessions([]);
        return;
      }
      setSessions(data.sessions);
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setError(messages.loadError);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (!hasAuthToken) {
      setSessions([]);
      setLoading(false);
      setError(null);
      return;
    }
    fetchSessions();
  }, [hasAuthToken, fetchSessions]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    refreshDeviceItems();
  }, [refreshDeviceItems, location.hash]);

  useEffect(() => {
    if (location.hash !== "#device-storage") return;
    const el = document.getElementById("device-storage");
    if (!el) return;
    const tmr = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(tmr);
  }, [location.hash, deviceItems.length, loading]);

  const focusSessionId = location.state?.focusSessionId;

  useEffect(() => {
    const id = typeof focusSessionId === "string" ? focusSessionId.trim() : "";
    if (!id || loading || sessions.length === 0) return;
    const el = document.getElementById(`prep-session-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    el.classList.add("pre-visit-account__card-wrap--focus");
    const tmr = window.setTimeout(() => {
      el.classList.remove("pre-visit-account__card-wrap--focus");
    }, 4000);
    return () => window.clearTimeout(tmr);
  }, [focusSessionId, loading, sessions]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      const title =
        (typeof row.title === "string" && row.title.trim()) || t.defaultTitle;
      const preview = previewFromAnswers(row.answers);
      return `${title} ${preview}`.toLowerCase().includes(q);
    });
  }, [sessions, searchQuery, statusFilter, t.defaultTitle]);

  const sortedDeviceItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...deviceItems]
      .filter((item) => {
        if (!q) return true;
        const preview = previewFromAnswers(item.answers);
        return preview.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
  }, [deviceItems, searchQuery]);

  function cardTitle(row) {
    return (typeof row.title === "string" && row.title.trim()) || t.defaultTitle;
  }

  function handleOpenAccount(record) {
    const target = resolveAccountSessionResumeTarget(record);
    hydrateServerSessionToLocal(record, { resumeTarget: target });
    navigate(target.path, { state: target.state });
  }

  function handleDownloadPdfAccount(record) {
    hydrateServerSessionToLocal(record);
    navigate("/pre-visit/document", { state: { fromArchive: true, autoDownloadPdf: true } });
  }

  function handleOpenDevice(item) {
    if (!hydrateSessionFromArchiveItem(item)) return;
    navigate("/pre-visit/document", { state: { fromArchive: true } });
  }

  async function handleDeleteOne(id) {
    if (!window.confirm(t.confirmDeleteOne)) return;
    setDeleteBusyId(id);
    setError(null);
    try {
      const res = await authFetch(`/api/previsit/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(t.deleteError);
        return;
      }
      await fetchSessions();
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setError(t.deleteError);
    } finally {
      setDeleteBusyId(null);
    }
  }

  function handleDeleteDevice(id) {
    if (!window.confirm(t.confirmDeleteDevice)) return;
    deletePreVisitArchiveItem(id);
    refreshDeviceItems();
  }

  async function handleDeleteAll() {
    if (!window.confirm(t.confirmDeleteAll)) return;
    setDeleteAllBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/previsit/sessions", {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(t.deleteAllError);
        return;
      }
      await fetchSessions();
    } catch (err) {
      if (err?.message === "SESSION_EXPIRED") return;
      setError(t.deleteAllError);
    } finally {
      setDeleteAllBusy(false);
    }
  }

  function handleClearDeviceAll() {
    if (!window.confirm(t.confirmClearDevice)) return;
    clearPreVisitArchive();
    refreshDeviceItems();
  }

  const showGlobalEmpty =
    sortedDeviceItems.length === 0 &&
    (!hasAuthToken || (!loading && !error && sessions.length === 0));

  const showToolbar =
    hasAuthToken && (sessions.length > 0 || sortedDeviceItems.length > 0);

  return (
    <div className="pre-visit-account pre-visit-account--workspace">
      <div className="pre-visit-account__inner">
        <PreVisitModuleChrome variant="library" />

        <header className="pre-visit-account__header">
          <span className="pre-visit-account__badge">{t.workspaceBadge}</span>
          <h1 className="pre-visit-account__title">{t.title}</h1>
          <p className="pre-visit-account__subtitle">{t.subtitle}</p>
          <div className="pre-visit-account__quick-links">
            {hasAuthToken ? (
              <Link className="pre-visit-account__quick-link" to="/pre-visit/cases">
                {t.linkCases}
              </Link>
            ) : null}
            <Link className="pre-visit-account__quick-link" to="/account/documents">
              {t.linkDocuments}
            </Link>
          </div>
          <p className="pre-visit-account__quick-hint">{t.linkDocumentsHint}</p>
        </header>

        {showToolbar ? (
          <div className="pre-visit-account__toolbar" role="search">
            <label className="pre-visit-account__toolbar-field">
              <span className="pre-visit-account__toolbar-label">{t.searchLabel}</span>
              <input
                type="search"
                className="pre-visit-account__search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
              />
            </label>
            {hasAuthToken && sessions.length > 0 ? (
              <label className="pre-visit-account__toolbar-field pre-visit-account__toolbar-field--filter">
                <span className="pre-visit-account__toolbar-label">{t.filterLabel}</span>
                <select
                  className="pre-visit-account__filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_FILTERS.map((key) => (
                    <option key={key} value={key}>
                      {key === "all"
                        ? t.filterAll
                        : statusText(key, t)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        {!hasAuthToken ? (
          <div className="pre-visit-account__gate">
            <p className="pre-visit-account__gate-text">{t.loginHint}</p>
            <Link className="pre-visit-account__btn pre-visit-account__btn--login" to="/login">
              {t.loginCta}
            </Link>
          </div>
        ) : null}

        {hasAuthToken && loading ? (
          <p className="pre-visit-account__loading" role="status" aria-live="polite">
            {t.loading}
          </p>
        ) : null}

        {hasAuthToken && error ? (
          <div className="pre-visit-account__error-wrap" role="alert">
            <p className="pre-visit-account__error">{error}</p>
            <button
              type="button"
              className="pre-visit-account__btn pre-visit-account__btn--secondary"
              onClick={() => void fetchSessions()}
            >
              {t.retryLoad}
            </button>
          </div>
        ) : null}

        {showGlobalEmpty ? (
          <div className="pre-visit-account__empty">
            <p>{t.empty}</p>
            <p className="pre-visit-account__empty-hint">{t.emptyHint}</p>
            <Link
              className="pre-visit-account__btn pre-visit-account__btn--secondary"
              to="/pre-visit"
            >
              {t.startNewPrep}
            </Link>
          </div>
        ) : null}

        {hasAuthToken && !loading && !error && sessions.length > 0 ? (
          <section className="pre-visit-account__section" aria-labelledby="prep-account-heading">
            <h2 id="prep-account-heading" className="pre-visit-account__section-title">
              {t.sectionAccount}
            </h2>
            <p className="pre-visit-account__section-hint">{t.sectionAccountHint}</p>

            {filteredSessions.length === 0 ? (
              <p className="pre-visit-account__no-results" role="status">
                {t.noAccountResults}
              </p>
            ) : (
              <ul className="pre-visit-account__list" aria-label={t.listAriaLabel}>
                {filteredSessions.map((row) => {
                  const completed = isAccountSessionCompleted(row);
                  const primaryLabel = completed ? t.open : t.resume;
                  return (
                    <li
                      key={row.id}
                      id={row.id ? `prep-session-${row.id}` : undefined}
                      className="pre-visit-account__card-wrap"
                    >
                      <article className="pre-visit-account__card">
                        <div className="pre-visit-account__card-head">
                          <h3 className="pre-visit-account__card-title">
                            {cardTitle(row)}
                          </h3>
                          <div className="pre-visit-account__badges">
                            <span className="pre-visit-account__storage-badge">
                              {t.storageAccount}
                            </span>
                            <span
                              className={`pre-visit-account__status ${statusClass(row.status)}`}
                            >
                              {statusText(row.status, t)}
                            </span>
                          </div>
                        </div>
                        <div className="pre-visit-account__meta">
                          <div className="pre-visit-account__meta-item">
                            <span className="pre-visit-account__meta-label">{t.created}</span>
                            <span className="pre-visit-account__meta-value">
                              {formatCreated(row.createdAt, language)}
                            </span>
                          </div>
                          <div className="pre-visit-account__meta-item">
                            <span className="pre-visit-account__meta-label">{t.patientLang}</span>
                            <span className="pre-visit-account__meta-value">
                              {langLabel(row.patientLanguage, language)}
                            </span>
                          </div>
                          <div className="pre-visit-account__meta-item">
                            <span className="pre-visit-account__meta-label">{t.doctorLang}</span>
                            <span className="pre-visit-account__meta-value">
                              {row.doctorLanguage
                                ? langLabel(row.doctorLanguage, language)
                                : "—"}
                            </span>
                          </div>
                          {row.preVisitCaseId ? (
                            <div className="pre-visit-account__meta-item">
                              <span className="pre-visit-account__meta-label">{t.linkedCase}</span>
                              <span className="pre-visit-account__meta-value">
                                <Link
                                  className="pre-visit-account__inline-link"
                                  to={`/pre-visit/cases/${encodeURIComponent(row.preVisitCaseId)}`}
                                >
                                  {t.linkCases}
                                </Link>
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <p className="pre-visit-account__preview">
                          {previewFromAnswers(row.answers)}
                        </p>
                        <div className="pre-visit-account__actions">
                          <button
                            type="button"
                            className="pre-visit-account__btn pre-visit-account__btn--primary"
                            onClick={() => handleOpenAccount(row)}
                            aria-label={`${primaryLabel}: ${cardTitle(row)}`}
                          >
                            {primaryLabel}
                          </button>
                          {completed ? (
                            <button
                              type="button"
                              className="pre-visit-account__btn pre-visit-account__btn--secondary"
                              onClick={() => handleDownloadPdfAccount(row)}
                              aria-label={`${t.downloadPdf}: ${cardTitle(row)}`}
                            >
                              {t.downloadPdf}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="pre-visit-account__btn pre-visit-account__btn--danger"
                            disabled={deleteBusyId === row.id || deleteAllBusy}
                            onClick={() => handleDeleteOne(row.id)}
                            aria-label={`${t.deleteOne}: ${cardTitle(row)}`}
                          >
                            {t.deleteOne}
                          </button>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}

            {sessions.length > 0 ? (
              <div className="pre-visit-account__danger-zone">
                <button
                  type="button"
                  className="pre-visit-account__btn pre-visit-account__btn--danger-secondary"
                  disabled={deleteAllBusy || !!deleteBusyId}
                  onClick={handleDeleteAll}
                >
                  {t.deleteAll}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {sortedDeviceItems.length > 0 ? (
          <section
            id="device-storage"
            className="pre-visit-account__section pre-visit-account__section--device"
            aria-labelledby="prep-device-heading"
          >
            <h2 id="prep-device-heading" className="pre-visit-account__section-title">
              {t.sectionDevice}
            </h2>
            <p className="pre-visit-account__section-hint">{t.sectionDeviceHint}</p>
            <ul className="pre-visit-account__list" aria-label={t.sectionDevice}>
              {sortedDeviceItems.map((item) => (
                <li key={item.id} className="pre-visit-account__card-wrap">
                  <article className="pre-visit-account__card pre-visit-account__card--device">
                    <div className="pre-visit-account__card-head">
                      <h3 className="pre-visit-account__card-title">{t.defaultTitle}</h3>
                      <div className="pre-visit-account__badges">
                        <span className="pre-visit-account__storage-badge pre-visit-account__storage-badge--device">
                          {t.storageDevice}
                        </span>
                        <span className="pre-visit-account__status pre-visit-account__status--local">
                          {t.statusLocalSaved}
                        </span>
                      </div>
                    </div>
                    <div className="pre-visit-account__meta">
                      <div className="pre-visit-account__meta-item">
                        <span className="pre-visit-account__meta-label">{t.savedAt}</span>
                        <span className="pre-visit-account__meta-value">
                          {formatCreated(item.createdAt, language)}
                        </span>
                      </div>
                      <div className="pre-visit-account__meta-item">
                        <span className="pre-visit-account__meta-label">{t.patientLang}</span>
                        <span className="pre-visit-account__meta-value">
                          {langLabel(item.patientLanguage, language)}
                        </span>
                      </div>
                      <div className="pre-visit-account__meta-item">
                        <span className="pre-visit-account__meta-label">{t.doctorLang}</span>
                        <span className="pre-visit-account__meta-value">
                          {langLabel(item.doctorLanguage, language)}
                        </span>
                      </div>
                    </div>
                    <p className="pre-visit-account__preview">
                      {previewFromAnswers(item.answers)}
                    </p>
                    <div className="pre-visit-account__actions">
                      <button
                        type="button"
                        className="pre-visit-account__btn pre-visit-account__btn--primary"
                        onClick={() => handleOpenDevice(item)}
                      >
                        {t.open}
                      </button>
                      <button
                        type="button"
                        className="pre-visit-account__btn pre-visit-account__btn--danger"
                        onClick={() => handleDeleteDevice(item.id)}
                      >
                        {t.deleteOne}
                      </button>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
            <div className="pre-visit-account__danger-zone">
              <button
                type="button"
                className="pre-visit-account__btn pre-visit-account__btn--danger-secondary"
                onClick={handleClearDeviceAll}
              >
                {t.clearDeviceAll}
              </button>
            </div>
          </section>
        ) : null}

        {!showGlobalEmpty ? (
          <div className="pre-visit-account__footer-cta">
            <Link className="pre-visit-account__btn pre-visit-account__btn--secondary" to="/pre-visit">
              {t.startNewPrep}
            </Link>
          </div>
        ) : null}

        <p className="pre-visit-account__privacy">{t.privacyNote}</p>
      </div>
    </div>
  );
}
