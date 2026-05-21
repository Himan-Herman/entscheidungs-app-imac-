import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ClipboardList,
  FileText,
  Inbox,
  MessageSquare,
  Pill,
  Languages,
  Shield,
  UsersRound,
} from "lucide-react";
import { isMedicalInterpreterB2bClientEnabled } from "../features/medicalInterpreter/config/isMedicalInterpreterB2bEnabled.js";
import { ensureDemoPractice, fetchPractices } from "../api/practicesApi.js";
import {
  fetchPracticeOverviewActivity,
  fetchPracticeOverviewSummary,
  postPracticeOverviewAiSummary,
} from "../features/practiceOverview/api/practiceOverviewApi.js";
import { useLanguage } from "../i18n/LanguageContext";
import { getMessages } from "../i18n/translations";
import "../styles/PracticeOverviewPage.css";
import { formatUiDateTime } from "../i18n/intlLocale.js";

function fmtDate(iso, lang) {
  return formatUiDateTime(iso, lang);
}

function fmtMetric(value, notProvided) {
  if (value == null) return notProvided;
  return String(value);
}

const CARD_DEFS = [
  {
    id: "inbox",
    visibilityKey: "inbox",
    metricKey: "unreadInboxItems",
    labelKey: "cardInbox",
    to: (practiceId) => `/practice/inbox?practiceId=${encodeURIComponent(practiceId)}`,
    Icon: Inbox,
  },
  {
    id: "patients",
    visibilityKey: "patients",
    metricKey: "activePatientLinks",
    labelKey: "cardPatients",
    to: (practiceId) => `/practice/patients?practiceId=${encodeURIComponent(practiceId)}`,
    Icon: UsersRound,
  },
  {
    id: "messages",
    visibilityKey: "messages",
    metricKey: "openMessages",
    labelKey: "cardMessages",
    to: (practiceId) => `/practice/patients?practiceId=${encodeURIComponent(practiceId)}`,
    Icon: MessageSquare,
  },
  {
    id: "documents",
    visibilityKey: "documents",
    metricKey: "newDocumentShares",
    labelKey: "cardDocuments",
    to: (practiceId) => `/practice/patients?practiceId=${encodeURIComponent(practiceId)}`,
    Icon: FileText,
  },
  {
    id: "medication",
    visibilityKey: "medication",
    metricKey: "publishedMedicationPlans",
    labelKey: "cardMedication",
    to: (practiceId) => `/practice/patients?practiceId=${encodeURIComponent(practiceId)}`,
    Icon: Pill,
  },
  {
    id: "dataRequests",
    visibilityKey: "dataRequests",
    metricKey: "openDataRequests",
    labelKey: "cardDataRequests",
    to: (practiceId) => `/practice/data-requests?practiceId=${encodeURIComponent(practiceId)}`,
    Icon: ClipboardList,
  },
  {
    id: "team",
    visibilityKey: "team",
    labelKey: "cardTeam",
    to: (practiceId) => `/practice/team?practiceId=${encodeURIComponent(practiceId)}`,
    Icon: Shield,
  },
  {
    id: "security",
    visibilityKey: "security",
    labelKey: "cardSecurity",
    to: (practiceId) => `/practice/security?practiceId=${encodeURIComponent(practiceId)}`,
    Icon: Shield,
  },
  {
    id: "activity",
    visibilityKey: "patients",
    labelKey: "cardActivity",
    to: (practiceId, hasAudit) =>
      hasAudit
        ? `/practice/audit?practiceId=${encodeURIComponent(practiceId)}`
        : "#practice-overview-activity",
    Icon: Activity,
  },
];

const ACTIVITY_LABEL_KEYS = {
  message: "activityMessage",
  document_shared: "activityDocumentShared",
  medication_published: "activityMedicationPublished",
  profile_access_changed: "activityProfileAccess",
  data_request: "activityDataRequest",
  relationship_archived: "activityRelationshipArchived",
};

