import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { authFetch } from "../api/authFetch.js";
import "../styles/PracticeDashboardPage.css";

const STATUSES = ["new", "opened", "in_review", "completed", "archived"];

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

export default function PracticeDashboardPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceDashboard || getMessages("en").practiceDashboard,
    [language],
  );
  const tPractices = useMemo(
    () => getMessages(language).settingsPractices || getMessages("en").settingsPractices,
    [language],
  );

  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState("");
  const [items, setItems] = useState([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [doctor, setDoctor] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [query, setQuery] = useState("");

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

  const loadInbox = useCallback(async () => {
    if (!practiceId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      q.set("practiceId", practiceId);
      if (status) q.set("status", status);
      if (doctor.trim()) q.set("doctor", doctor.trim());
      if (languageFilter) q.set("language", languageFilter);
      if (query.trim()) q.set("q", query.trim());
      const res = await authFetch(`/api/practice-dashboard/inbox?${q.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("inbox_load_failed");
      setItems(Array.isArray(data.items) ? data.items : []);
      setRole(String(data.role || ""));
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setItems([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [doctor, languageFilter, practiceId, query, status, t.loadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void loadPractices().then(() => void loadInbox());
  }, [loadPractices, loadInbox]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  const doctorOptions = useMemo(() => {
    const uniq = new Set();
    for (const row of items) {
      const v = String(row.targetDoctorName || row.targetName || "").trim();
      if (v) uniq.add(v);
    }
    return Array.from(uniq).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const languageOptions = useMemo(() => {
    const uniq = new Set();
    for (const row of items) {
      if (row.patientLanguage) uniq.add(row.patientLanguage);
      if (row.doctorLanguage) uniq.add(row.doctorLanguage);
    }
    return Array.from(uniq).sort((a, b) => a.localeCompare(b));
  }, [items]);

  function statusLabel(v) {
    if (v === "new") return t.statusNew;
    if (v === "opened") return t.statusOpened;
    if (v === "in_review") return t.statusInReview;
    if (v === "completed") return t.statusCompleted;
    if (v === "archived") return t.statusArchived;
    return v;
  }

  return (
    <div className="practice-dashboard">
      <div className="practice-dashboard__inner">
        <header className="practice-dashboard__header">
          <h1 className="practice-dashboard__title">{t.heading}</h1>
          <p className="practice-dashboard__intro">{t.intro}</p>
          <p className="practice-dashboard__safety">{t.safetyNote}</p>
          <div className="practice-dashboard__header-links">
            <Link to="/settings/practices">{tPractices.heading}</Link>
            <Link to="/startseite">{tPractices.backHome}</Link>
          </div>
        </header>

        <section className="practice-dashboard__filters" aria-label={t.filtersTitle}>
          <label className="practice-dashboard__field">
            <span>{t.selectPractice}</span>
            <select value={practiceId} onChange={(e) => setPracticeId(e.target.value)}>
              <option value="">{t.selectPracticePlaceholder}</option>
              {practices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.practiceName}
                </option>
              ))}
            </select>
          </label>
          <label className="practice-dashboard__field">
            <span>{t.filterStatus}</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t.allStatuses}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="practice-dashboard__field">
            <span>{t.filterDoctor}</span>
            <select value={doctor} onChange={(e) => setDoctor(e.target.value)}>
              <option value="">{t.allDoctors}</option>
              {doctorOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="practice-dashboard__field">
            <span>{t.filterLanguage}</span>
            <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
              <option value="">{t.allLanguages}</option>
              {languageOptions.map((lng) => (
                <option key={lng} value={lng}>
                  {lng}
                </option>
              ))}
            </select>
          </label>
          <label className="practice-dashboard__field practice-dashboard__field--wide">
            <span>{t.filterSearch}</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
            />
          </label>
        </section>

        {role ? (
          <p className="practice-dashboard__role">
            {t.memberRoleLabel}: <strong>{role}</strong>
          </p>
        ) : null}
        {loading ? <p className="practice-dashboard__muted">{t.loading}</p> : null}
        {error ? <p className="practice-dashboard__error">{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="practice-dashboard__muted">{t.empty}</p>
        ) : null}

        <div className="practice-dashboard__cards">
          {items.map((row) => (
            <article key={row.id} className="practice-dashboard__card">
              <div className="practice-dashboard__card-top">
                <span className={`practice-dashboard__chip practice-dashboard__chip--${row.practiceStatus}`}>
                  {statusLabel(row.practiceStatus)}
                </span>
                <button
                  type="button"
                  className="practice-dashboard__link-btn"
                  onClick={() =>
                    navigate(`/practice/dashboard/preparations/${encodeURIComponent(row.id)}?practiceId=${encodeURIComponent(practiceId)}`)
                  }
                >
                  {t.cardOpen}
                </button>
              </div>
              <p><strong>{t.cardPatient}:</strong> {row.patientName || "—"}</p>
              <p><strong>{t.cardCreatedAt}:</strong> {fmt(row.createdAt, language)}</p>
              <p><strong>{t.cardPatientLanguage}:</strong> {row.patientLanguage || "—"}</p>
              <p><strong>{t.cardDoctorLanguage}:</strong> {row.doctorLanguage || "—"}</p>
              <p><strong>{t.cardTarget}:</strong> {row.targetDoctorName || row.targetName || "—"}</p>
              <p><strong>{t.cardCase}:</strong> {row.preVisitCaseTitle || "—"}</p>
              <p><strong>{t.cardPdf}:</strong> {row.pdfDownloaded ? t.cardPdfReady : t.cardNoPdf}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
