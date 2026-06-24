import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, Settings } from "lucide-react";
import { authFetch } from "../../../api/authFetch.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  createPracticeSession,
  fetchPracticeTelemedicineSessions,
} from "../api/practiceTelemedicineApi.js";
import { fetchPracticePatients } from "../../careRelationship/api/practicePatientsApi.js";
import { practiceDisplayName } from "../../../api/practicesApi.js";
import { partitionPracticeSessions, statusLabelKey } from "../telemedicineSessionUtils.js";
import "../../../styles/PracticeDashboardPage.css";
import "../styles/TelemedicinePages.css";
import { getPrimaryIntlLocale } from '../../../i18n/intlLocale.js';

function fmt(iso, lang) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function patientLabel(link) {
  if (!link) return "";
  const profileName = link.patientProfile?.displayName;
  if (profileName) return profileName;
  const full = [link.patient?.firstName, link.patient?.lastName].filter(Boolean).join(" ");
  if (full) return full;
  return link.patient?.email || link.id;
}

const EMPTY_FORM = { patientLinkId: "", title: "", start: "", end: "" };

export default function PracticeTelemedicinePage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceTelemedicine || getMessages("en").practiceTelemedicine,
    [language],
  );
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [patients, setPatients] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.practices) ? data.practices : [];
  }, []);

  const loadPatients = useCallback(async (pid) => {
    if (!pid) {
      setPatients([]);
      return;
    }
    try {
      const { res, data } = await fetchPracticePatients(pid, { status: "active", limit: 200 });
      if (res.ok && data.ok) {
        setPatients(Array.isArray(data.links) ? data.links : []);
      } else {
        setPatients([]);
      }
    } catch {
      setPatients([]);
    }
  }, []);

  const reload = useCallback(
    async (pid) => {
      if (!pid) return;
      setLoading(true);
      setError("");
      const { res, data } = await fetchPracticeTelemedicineSessions(pid);
      if (res.status === 404) {
        setError(t.featureDisabled);
        setSessions([]);
      } else if (!res.ok || !data.ok) {
        setError(t.loadError);
        setSessions([]);
      } else {
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      }
      setLoading(false);
    },
    [t.featureDisabled, t.loadError],
  );

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    void (async () => {
      const list = await loadPractices();
      setPractices(list);
      const pid = searchParams.get("practiceId") || list[0]?.id || "";
      setPracticeId(pid);
      if (pid) {
        await reload(pid);
        await loadPatients(pid);
      } else {
        setLoading(false);
      }
    })();
  }, [loadPractices, reload, loadPatients, searchParams]);

  const onPracticeChange = (e) => {
    const pid = e.target.value;
    setPracticeId(pid);
    setSearchParams(pid ? { practiceId: pid } : {});
    setShowCreate(false);
    setForm(EMPTY_FORM);
    setCreateError("");
    void reload(pid);
    void loadPatients(pid);
  };

  const { today, upcoming } = useMemo(
    () => partitionPracticeSessions(sessions, Date.now()),
    [sessions],
  );

  const onCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError("");
    if (!form.patientLinkId) {
      setCreateError(t.createPatientRequired);
      return;
    }
    const link = patients.find((p) => p.id === form.patientLinkId);
    if (!link) {
      setCreateError(t.createPatientRequired);
      return;
    }
    setCreating(true);
    const { res, data } = await createPracticeSession(practiceId, {
      practicePatientLinkId: link.id,
      patientUserId: link.patientUserId || null,
      title: form.title.trim() || null,
      scheduledStartAt: form.start || null,
      scheduledEndAt: form.end || null,
    });
    setCreating(false);
    if (res.ok && data.ok && data.session) {
      navigate(
        `/practice/telemedicine/${data.session.id}?practiceId=${encodeURIComponent(practiceId)}`,
      );
    } else {
      setCreateError(t.createError);
    }
  };

  return (
    <main className="telemedicine-page practice-dashboard" lang={language}>
      <nav className="telemedicine-page__toolbar" aria-label={t.heading}>
        <Link
          className="telemedicine-page__toolbar-back"
          to={`/practice?practiceId=${encodeURIComponent(practiceId)}`}
        >
          <ArrowLeft size={16} aria-hidden />
          <span>{t.backHub}</span>
        </Link>
      </nav>

      <header className="telemedicine-page__header">
        <h1>{t.heading}</h1>
        <p className="telemedicine-page__intro">{t.intro}</p>
      </header>

      <div className="telemedicine-page__field">
        <label htmlFor="tm-practice">{t.selectPractice}</label>
        <select
          id="tm-practice"
          value={practiceId}
          onChange={onPracticeChange}
          className="telemedicine-page__select"
        >
          {practices.map((p) => (
            <option key={p.id} value={p.id}>
              {practiceDisplayName(p)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p aria-live="polite">{t.loading}</p>
      ) : null}
      {error ? (
        <p role="alert" className="practice-overview__status--error">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <>
          <section
            className="telemedicine-panel telemedicine-page__section"
            aria-labelledby="tm-create-heading"
          >
            <div className="telemedicine-create__header">
              <h2 id="tm-create-heading">{t.createHeading}</h2>
              <button
                type="button"
                className={
                  showCreate
                    ? "telemedicine-btn telemedicine-btn--ghost"
                    : "telemedicine-btn telemedicine-btn--primary"
                }
                aria-expanded={showCreate}
                aria-controls="tm-create-form"
                onClick={() => {
                  setShowCreate((v) => !v);
                  setCreateError("");
                }}
              >
                {showCreate ? t.formCancel : t.createToggle}
              </button>
            </div>

            {showCreate ? (
              <>
                <div className="telemedicine-create__links">
                  <Link
                    className="telemedicine-page__toolbar-link"
                    to={`/practice/calendar?practiceId=${encodeURIComponent(practiceId)}`}
                  >
                    <Calendar size={16} aria-hidden />
                    <span>{t.openCalendar}</span>
                  </Link>
                  <Link
                    className="telemedicine-page__toolbar-link"
                    to={`/practice/settings/video?practiceId=${encodeURIComponent(practiceId)}`}
                  >
                    <Settings size={16} aria-hidden />
                    <span>{t.openSettings}</span>
                  </Link>
                </div>

                {patients.length === 0 ? (
                  <p>{t.createNoPatients}</p>
                ) : (
                  <form id="tm-create-form" className="telemedicine-form" onSubmit={onCreateSubmit}>
                  <label htmlFor="tm-create-patient">{t.createPatient}</label>
                  <select
                    id="tm-create-patient"
                    required
                    value={form.patientLinkId}
                    onChange={(e) => setForm((f) => ({ ...f, patientLinkId: e.target.value }))}
                  >
                    <option value="">{t.createPatientPlaceholder}</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {patientLabel(p)}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="tm-create-title">{t.sessionTitle}</label>
                  <input
                    id="tm-create-title"
                    type="text"
                    maxLength={200}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />

                  <label htmlFor="tm-create-start">{t.sessionStart}</label>
                  <input
                    id="tm-create-start"
                    type="datetime-local"
                    value={form.start}
                    onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                  />

                  <label htmlFor="tm-create-end">{t.sessionEnd}</label>
                  <input
                    id="tm-create-end"
                    type="datetime-local"
                    value={form.end}
                    onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                  />

                  {createError ? (
                    <p role="alert" className="practice-overview__status--error">
                      {createError}
                    </p>
                  ) : null}

                  <div className="telemedicine-actions">
                    <button
                      type="submit"
                      className="telemedicine-btn telemedicine-btn--primary"
                      disabled={creating}
                    >
                      {creating ? t.saving : t.createSession}
                    </button>
                  </div>
                </form>
                )}
              </>
            ) : null}
          </section>

          <section
            className="telemedicine-panel telemedicine-page__section"
            aria-labelledby="tm-waiting-heading"
          >
            <h2 id="tm-waiting-heading" className="telemedicine-panel__title">
              {t.waitingRoom}
            </h2>
            {today.length === 0 ? (
              <p className="telemedicine-empty">{t.noSessions}</p>
            ) : (
              <ul className="telemedicine-list">
                {today.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="telemedicine-card"
                      onClick={() =>
                        navigate(
                          `/practice/telemedicine/${s.id}?practiceId=${encodeURIComponent(practiceId)}`,
                        )
                      }
                    >
                      <strong>{s.title || s.id}</strong>
                      <div className="telemedicine-card__meta">
                        <span className="telemedicine-status" aria-label={t.status}>
                          {t[statusLabelKey(s.status)] || s.status}
                        </span>
                        {" · "}
                        {fmt(s.scheduledStartAt, language)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="telemedicine-panel telemedicine-page__section"
            aria-labelledby="tm-scheduled-heading"
          >
            <h2 id="tm-scheduled-heading" className="telemedicine-panel__title">
              {t.scheduled}
            </h2>
            {upcoming.length === 0 ? (
              <p className="telemedicine-empty">{t.noSessions}</p>
            ) : (
              <ul className="telemedicine-list">
                {upcoming.map((s) => (
                  <li key={s.id}>
                    <Link
                      className="telemedicine-card"
                      to={`/practice/telemedicine/${s.id}?practiceId=${encodeURIComponent(practiceId)}`}
                    >
                      <strong>{s.title || s.id}</strong>
                      <div className="telemedicine-card__meta">{fmt(s.scheduledStartAt, language)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