const ROLE_LABEL_KEYS = {
  owner: "roleOwner",
  admin: "roleAdmin",
  doctor: "roleDoctor",
  assistant: "roleAssistant",
  viewer: "roleViewer",
};

const NAV_ACCOUNT = "__nav_account__";
const NAV_PROFILES = "__nav_profiles__";
const NAV_DASHBOARD = "__nav_dashboard__";

export default function PracticeHubPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceOverview || getMessages("en").practiceOverview,
    [language],
  );
  const tTeam = useMemo(
    () => getMessages(language).practiceTeam || getMessages("en").practiceTeam,
    [language],
  );
  const tPractices = useMemo(
    () => getMessages(language).settingsPractices || getMessages("en").settingsPractices,
    [language],
  );
  const tInterp = useMemo(
    () =>
      getMessages(language).medicalInterpreterPractice ||
      getMessages("en").medicalInterpreterPractice,
    [language],
  );
  const b2bInterpreterClientOn = isMedicalInterpreterB2bClientEnabled();
  const [practices, setPractices] = useState([]);
  const [practicesLoadError, setPracticesLoadError] = useState("");
  const [practiceId, setPracticeId] = useState("");
  const [summary, setSummary] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [error, setError] = useState("");
  const [activityError, setActivityError] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiDisclaimer, setAiDisclaimer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [demoCreating, setDemoCreating] = useState(false);
  const [demoCreateError, setDemoCreateError] = useState("");

  const applyPracticeRows = useCallback((rows) => {
    const list = Array.isArray(rows) ? rows : [];
    setPractices(list);
    setPracticeId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev;
      return list[0]?.id || "";
    });
    return list;
  }, []);

  const loadPractices = useCallback(async () => {
    setPracticesLoadError("");
    setDemoCreateError("");
    try {
      let { res, data } = await fetchPractices();
      if (!res.ok) throw new Error("load_practices_failed");
      let rows = applyPracticeRows(data.practices);

      if (rows.length === 0) {
        const ensured = await ensureDemoPractice();
        if (ensured.res.ok) {
          rows = applyPracticeRows(ensured.data.practices);
        }
        if (rows.length === 0) {
          const retry = await fetchPractices();
          if (retry.res.ok) {
            rows = applyPracticeRows(retry.data.practices);
          }
        }
      }
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setPractices([]);
      setPracticeId("");
      setPracticesLoadError(t.practicesLoadError);
    }
  }, [applyPracticeRows, t.practicesLoadError]);

  const handleCreateDemoPractice = useCallback(async () => {
    setDemoCreating(true);
    setDemoCreateError("");
    setPracticesLoadError("");
    try {
      const { res, data } = await ensureDemoPractice();
      if (!res.ok) throw new Error(data?.error || "ensure_demo_failed");
      const rows = applyPracticeRows(data.practices);
      if (!rows.length) throw new Error("ensure_demo_empty");
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setDemoCreateError(t.createDemoPracticeError);
    } finally {
      setDemoCreating(false);
    }
  }, [applyPracticeRows, t.createDemoPracticeError]);

  const loadSummary = useCallback(async () => {
    if (!practiceId) {
      setSummary(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { res, data } = await fetchPracticeOverviewSummary(practiceId);
      if (!res.ok || !data.ok) throw new Error("summary_failed");
      setSummary(data);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setSummary(null);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, t.loadError]);

  const loadActivity = useCallback(async () => {
    if (!practiceId) {
      setActivity([]);
      setActivityLoading(false);
      return;
    }
    setActivityLoading(true);
    setActivityError("");
    try {
      const { res, data } = await fetchPracticeOverviewActivity(practiceId);
      if (!res.ok || !data.ok) throw new Error("activity_failed");
      setActivity(Array.isArray(data.events) ? data.events : []);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setActivity([]);
      setActivityError(t.activityLoadError);
    } finally {
      setActivityLoading(false);
    }
  }, [practiceId, t.activityLoadError]);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void loadPractices();
  }, [loadPractices]);

  useEffect(() => {
    void loadSummary();
    void loadActivity();
    setAiText("");
    setAiDisclaimer("");
    setAiError("");
  }, [loadSummary, loadActivity]);

  const visibility = summary?.visibility || {};
  const metrics = summary?.metrics || {};
  const quickActions = summary?.quickActions || {};

  const visibleCards = useMemo(
    () => CARD_DEFS.filter((c) => visibility[c.visibilityKey] !== false),
    [visibility],
  );

  const showInterpreterCard =
    b2bInterpreterClientOn && Boolean(practiceId) && visibility.interpreter === true;

  const metricRows = useMemo(() => {
    const rows = [];
    if (visibility.inbox) {
      rows.push({ key: "unreadInbox", label: t.metricUnreadInbox, value: metrics.unreadInboxItems });
    }
    if (visibility.messages) {
      rows.push({ key: "messages", label: t.metricOpenMessages, value: metrics.openMessages });
    }
    if (visibility.dataRequests) {
      rows.push({
        key: "dataReq",
        label: t.metricOpenDataRequests,
        value: metrics.openDataRequests,
      });
    }
    if (visibility.patients) {
      rows.push({
        key: "patients",
        label: t.metricActivePatients,
        value: metrics.activePatientLinks,
      });
    }
    if (visibility.documents) {
      rows.push({
        key: "docs",
        label: t.metricNewDocuments,
        value: metrics.newDocumentShares,
      });
    }
    if (visibility.medication) {
      rows.push({
        key: "meds",
        label: t.metricPublishedMeds,
        value: metrics.publishedMedicationPlans,
      });
    }
    return rows;
  }, [metrics, t, visibility]);

  const roleLabel = useMemo(() => {
    const role = summary?.role || "";
    const key = ROLE_LABEL_KEYS[role];
    return key && tTeam[key] ? tTeam[key] : role || t.notProvided;
  }, [summary?.role, t.notProvided, tTeam]);

  const runAiSummary = async () => {
    if (!practiceId) return;
    setAiLoading(true);
    setAiError("");
    try {
      const { res, data } = await postPracticeOverviewAiSummary(practiceId, language);
      if (!res.ok || !data.ok) throw new Error("ai_failed");
      setAiText(String(data.summary || ""));
      setAiDisclaimer(String(data.disclaimer || t.aiDisclaimer));
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setAiError(t.aiError);
    } finally {
      setAiLoading(false);
    }
  };

  const patientHref = (linkId) =>
    `/practice/patients/${encodeURIComponent(linkId)}?practiceId=${encodeURIComponent(practiceId)}`;

  function handlePracticeSelectChange(e) {
    const value = e.target.value;
    if (value === NAV_ACCOUNT) {
      navigate("/account");
      return;
    }
    if (value === NAV_PROFILES) {
      navigate("/settings/practices");
      return;
    }
    if (value === NAV_DASHBOARD) {
      if (practiceId) {
        navigate(`/practice/dashboard?practiceId=${encodeURIComponent(practiceId)}`);
      }
      return;
    }
    setPracticeId(value);
  }

  return (
    <div className="practice-overview">
      <nav className="practice-overview__top-nav" aria-label={t.topNavAria}>
        <Link className="practice-overview__top-nav-link practice-overview__top-nav-link--back" to="/account">
          ← {t.backAccount}
        </Link>
        <Link className="practice-overview__top-nav-link" to="/settings/practices">
          {t.linkPracticeProfiles}
        </Link>
        {practiceId ? (
          <Link
            className="practice-overview__top-nav-link"
            to={`/practice/dashboard?practiceId=${encodeURIComponent(practiceId)}`}
          >
            {t.linkPracticeDashboard}
          </Link>
        ) : null}
      </nav>

      <header className="practice-overview__hero">
        <h1 className="practice-overview__title">{t.heading}</h1>
        <p className="practice-overview__intro">{t.intro}</p>
        <p className="practice-overview__safety" role="note">
          {t.safetyNote}
        </p>
      </header>

      <div className="practice-overview__toolbar">
        <label htmlFor="practice-overview-select">{t.selectPractice}</label>
        <select
          id="practice-overview-select"
          className="practice-overview__select"
          value={practiceId || ""}
          onChange={handlePracticeSelectChange}
        >
          <optgroup label={t.selectNavGroup}>
            <option value={NAV_ACCOUNT}>{t.selectOptionAccount}</option>
            <option value={NAV_PROFILES}>{t.selectOptionProfiles}</option>
            {practiceId ? (
              <option value={NAV_DASHBOARD}>{t.selectOptionDashboard}</option>
            ) : null}
          </optgroup>
          <optgroup label={t.selectPracticeGroup}>
            {!practices.length ? (
              <option value="" disabled>
                {t.selectPracticePlaceholder}
              </option>
            ) : null}
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.practiceName || p.id}
              </option>
            ))}
          </optgroup>
        </select>
        {summary?.role ? (
          <p className="practice-overview__role">
            {t.roleLabel}: <strong>{roleLabel}</strong>
          </p>
        ) : null}
      </div>

      {practicesLoadError ? (
        <p className="practice-overview__status practice-overview__status--error" role="alert">
          {practicesLoadError}
        </p>
      ) : null}

      {!practicesLoadError && !practices.length ? (
        <div className="practice-overview__empty-practices" role="status">
          <p>{t.noPracticesHint}</p>
          <p className="practice-overview__empty-practices-actions">
            <button
              type="button"
              className="practice-overview__action"
              onClick={() => void handleCreateDemoPractice()}
              disabled={demoCreating}
            >
              {demoCreating ? t.createDemoPracticeLoading : t.createDemoPractice}
            </button>
            {" · "}
            <Link className="practice-overview__action" to="/settings/practices">
              {tPractices.heading}
            </Link>
            {" · "}
            <Link className="practice-overview__action" to="/practice/team">
              {t.openTeamLink}
            </Link>
          </p>
          {demoCreateError ? (
            <p className="practice-overview__status practice-overview__status--error" role="alert">
              {demoCreateError}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="practice-overview__status practice-overview__status--error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="practice-overview__status" aria-live="polite">
          {t.loading}
        </p>
      ) : null}

      {!loading && summary ? (
        <>
          <section aria-labelledby="practice-overview-cards-heading">
            <h2 id="practice-overview-cards-heading" className="practice-overview__section-title">
              {t.cardsHeading}
            </h2>
            <nav className="practice-overview__cards" aria-label={t.cardsHeading}>
              {visibleCards.map((card) => {
                const CardIcon = card.Icon;
                const href =
                  card.id === "activity"
                    ? card.to(practiceId, Boolean(visibility.audit))
                    : card.to(practiceId);
                const metricValue =
                  card.metricKey != null ? metrics[card.metricKey] : null;
                return (
                  <Link
                    key={card.id}
                    className="practice-overview__card"
                    to={href}
                    aria-label={`${t[card.labelKey]}${metricValue != null ? `: ${metricValue}` : ""}`}
                  >
                    <span className="practice-overview__card-icon" aria-hidden>
                      <CardIcon size={22} strokeWidth={1.75} />
                    </span>
                    <span className="practice-overview__card-label">{t[card.labelKey]}</span>
                    {card.metricKey != null ? (
                      <span className="practice-overview__card-metric" aria-hidden>
                        {fmtMetric(metricValue, t.notProvided)}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
              {showInterpreterCard ? (
                <Link
                  className="practice-overview__card practice-overview__card--interpreter"
                  to={`/practice/interpreter?practiceId=${encodeURIComponent(practiceId)}`}
                  aria-label={tInterp.hubCard.ariaLabel}
                >
                  <span className="practice-overview__card-icon" aria-hidden>
                    <Languages size={22} strokeWidth={1.75} />
                  </span>
                  <span className="practice-overview__card-label">{tInterp.hubCard.title}</span>
                  <span className="practice-overview__card-desc">{tInterp.hubCard.description}</span>
                  <span className="practice-overview__card-badge" role="status">
                    {tInterp.hubCard.badge}
                  </span>
                </Link>
              ) : null}
            </nav>
          </section>

          {metricRows.length > 0 ? (
            <section aria-labelledby="practice-overview-metrics-heading">
              <h2 id="practice-overview-metrics-heading" className="practice-overview__section-title">
                {t.metricsHeading}
              </h2>
              <dl className="practice-overview__metrics-grid">
                {metricRows.map((row) => (
                  <div key={row.key} className="practice-overview__metric">
                    <dt>{row.label}</dt>
                    <dd aria-label={`${row.label}: ${fmtMetric(row.value, t.notProvided)}`}>
                      {fmtMetric(row.value, t.notProvided)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : (
            <p className="practice-overview__status">{t.emptyMetrics}</p>
          )}

          {visibility.patients &&
          Array.isArray(metrics.recentlyActivePatients) &&
          metrics.recentlyActivePatients.length > 0 ? (
            <section aria-labelledby="practice-overview-recent-patients-heading">
              <h2
                id="practice-overview-recent-patients-heading"
                className="practice-overview__section-title"
              >
                {t.metricRecentPatients}
              </h2>
              <ul className="practice-overview__recent-patients">
                {metrics.recentlyActivePatients.map((row) => (
                  <li key={row.linkId} className="practice-overview__recent-patient">
                    <Link
                      className="practice-overview__activity-link"
                      to={patientHref(row.linkId)}
                      aria-label={t.recentPatientAria}
                    >
                      {t.recentPatientLink}
                    </Link>
                    <time dateTime={row.lastActivityAt} className="practice-overview__activity-time">
                      {fmtDate(row.lastActivityAt, language)}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="practice-overview-actions-heading">
            <h2 id="practice-overview-actions-heading" className="practice-overview__section-title">
              {t.quickActionsHeading}
            </h2>
            <div className="practice-overview__actions">
              {quickActions.searchPatient ? (
                <Link
                  className="practice-overview__action"
                  to={`/practice/patients?practiceId=${encodeURIComponent(practiceId)}`}
                >
                  {t.actionSearchPatient}
                </Link>
              ) : null}
              {quickActions.openInbox ? (
                <Link
                  className="practice-overview__action"
                  to={`/practice/inbox?practiceId=${encodeURIComponent(practiceId)}`}
                >
                  {t.actionOpenInbox}
                </Link>
              ) : null}
              {quickActions.newMessage ? (
                <Link
                  className="practice-overview__action"
                  to={`/practice/patients?practiceId=${encodeURIComponent(practiceId)}`}
                >
                  {t.actionNewMessage}
                </Link>
              ) : null}
              {quickActions.uploadDocument ? (
                <Link
                  className="practice-overview__action"
                  to={`/practice/patients?practiceId=${encodeURIComponent(practiceId)}`}
                >
                  {t.actionUploadDocument}
                </Link>
              ) : null}
              {quickActions.manageTeam ? (
                <Link
                  className="practice-overview__action"
                  to={`/practice/team?practiceId=${encodeURIComponent(practiceId)}`}
                >
                  {t.actionManageTeam}
                </Link>
              ) : null}
              {quickActions.openSettings ? (
                <Link
                  className="practice-overview__action"
                  to={`/practice/settings?practiceId=${encodeURIComponent(practiceId)}`}
                >
                  {t.actionOpenSettings}
                </Link>
              ) : null}
              {quickActions.openIntegrations ? (
                <Link
                  className="practice-overview__action"
                  to={`/practice/integrations?practiceId=${encodeURIComponent(practiceId)}`}
                >
                  {t.actionOpenIntegrations}
                </Link>
              ) : null}
              {quickActions.openCalendar ? (
                <Link
                  className="practice-overview__action"
                  to={`/practice/calendar?practiceId=${encodeURIComponent(practiceId)}`}
                >
                  {t.actionOpenCalendar}
                </Link>
              ) : null}
              {quickActions.openTelemedicine ? (
                <Link
                  className="practice-overview__action"
                  to={`/practice/telemedicine?practiceId=${encodeURIComponent(practiceId)}`}
                >
                  {t.actionOpenTelemedicine}
                </Link>
              ) : null}
              {quickActions.openDeveloper ? (
                <Link
                  className="practice-overview__action"
                  to={`/practice/developer?practiceId=${encodeURIComponent(practiceId)}`}
                >
                  {t.actionOpenDeveloper}
                </Link>
              ) : null}
              {quickActions.openSecurity ? (
                <Link
                  className="practice-overview__action"
                  to={`/practice/security?practiceId=${encodeURIComponent(practiceId)}`}
                >
                  {t.actionOpenSecurity}
                </Link>
              ) : null}
            </div>
          </section>

          <section id="practice-overview-activity" aria-labelledby="practice-overview-activity-heading">
            <h2 id="practice-overview-activity-heading" className="practice-overview__section-title">
              {t.recentActivityHeading}
            </h2>
            {activityLoading ? (
              <p className="practice-overview__status" aria-live="polite">
                {t.loading}
              </p>
            ) : null}
            {activityError ? (
              <p className="practice-overview__status practice-overview__status--error" role="alert">
                {activityError}
              </p>
            ) : null}
            {!activityLoading && !activityError && activity.length === 0 ? (
              <p className="practice-overview__status">{t.emptyActivity}</p>
            ) : null}
            {!activityLoading && activity.length > 0 ? (
              <ul className="practice-overview__activity-list">
                {activity.map((ev) => {
                  const labelKey = ACTIVITY_LABEL_KEYS[ev.type];
                  const label = labelKey ? t[labelKey] : ev.type;
                  return (
                    <li key={ev.id} className="practice-overview__activity-item">
                      <span className="practice-overview__activity-type">{label}</span>
                      <time
                        className="practice-overview__activity-time"
                        dateTime={ev.occurredAt}
                      >
                        {fmtDate(ev.occurredAt, language)}
                      </time>
                      {ev.practicePatientLinkId ? (
                        <Link
                          className="practice-overview__activity-link"
                          to={patientHref(ev.practicePatientLinkId)}
                        >
                          {t.recentPatientLink}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>

          <section className="practice-overview__ai" aria-labelledby="practice-overview-ai-heading">
            <h2 id="practice-overview-ai-heading" className="practice-overview__section-title">
              {t.aiHeading}
            </h2>
            <p className="practice-overview__ai-disclaimer">{t.aiDisclaimer}</p>
            <button
              type="button"
              className="practice-overview__action practice-overview__action--secondary"
              onClick={() => void runAiSummary()}
              disabled={aiLoading || !practiceId}
            >
              {aiLoading ? t.aiLoading : t.aiLoad}
            </button>
            {aiError ? (
              <p className="practice-overview__status practice-overview__status--error" role="alert">
                {aiError}
              </p>
            ) : null}
            {aiText ? (
              <pre className="practice-overview__ai-text" aria-live="polite">
                {aiText}
              </pre>
            ) : (
              !aiLoading && <p className="practice-overview__status">{t.aiEmpty}</p>
            )}
            {aiDisclaimer ? (
              <p className="practice-overview__ai-disclaimer">{aiDisclaimer}</p>
            ) : null}
          </section>

          <Link
            className="practice-overview__footer-link"
            to={`/practice/dashboard?practiceId=${encodeURIComponent(practiceId)}`}
          >
            {t.preVisitLink}
          </Link>
        </>
      ) : null}
    </div>
  );
}
