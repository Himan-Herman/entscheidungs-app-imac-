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

  const detailPath = (linkId) =>
    `/practice/patients/${encodeURIComponent(linkId)}?practiceId=${encodeURIComponent(practiceId)}`;

  const renderRow = (row) => {
    const name = patientDisplayName(row, t.patientFallback);
    const email = row.patient?.email?.trim() || t.emailMissing;
    const statusText = statusLabel(row.status, t);
    const statusAria = t.statusAria.replace("{status}", statusText);

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
        <td>{fmt(row.linkedAt, language)}</td>
        <td>{fmt(row.updatedAt, language)}</td>
        <td>
          <Link className="practice-dashboard__link-btn" to={detailPath(row.id)}>
            {t.openDetail}
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
          {t.colLinkedAt}: {fmt(row.linkedAt, language)}
        </p>
        <p className="practice-patients__card-meta">
          {t.colUpdatedAt}: {fmt(row.updatedAt, language)}
        </p>
        <Link className="practice-dashboard__link-btn" to={detailPath(row.id)}>
          {t.openDetail}
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
            <Link to="/practice/hub">{t.backHub}</Link>
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

        {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}
        {error ? (
          <p className="practice-dashboard__error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && links.length === 0 ? (
          <p className="practice-dashboard__muted">{t.empty}</p>
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
                    <th scope="col">{t.colLinkedAt}</th>
                    <th scope="col">{t.colUpdatedAt}</th>
                    <th scope="col">
                      <span className="practice-dashboard__muted">{t.openDetail}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>{links.map(renderRow)}</tbody>
              </table>
            </div>
            <div className="practice-patients__cards" aria-label={t.listCaption}>
              {links.map(renderCard)}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
