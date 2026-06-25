import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  House,
  Inbox,
  LayoutDashboard,
  Languages,
  MessageSquare,
  Mic,
  QrCode,
  RotateCcw,
  ScanLine,
  Send,
  SlidersHorizontal,
  Target,
  Users,
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import { authFetch } from "../api/authFetch.js";
import { detectDeviceType, sendPracticeAnalyticsEvent } from "../api/productAnalytics.js";
import "../styles/PracticeDashboardPage.css";
import { getPrimaryIntlLocale } from '../i18n/intlLocale.js';

const STATUSES = ["new", "opened", "in_review", "completed", "archived"];

/**
 * Anonymized usage KPIs. Data-driven so every card renders identically; the icon
 * is purely decorative (aria-hidden). `value` reads only the already-loaded summary
 * — no medical content, no interpretation.
 */
const KPI_DEFS = [
  { labelKey: "analyticsPrevisitStarts", Icon: ClipboardList, value: (s) => s.previsitStarts },
  { labelKey: "analyticsPdfCreated", Icon: FileText, value: (s) => s.pdfCreated },
  { labelKey: "analyticsPdfSent", Icon: Send, value: (s) => s.pdfSent },
  { labelKey: "analyticsQrStarts", Icon: QrCode, value: (s) => s.qrPrevisitStarts },
  { labelKey: "analyticsQrLandings", Icon: ScanLine, value: (s) => s.qrLandingOpens },
  {
    labelKey: "analyticsSpeech",
    Icon: Mic,
    value: (s, t) =>
      t.analyticsSpeechBreakdown
        .replace("{{in}}", String(s.speechInputUses))
        .replace("{{out}}", String(s.textToSpeechUses)),
  },
  { labelKey: "analyticsFollowUps", Icon: MessageSquare, value: (s) => s.followUpsCreated },
  { labelKey: "analyticsActiveQrTargets", Icon: Target, value: (s) => s.activeQrTargets },
];

