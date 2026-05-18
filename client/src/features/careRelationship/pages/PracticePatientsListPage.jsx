import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { authFetch } from "../../../api/authFetch.js";
import {
  fetchPracticePatients,
  postPracticePatientSearchAiSuggestion,
} from "../api/practicePatientsApi.js";
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

const EMPTY_FILTERS = {
  status: "",
  assignmentFilter: "",
  profileShared: "",
  hasUnreadMessages: "",
  hasDocuments: "",
  hasMedicationPlan: "",
  hasOpenDataRequest: "",
};

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
  const tOrg = useMemo(
    () =>
      getMessages(language).practiceOrganization ||
      getMessages("en").practiceOrganization,
    [language],
  );
  const [searchParams, setSearchParams] = useSearchParams();

  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [links, setLinks] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sortBy, setSortBy] = useState("activity");
  const [sortDirection, setSortDirection] = useState("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

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

  const buildFetchOpts = useCallback(
    (pageNum) => {
      const opts = {
        page: pageNum,
        limit: 25,
        sortBy,
        sortDirection,
      };
      if (searchQ.trim()) opts.q = searchQ.trim();
      if (filters.status) opts.status = filters.status;
      if (filters.assignmentFilter) opts.assignmentFilter = filters.assignmentFilter;
      if (filters.profileShared === "yes") opts.profileShared = true;
      if (filters.profileShared === "no") opts.profileShared = false;
      if (filters.hasUnreadMessages === "yes") opts.hasUnreadMessages = true;
      if (filters.hasUnreadMessages === "no") opts.hasUnreadMessages = false;
      if (filters.hasDocuments === "yes") opts.hasDocuments = true;
      if (filters.hasDocuments === "no") opts.hasDocuments = false;
      if (filters.hasMedicationPlan === "yes") opts.hasMedicationPlan = true;
      if (filters.hasMedicationPlan === "no") opts.hasMedicationPlan = false;
      if (filters.hasOpenDataRequest === "yes") opts.hasOpenDataRequest = true;
      if (filters.hasOpenDataRequest === "no") opts.hasOpenDataRequest = false;
      return opts;
    },
    [searchQ, filters, sortBy, sortDirection],
  );

  const loadLinks = useCallback(
    async (append = false) => {
      if (!practiceId) {
        setLinks([]);
        setLoading(false);
        return;
      }
      const pageNum = append ? page + 1 : 1;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const { res, data } = await fetchPracticePatients(practiceId, buildFetchOpts(pageNum));
        if (res.status === 404 && data.error === "feature_disabled") {
          setLinks([]);
          setError(t.featureDisabled);
          return;
        }
        if (!res.ok || !data.ok) throw new Error("patients_load_failed");
        const rows = Array.isArray(data.links) ? data.links : [];
        setLinks((prev) => (append ? [...prev, ...rows] : rows));
        setTotal(Number(data.total) || 0);
        setHasMore(Boolean(data.hasMore));
        setPage(pageNum);
      } catch (e) {
        if (e?.message === "SESSION_EXPIRED") return;
        if (!append) setLinks([]);
        setError(t.loadError);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [practiceId, page, buildFetchOpts, t.featureDisabled, t.loadError],
  );

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
    const timer = setTimeout(() => setSearchQ(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    loadLinks(false);
  }, [practiceId, searchQ, filters, sortBy, sortDirection]);

  const activeChips = useMemo(() => {
    /** @type {{ key: string, label: string }[]} */
    const chips = [];
    if (searchQ.trim()) chips.push({ key: "q", label: `"${searchQ.trim()}"` });
    if (filters.status)
      chips.push({
        key: "status",
        label: `${t.filterStatusLabel}: ${statusLabel(filters.status, t)}`,
      });
    if (filters.profileShared === "yes")
      chips.push({ key: "profileShared", label: t.filterProfileSharedYes });
    if (filters.profileShared === "no")
      chips.push({ key: "profileShared", label: t.filterProfileSharedNo });
    if (filters.hasUnreadMessages === "yes")
      chips.push({ key: "hasUnreadMessages", label: t.filterUnreadYes });
    if (filters.hasUnreadMessages === "no")
      chips.push({ key: "hasUnreadMessages", label: t.filterUnreadNo });
    if (filters.hasDocuments === "yes")
      chips.push({ key: "hasDocuments", label: t.filterDocumentsYes });
    if (filters.hasDocuments === "no")
      chips.push({ key: "hasDocuments", label: t.filterDocumentsNo });
    if (filters.hasMedicationPlan === "yes")
      chips.push({ key: "hasMedicationPlan", label: t.filterMedicationYes });
    if (filters.hasMedicationPlan === "no")
      chips.push({ key: "hasMedicationPlan", label: t.filterMedicationNo });
    if (filters.hasOpenDataRequest === "yes")
      chips.push({ key: "hasOpenDataRequest", label: t.filterDataRequestYes });
    if (filters.hasOpenDataRequest === "no")
      chips.push({ key: "hasOpenDataRequest", label: t.filterDataRequestNo });
    return chips;
  }, [searchQ, filters, t]);

  function resetFilters() {
    setSearchInput("");
    setSearchQ("");
    setFilters(EMPTY_FILTERS);
    setSortBy("activity");
    setSortDirection("desc");
    setAiSummary("");
  }

  function removeChip(key) {
    if (key === "q") {
      setSearchInput("");
      setSearchQ("");
      return;
    }
    setFilters((f) => ({ ...f, [key]: "" }));
  }

  async function handleAiSuggestion() {
    if (!practiceId) return;
    setAiBusy(true);
    setAiSummary("");
    try {
      const { res, data } = await postPracticePatientSearchAiSuggestion(practiceId, {
        q: searchQ || searchInput,
        filters,
        locale: language,
      });
      if (!res.ok || !data.ok) throw new Error("ai_failed");
      setAiSummary(data.summary || "");
      if (data.suggested && typeof data.suggested === "object") {
        const s = data.suggested;
        setFilters((f) => ({
          ...f,
          ...(s.status ? { status: String(s.status) } : {}),
          ...(s.profileShared === true ? { profileShared: "yes" } : {}),
          ...(s.hasUnreadMessages === true ? { hasUnreadMessages: "yes" } : {}),
          ...(s.hasDocuments === true ? { hasDocuments: "yes" } : {}),
          ...(s.hasMedicationPlan === true ? { hasMedicationPlan: "yes" } : {}),
          ...(s.hasOpenDataRequest === true ? { hasOpenDataRequest: "yes" } : {}),
        }));
      }
    } catch {
      setAiSummary(t.aiFilterError);
    } finally {
      setAiBusy(false);
    }
  }

  const detailPath = (linkId) => {
    const q = new URLSearchParams({ practiceId });
    if (searchQ.trim() || activeChips.length > 0) {
      q.set("fromSearch", "true");
    }
    return `/practice/patients/${encodeURIComponent(linkId)}?${q.toString()}`;
  };

  const renderRow = (row) => {
    const name = patientDisplayName(row, t.patientFallback);
    const email = row.patient?.email?.trim() || t.emailMissing;
    const statusText = statusLabel(row.status, t);
    const statusAria = t.statusAria.replace("{status}", statusText);
    const summary = row.summary || {};

    return (
      <tr key={row.id}>
        <td>
          {name}
          {summary.hasUnreadMessages ? (
            <span className="practice-patients__unread-badge" role="status">
              {t.unreadBadge}
            </span>
          ) : null}
        </td>
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
    const summary = row.summary || {};

    return (
      <article key={row.id} className="practice-patients__card-item">
        <div className="practice-dashboard__card-top">
          <h2 className="practice-dashboard__muted" style={{ margin: 0, fontSize: "1rem" }}>
            {name}
          </h2>
          <span className={`practice-patients__status practice-patients__status--${row.status}`}>
            {statusText}
          </span>
        </div>
        <p className="practice-patients__card-meta">{email}</p>
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

        {practiceId ? (
          <section className="practice-patients__search-panel" aria-label={t.searchPatients}>
            <label className="practice-dashboard__field practice-patients__search-field">
              <span>{t.searchPatients}</span>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPatients}
              />
            </label>

            <button
              type="button"
              className="patient-threads__btn patient-threads__btn--secondary"
              aria-expanded={filtersOpen}
              aria-controls="practice-patients-filters"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              {filtersOpen ? t.hideFilters : t.showFilters}
            </button>

            <button
              type="button"
              className="patient-threads__btn patient-threads__btn--secondary"
              onClick={() => void handleAiSuggestion()}
              disabled={aiBusy}
              aria-busy={aiBusy}
            >
              {aiBusy ? t.aiFilterLoading : t.aiFilterButton}
            </button>

            <button
              type="button"
              className="patient-threads__btn patient-threads__btn--secondary"
              onClick={resetFilters}
            >
              {t.resetFilters}
            </button>

            <div
              id="practice-patients-filters"
              className={`practice-patients__filters-panel${filtersOpen ? " practice-patients__filters-panel--open" : ""}`}
              hidden={!filtersOpen}
            >
              <fieldset className="practice-patients__filter-fieldset">
                <legend>{t.filtersHeading}</legend>
                <div className="practice-patients__filter-grid">
                  <label>
                    <span>{t.filterStatusLabel}</span>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                    >
                      <option value="">{t.filterStatusAll}</option>
                      <option value="active">{t.statusActive}</option>
                      <option value="invited">{t.statusInvited}</option>
                      <option value="archived">{t.statusArchived}</option>
                      <option value="revoked">{t.statusRevoked}</option>
                    </select>
                  </label>
                  <label>
                    <span>{tOrg.assignmentHeading}</span>
                    <select
                      value={filters.assignmentFilter}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, assignmentFilter: e.target.value }))
                      }
                    >
                      <option value="">{tOrg.filterAllAssignments}</option>
                      <option value="assigned_to_me">{tOrg.filterAssignedToMe}</option>
                      <option value="unassigned">{tOrg.filterUnassigned}</option>
                    </select>
                  </label>
                  <label>
                    <span>{t.filterProfileShared}</span>
                    <select
                      value={filters.profileShared}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, profileShared: e.target.value }))
                      }
                    >
                      <option value="">—</option>
                      <option value="yes">{t.filterProfileSharedYes}</option>
                      <option value="no">{t.filterProfileSharedNo}</option>
                    </select>
                  </label>
                  <label>
                    <span>{t.filterUnreadMessages}</span>
                    <select
                      value={filters.hasUnreadMessages}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, hasUnreadMessages: e.target.value }))
                      }
                    >
                      <option value="">—</option>
                      <option value="yes">{t.filterUnreadYes}</option>
                      <option value="no">{t.filterUnreadNo}</option>
                    </select>
                  </label>
                  <label>
                    <span>{t.filterDocuments}</span>
                    <select
                      value={filters.hasDocuments}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, hasDocuments: e.target.value }))
                      }
                    >
                      <option value="">—</option>
                      <option value="yes">{t.filterDocumentsYes}</option>
                      <option value="no">{t.filterDocumentsNo}</option>
                    </select>
                  </label>
                  <label>
                    <span>{t.filterMedication}</span>
                    <select
                      value={filters.hasMedicationPlan}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, hasMedicationPlan: e.target.value }))
                      }
                    >
                      <option value="">—</option>
                      <option value="yes">{t.filterMedicationYes}</option>
                      <option value="no">{t.filterMedicationNo}</option>
                    </select>
                  </label>
                  <label>
                    <span>{t.filterDataRequest}</span>
                    <select
                      value={filters.hasOpenDataRequest}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, hasOpenDataRequest: e.target.value }))
                      }
                    >
                      <option value="">—</option>
                      <option value="yes">{t.filterDataRequestYes}</option>
                      <option value="no">{t.filterDataRequestNo}</option>
                    </select>
                  </label>
                  <label>
                    <span>{t.sortLabel}</span>
                    <select
                      value={`${sortBy}:${sortDirection}`}
                      onChange={(e) => {
                        const [by, dir] = e.target.value.split(":");
                        setSortBy(by);
                        setSortDirection(dir);
                      }}
                    >
                      <option value="activity:desc">{t.sortActivity}</option>
                      <option value="name:asc">{t.sortName}</option>
                      <option value="linkedAt:desc">{t.sortLinkedNewest}</option>
                      <option value="linkedAt:asc">{t.sortLinkedOldest}</option>
                      <option value="status:asc">{t.sortStatus}</option>
                    </select>
                  </label>
                </div>
              </fieldset>
            </div>

            {activeChips.length > 0 ? (
              <ul className="practice-patients__chips" aria-label={t.filtersHeading}>
                {activeChips.map((chip) => (
                  <li key={chip.key}>
                    <button
                      type="button"
                      className="practice-patients__chip"
                      onClick={() => removeChip(chip.key)}
                      aria-label={t.chipRemove.replace("{label}", chip.label)}
                    >
                      {chip.label} ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {aiSummary ? (
              <div className="practice-patients__ai-box" role="region" aria-labelledby="ai-filter-heading">
                <h3 id="ai-filter-heading" className="practice-patients__ai-title">
                  {t.aiFilterLabel}
                </h3>
                <p className="patient-inbox__safety">{t.aiFilterHint}</p>
                <pre className="practice-patients__ai-text">{aiSummary}</pre>
              </div>
            ) : null}

            <p className="practice-dashboard__muted" role="status" aria-live="polite">
              {t.resultsCount.replace("{count}", String(total))}
            </p>
          </section>
        ) : null}

        {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}
        {error ? (
          <p className="practice-dashboard__error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && links.length === 0 ? (
          <p className="practice-dashboard__muted" role="status">
            {activeChips.length > 0 || searchQ ? t.emptyFiltered : t.empty}
          </p>
        ) : null}

        {!loading && !error && links.length > 0 ? (
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
                <tbody>{links.map(renderRow)}</tbody>
              </table>
            </div>
            <div className="practice-patients__cards" aria-label={t.listCaption}>
              {links.map(renderCard)}
            </div>
            {hasMore ? (
              <button
                type="button"
                className="patient-threads__btn patient-threads__btn--primary"
                onClick={() => void loadLinks(true)}
                disabled={loadingMore}
                aria-busy={loadingMore}
              >
                {loadingMore ? t.loading : t.loadMore}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
