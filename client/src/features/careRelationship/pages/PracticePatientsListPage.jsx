import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { authFetch } from "../../../api/authFetch.js";
import { fetchPracticePatients } from "../api/practicePatientsApi.js";
import { patientDisplayName } from "../utils/patientDisplayName.js";
import "../../../styles/PracticeDashboardPage.css";
import "../../../styles/PracticePatientsPage.css";

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

function statusLabel(status, t) {
  const map = {
    invited: t.statusInvited,
    active: t.statusActive,
    revoked: t.statusRevoked,
    archived: t.statusArchived,
  };
  return map[status] || status;
}

function matchesSearch(row, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const name = patientDisplayName(row, "").toLowerCase();
  const email = (row.patient?.email || "").toLowerCase();
  return name.includes(q) || email.includes(q);
}

export default function PracticePatientsListPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practicePatients || getMessages("en").practicePatients,
    [language],
  );
  const tPractices = useMemo(
    () => getMessages(language).settingsPractices || getMessages("en").settingsPractices,
    [language],
  );
  const [searchParams, setSearchParams] = useSearchParams();

  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("activity");

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("load_practices_failed");
    const rows = Array.isArray(data.practices) ? data.practices : [];
    setPractices(rows);
    if (!practiceId && rows.length > 0) {
      setPracticeId(rows[0].id);
    }
  }, [practiceId]);

  const loadLinks = useCallback(async () => {
    if (!practiceId) {
      setLinks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticePatients(practiceId, { limit: 200 });
      if (res.status === 404 && data.error === "feature_disabled") {
        setLinks([]);
        setError(t.featureDisabled);
        return;
      }
      if (!res.ok || !data.ok) throw new Error("patients_load_failed");
      setLinks(Array.isArray(data.links) ? data.links : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setLinks([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, t.featureDisabled, t.loadError]);

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
    loadLinks();
  }, [loadLinks]);

  const filteredLinks = useMemo(() => {
    let rows = links.filter((row) => matchesSearch(row, search.trim()));
    if (statusFilter !== "all") {
      rows = rows.filter((row) => row.status === statusFilter);
    }
    rows = [...rows].sort((a, b) => {
      if (sortBy === "name") {
        return patientDisplayName(a, t.patientFallback).localeCompare(
          patientDisplayName(b, t.patientFallback),
          language === "de" ? "de" : "en",
        );
      }
      if (sortBy === "created") {
        return new Date(b.linkedAt).getTime() - new Date(a.linkedAt).getTime();
      }
      const aAct = a.summary?.lastActivityAt || a.updatedAt;
      const bAct = b.summary?.lastActivityAt || b.updatedAt;
      return new Date(bAct).getTime() - new Date(aAct).getTime();
    });
    return rows;
  }, [links, search, statusFilter, sortBy, language, t.patientFallback]);

  const detailPath = (linkId) =>
    `/practice/patients/${encodeURIComponent(linkId)}?practiceId=${encodeURIComponent(practiceId)}`;

  const renderRow = (row) => {
    const name = patientDisplayName(row, t.patientFallback);
    const email = row.patient?.email?.trim() || t.emailMissing;
    const statusText = statusLabel(row.status, t);
    const statusAria = t.statusAria.replace("{status}", statusText);
    const summary = row.summary || {};

    return (
      <tr key={row.id}>
        <td>{name}</td>
        <td>{email}</td>
        <td>
          <span
            className={`practice-patients__status practice-patients__status--${row.status}`}
            aria-label={statusAria}
          >
            {statusText}
          </span>
        </td>
        <td>{fmt(summary.lastActivityAt || row.updatedAt, language)}</td>
        <td>{summary.documentCount ?? 0}</td>
        <td>{summary.messageCount ?? 0}</td>
        <td>{fmt(summary.lastVisitAt, language)}</td>
        <td>
          <Link className="practice-dashboard__link-btn" to={detailPath(row.id)}>
            {t.openRecord}
          </Link>
        </td>
      </tr>
    );
  };

  const renderCard = (row) => {
    const name = patientDisplayName(row, t.patientFallback);
    const email = row.patient?.email?.trim() || t.emailMissing;
    const statusText = statusLabel(row.status, t);
    const statusAria = t.statusAria.replace("{status}", statusText);
    const summary = row.summary || {};

    return (
      <article key={row.id} className="practice-patients__card-item">
        <div className="practice-dashboard__card-top">
          <h2 className="practice-dashboard__muted" style={{ margin: 0, fontSize: "1rem" }}>
            {name}
          </h2>
          <span
            className={`practice-patients__status practice-patients__status--${row.status}`}
            aria-label={statusAria}
          >
            {statusText}
          </span>
        </div>
        <p className="practice-patients__card-meta">{email}</p>
        <p className="practice-patients__card-meta">
          {t.colLastActivity}: {fmt(summary.lastActivityAt || row.updatedAt, language)}
        </p>
        <p className="practice-patients__card-meta">
          {t.colDocuments}: {summary.documentCount ?? 0} · {t.colMessages}:{" "}
          {summary.messageCount ?? 0}
        </p>
        <Link className="practice-dashboard__link-btn" to={detailPath(row.id)}>
          {t.openRecord}
        </Link>
      </article>
    );
  };

  return (
    <div className="practice-dashboard practice-patients">
      <div className="practice-dashboard__inner">
        <header className="practice-dashboard__header">
          <h1 className="practice-dashboard__title">{t.heading}</h1>
          <p className="practice-dashboard__intro">{t.intro}</p>
          <p className="practice-dashboard__safety">{t.safetyNote}</p>
          <nav className="practice-dashboard__header-links" aria-label={t.heading}>
            <Link to="/practice">{t.backHub}</Link>
            <Link to={`/practice/dashboard?practiceId=${encodeURIComponent(practiceId)}`}>
              {t.backDashboard}
            </Link>
            <Link to="/settings/practices">{tPractices.heading}</Link>
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

        {!loading && !error && links.length > 0 ? (
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
              <span>{t.filterStatusLabel}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label={t.filterStatusLabel}
              >
                <option value="all">{t.filterStatusAll}</option>
                <option value="active">{t.statusActive}</option>
                <option value="invited">{t.statusInvited}</option>
                <option value="archived">{t.statusArchived}</option>
                <option value="revoked">{t.statusRevoked}</option>
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
                <option value="name">{t.sortName}</option>
                <option value="created">{t.sortCreated}</option>
              </select>
            </label>
          </section>
        ) : null}

        {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}
        {error ? (
          <p className="practice-dashboard__error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && links.length === 0 ? (
          <p className="practice-dashboard__muted">{t.empty}</p>
        ) : null}

        {!loading && !error && links.length > 0 && filteredLinks.length === 0 ? (
          <p className="practice-dashboard__muted">{t.emptyFiltered}</p>
        ) : null}

        {!loading && !error && filteredLinks.length > 0 ? (
          <>
            <div className="practice-patients__table-wrap">
              <table className="practice-patients__table">
                <caption className="practice-dashboard__muted">{t.listCaption}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t.colName}</th>
                    <th scope="col">{t.colEmail}</th>
                    <th scope="col">{t.colStatus}</th>
                    <th scope="col">{t.colLastActivity}</th>
                    <th scope="col">{t.colDocuments}</th>
                    <th scope="col">{t.colMessages}</th>
                    <th scope="col">{t.colLastVisit}</th>
                    <th scope="col">
                      <span className="practice-dashboard__muted">{t.openRecord}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>{filteredLinks.map(renderRow)}</tbody>
              </table>
            </div>
            <div className="practice-patients__cards" aria-label={t.listCaption}>
              {filteredLinks.map(renderCard)}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