function fmt(iso, lang) {
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
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
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [analyticsLoadFailed, setAnalyticsLoadFailed] = useState(false);

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

  const loadAnalytics = useCallback(async () => {
    if (!practiceId) {
      setAnalyticsSummary(null);
      setAnalyticsLoadFailed(false);
      return;
    }
    try {
      const res = await authFetch(
        `/api/practice/analytics/summary?practiceId=${encodeURIComponent(practiceId)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setAnalyticsSummary(null);
        setAnalyticsLoadFailed(false);
        return;
      }
      if (!res.ok || !data.ok || !data.summary) throw new Error("analytics_failed");
      setAnalyticsSummary(data.summary);
      setAnalyticsLoadFailed(false);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setAnalyticsSummary(null);
      setAnalyticsLoadFailed(true);
    }
  }, [practiceId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    if (!practiceId) return;
    void sendPracticeAnalyticsEvent({
      eventType: "practice_dashboard_opened",
      practiceId,
      metadata: {
        deviceType: detectDeviceType(),
        uiLanguage: language,
      },
    });
  }, [practiceId]); // eslint-disable-line react-hooks/exhaustive-deps -- beacon tied to practice selection; avoid duplicate on UI language change

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

  const hasActiveFilters = Boolean(status || doctor || languageFilter || query.trim());

  const clearFilters = useCallback(() => {
    setStatus("");
    setDoctor("");
    setLanguageFilter("");
    setQuery("");
  }, []);

  function statusLabel(v) {
    if (v === "new") return t.statusNew;
    if (v === "opened") return t.statusOpened;
    if (v === "in_review") return t.statusInReview;
    if (v === "completed") return t.statusCompleted;
    if (v === "archived") return t.statusArchived;
    return v;
  }

  const hasLanguageLists =
    analyticsSummary &&
    ((analyticsSummary.patientLanguages?.length > 0) ||
      (analyticsSummary.doctorLanguages?.length > 0) ||
      (analyticsSummary.languagePairs?.length > 0));

  // Empty-state copy depends on context: no practice selected, filtered-to-nothing,
  // or a genuinely empty inbox.
  let emptyTitle = t.empty;
  let emptyBody = t.emptyBody;
  if (!practiceId) {
    emptyTitle = t.noPracticeTitle;
    emptyBody = t.noPracticeBody;
  } else if (hasActiveFilters) {
    emptyTitle = t.emptyFilteredTitle;
    emptyBody = t.emptyFilteredBody;
  }
  const showEmpty = !loading && !error && items.length === 0;

  return (
    <div className="practice-dashboard practice-dashboard--previsit">
      <div className="practice-dashboard__inner">
        <header className="practice-dashboard__header practice-dashboard__hero">
          <div className="practice-dashboard__hero-main">
            <h1 className="practice-dashboard__title">
              <LayoutDashboard size={22} strokeWidth={1.9} aria-hidden="true" />
              {t.heading}
            </h1>
            <p className="practice-dashboard__intro">{t.intro}</p>
            <p className="practice-dashboard__safety" role="note">
              {t.safetyNote}
            </p>
          </div>
          <nav className="practice-dashboard__nav" aria-label={t.heading}>
            <Link className="practice-dashboard__nav-link" to="/practice">
              <ArrowLeft size={16} aria-hidden="true" />
              {t.navHub}
            </Link>
            {practiceId ? (
              <Link
                className="practice-dashboard__nav-link"
                to={`/practice/patients?practiceId=${encodeURIComponent(practiceId)}`}
              >
                <Users size={16} aria-hidden="true" />
                {t.navPatients}
              </Link>
            ) : null}
            <Link className="practice-dashboard__nav-link" to="/settings/practices">
              <ClipboardList size={16} aria-hidden="true" />
              {tPractices.heading}
            </Link>
            <Link className="practice-dashboard__nav-link" to="/choose">
              <House size={16} aria-hidden="true" />
              {tPractices.backHome}
            </Link>
          </nav>
        </header>

        {analyticsSummary ? (
          <section className="practice-dashboard__analytics" aria-label={t.analyticsHeading}>
            <div className="practice-dashboard__section-head">
              <h2 className="practice-dashboard__analytics-heading">{t.analyticsHeading}</h2>
            </div>
            <p className="practice-dashboard__analytics-privacy">{t.analyticsPrivacy}</p>
            <div className="practice-dashboard__analytics-grid">
              {KPI_DEFS.map((def) => {
                const Icon = def.Icon;
                return (
                  <article key={def.labelKey} className="practice-dashboard__stat-card practice-dashboard__kpi">
                    <span className="practice-dashboard__kpi-icon" aria-hidden="true">
                      <Icon size={18} strokeWidth={1.9} />
                    </span>
                    <div className="practice-dashboard__kpi-body">
                      <h3 className="practice-dashboard__stat-label">{t[def.labelKey]}</h3>
                      <p className="practice-dashboard__stat-value">{def.value(analyticsSummary, t)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
            {hasLanguageLists ? (
              <div className="practice-dashboard__analytics-lists">
                {analyticsSummary.patientLanguages?.length > 0 ? (
                  <div className="practice-dashboard__analytics-list-block">
                    <h3 className="practice-dashboard__analytics-list-title">{t.analyticsPatientLangs}</h3>
                    <ul className="practice-dashboard__analytics-list">
                      {analyticsSummary.patientLanguages.map((row) => (
                        <li key={row.language}>
                          <span>{row.language}</span>
                          <span className="practice-dashboard__analytics-count">{row.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {analyticsSummary.doctorLanguages?.length > 0 ? (
                  <div className="practice-dashboard__analytics-list-block">
                    <h3 className="practice-dashboard__analytics-list-title">{t.analyticsDoctorLangs}</h3>
                    <ul className="practice-dashboard__analytics-list">
                      {analyticsSummary.doctorLanguages.map((row) => (
                        <li key={row.language}>
                          <span>{row.language}</span>
                          <span className="practice-dashboard__analytics-count">{row.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {analyticsSummary.languagePairs?.length > 0 ? (
                  <div className="practice-dashboard__analytics-list-block">
                    <h3 className="practice-dashboard__analytics-list-title">{t.analyticsLangPairs}</h3>
                    <ul className="practice-dashboard__analytics-list">
                      {analyticsSummary.languagePairs.map((row) => (
                        <li key={row.pair}>
                          <span>{row.pair.replace("|", " → ")}</span>
                          <span className="practice-dashboard__analytics-count">{row.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            {analyticsSummary.avgCompletionBucketScore != null ? (
              <p className="practice-dashboard__analytics-footnote">
                {t.analyticsAvgCompletion.replace(
                  "{{score}}",
                  String(analyticsSummary.avgCompletionBucketScore),
                )}
              </p>
            ) : null}
          </section>
        ) : null}
        {analyticsLoadFailed && practiceId ? (
          <p className="practice-dashboard__analytics-warn" role="status">
            {t.analyticsLoadError}
          </p>
        ) : null}

        <section className="practice-dashboard__filters" aria-label={t.filtersTitle}>
          <div className="practice-dashboard__filter-head">
            <h2 className="practice-dashboard__filter-title">
              <SlidersHorizontal size={18} aria-hidden="true" />
              {t.filtersTitle}
            </h2>
            {hasActiveFilters ? (
              <button
                type="button"
                className="practice-dashboard__btn practice-dashboard__btn--ghost"
                onClick={clearFilters}
              >
                <RotateCcw size={15} aria-hidden="true" />
                {t.clearFilters}
              </button>
            ) : null}
          </div>
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

        {practiceId && !loading && !error && items.length > 0 ? (
          <div className="practice-dashboard__results-head">
            <h2 className="practice-dashboard__results-title">
              <Inbox size={18} aria-hidden="true" />
              {t.resultsHeading}
            </h2>
            <span
              className="practice-dashboard__count-badge"
              aria-live="polite"
              aria-label={t.resultsCount.replace("{count}", String(items.length))}
            >
              {items.length}
            </span>
          </div>
        ) : null}

        {loading ? (
          <p className="practice-dashboard__muted" aria-live="polite">
            {t.loading}
          </p>
        ) : null}
        {error ? (
          <p className="practice-dashboard__error" role="alert">
            {error}
          </p>
        ) : null}

        {showEmpty ? (
          <div className="practice-dashboard__empty" role="status">
            <span className="practice-dashboard__empty-icon" aria-hidden="true">
              <Inbox size={26} strokeWidth={1.6} />
            </span>
            <h3 className="practice-dashboard__empty-title">{emptyTitle}</h3>
            <p className="practice-dashboard__empty-body">{emptyBody}</p>
            {practiceId && hasActiveFilters ? (
              <button
                type="button"
                className="practice-dashboard__btn practice-dashboard__btn--primary"
                onClick={clearFilters}
              >
                <RotateCcw size={15} aria-hidden="true" />
                {t.clearFilters}
              </button>
            ) : null}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="practice-dashboard__cards">
            {items.map((row) => (
              <article key={row.id} className="practice-dashboard__card">
                <div className="practice-dashboard__card-top">
                  <span className={`practice-dashboard__chip practice-dashboard__chip--${row.practiceStatus}`}>
                    {statusLabel(row.practiceStatus)}
                  </span>
                  <button
                    type="button"
                    className="practice-dashboard__btn practice-dashboard__btn--primary practice-dashboard__link-btn"
                    onClick={() =>
                      navigate(`/practice/dashboard/preparations/${encodeURIComponent(row.id)}?practiceId=${encodeURIComponent(practiceId)}`)
                    }
                  >
                    {t.cardOpen}
                  </button>
                </div>
                <p className="practice-dashboard__card-name">{row.patientName || "—"}</p>
                <dl className="practice-dashboard__meta">
                  <div className="practice-dashboard__meta-row">
                    <dt>{t.cardTarget}</dt>
                    <dd>{row.targetDoctorName || row.targetName || "—"}</dd>
                  </div>
                  <div className="practice-dashboard__meta-row">
                    <dt>{t.cardCase}</dt>
                    <dd>{row.preVisitCaseTitle || "—"}</dd>
                  </div>
                  {row.appointmentReason ? (
                    <div className="practice-dashboard__meta-row">
                      <dt>{t.cardReason}</dt>
                      <dd>{row.appointmentReason}</dd>
                    </div>
                  ) : null}
                  <div className="practice-dashboard__meta-row">
                    <dt>
                      <Languages size={13} aria-hidden="true" /> {t.cardPatientLanguage}
                    </dt>
                    <dd>{row.patientLanguage || "—"}</dd>
                  </div>
                  <div className="practice-dashboard__meta-row">
                    <dt>
                      <Languages size={13} aria-hidden="true" /> {t.cardDoctorLanguage}
                    </dt>
                    <dd>{row.doctorLanguage || "—"}</dd>
                  </div>
                  <div className="practice-dashboard__meta-row">
                    <dt>{t.cardCreatedAt}</dt>
                    <dd>{fmt(row.createdAt, language)}</dd>
                  </div>
                </dl>
                <p className="practice-dashboard__card-foot">
                  <span
                    className={`practice-dashboard__pdf-badge${
                      row.pdfDownloaded ? " practice-dashboard__pdf-badge--ready" : ""
                    }`}
                  >
                    <FileText size={13} aria-hidden="true" />
                    {row.pdfDownloaded ? t.cardPdfReady : t.cardNoPdf}
                  </span>
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
