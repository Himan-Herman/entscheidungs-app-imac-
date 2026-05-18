import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authFetch } from "../../../api/authFetch.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  cancelAppointment,
  createAppointment,
  fetchAppointments,
  fetchAppointmentTypes,
  patchAppointment,
  rescheduleAppointment,
} from "../api/practiceCalendarApi.js";
import "../../../styles/PracticeDashboardPage.css";
import "../styles/PracticeCalendarPage.css";

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

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const VIEWS = ["list", "day", "week", "month"];

export default function PracticeCalendarPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceCalendar || getMessages("en").practiceCalendar,
    [language],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(() => searchParams.get("practiceId") || "");
  const [view, setView] = useState("list");
  const [statusFilter, setStatusFilter] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [types, setTypes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [canManage, setCanManage] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    startAt: "",
    endAt: "",
    locationType: "practice",
    practicePatientLinkId: "",
    practiceNote: "",
  });
  const [busy, setBusy] = useState(false);

  const loadPractices = useCallback(async () => {
    const res = await authFetch("/api/practices");
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.practices) ? data.practices : [];
  }, []);

  const reload = useCallback(async (pid) => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - (view === "month" ? 30 : 7));
    const to = new Date(now);
    to.setDate(to.getDate() + (view === "month" ? 60 : 14));
    const params = {
      from: from.toISOString(),
      to: to.toISOString(),
    };
    if (statusFilter) params.status = statusFilter;
    const [{ res, data }, typesRes] = await Promise.all([
      fetchAppointments(pid, params),
      fetchAppointmentTypes(pid),
    ]);
    if (res.status === 404 && data.error === "feature_disabled") throw new Error("feature_disabled");
    if (!res.ok) throw new Error(data.error || "load_failed");
    setAppointments(data.appointments || []);
    if (typesRes.res.ok) setTypes(typesRes.data.types || []);
  }, [statusFilter, view]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const list = await loadPractices();
        if (cancelled) return;
        setPractices(list);
        const pid =
          practiceId && list.some((p) => p.id === practiceId) ? practiceId : list[0]?.id || "";
        setPracticeId(pid);
        if (pid) {
          setSearchParams({ practiceId: pid }, { replace: true });
          await reload(pid);
        }
      } catch (e) {
        if (!cancelled) setError(t.errors?.[e.message] || t.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPractices, practiceId, reload, setSearchParams, t]);

  useEffect(() => {
    if (!practiceId) return;
    reload(practiceId).catch(() => {});
  }, [practiceId, statusFilter, view, reload]);

  const onSelect = (appt) => {
    setSelected(appt);
    setForm({
      title: appt.title || "",
      startAt: toLocalInput(appt.startAt),
      endAt: toLocalInput(appt.endAt),
      locationType: appt.locationType || "practice",
      practicePatientLinkId: appt.practicePatientLinkId || "",
      practiceNote: appt.practiceNote || "",
    });
    setShowForm(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError("");
    try {
      const { res, data } = await createAppointment(practiceId, {
        title: form.title,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        locationType: form.locationType,
        practicePatientLinkId: form.practicePatientLinkId || undefined,
        practiceNote: form.practiceNote || undefined,
        status: "scheduled",
      });
      if (!res.ok) throw new Error(data.error || "failed");
      await reload(practiceId);
      setStatusMsg(t.saved);
      setShowForm(false);
      onSelect(data.appointment);
    } catch (err) {
      setError(t.errors?.[err.message] || t.loadError);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!selected || !canManage) return;
    setBusy(true);
    try {
      const { res, data } = await patchAppointment(practiceId, selected.id, {
        title: form.title,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        locationType: form.locationType,
        practicePatientLinkId: form.practicePatientLinkId || null,
        practiceNote: form.practiceNote,
      });
      if (!res.ok) throw new Error(data.error || "failed");
      await reload(practiceId);
      onSelect(data.appointment);
      setStatusMsg(t.saved);
    } catch (err) {
      setError(t.errors?.[err.message] || t.loadError);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!selected || !canManage) return;
    setBusy(true);
    try {
      const { res } = await cancelAppointment(practiceId, selected.id, {});
      if (!res.ok) throw new Error("failed");
      await reload(practiceId);
      setSelected(null);
      setStatusMsg(t.saved);
    } catch {
      setError(t.loadError);
    } finally {
      setBusy(false);
    }
  };

  const handleReschedule = async () => {
    if (!selected || !canManage) return;
    setBusy(true);
    try {
      const { res, data } = await rescheduleAppointment(practiceId, selected.id, {
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
      });
      if (!res.ok) throw new Error(data.error || "failed");
      await reload(practiceId);
      onSelect(data.appointment);
      setStatusMsg(t.saved);
    } catch {
      setError(t.loadError);
    } finally {
      setBusy(false);
    }
  };

  const weekCells = useMemo(() => {
    if (view !== "week") return [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dayAppts = appointments.filter((a) => {
        const s = new Date(a.startAt);
        return s.toDateString() === d.toDateString();
      });
      return { date: d, appointments: dayAppts };
    });
  }, [appointments, view]);

  return (
    <main className="practice-dashboard practice-calendar" aria-labelledby="practice-calendar-heading">
      <header className="practice-dashboard__header">
        <p className="practice-dashboard__eyebrow">
          <Link to={`/practice/hub?practiceId=${encodeURIComponent(practiceId)}`}>{t.backHub}</Link>
        </p>
        <h1 id="practice-calendar-heading">{t.heading}</h1>
        <p>{t.intro}</p>
      </header>

      <div className="practice-dashboard__toolbar">
        <label htmlFor="cal-practice-select">{t.selectPractice}</label>
        <select
          id="cal-practice-select"
          value={practiceId}
          onChange={(e) => {
            setPracticeId(e.target.value);
            setSearchParams({ practiceId: e.target.value }, { replace: true });
          }}
        >
          {practices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.practiceName}
            </option>
          ))}
        </select>
      </div>

      <div className="practice-calendar__toolbar" role="toolbar" aria-label={t.heading}>
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            className="practice-calendar__view-btn"
            aria-pressed={view === v}
            onClick={() => setView(v)}
          >
            {t[`view${v.charAt(0).toUpperCase()}${v.slice(1)}`]}
          </button>
        ))}
        <select
          aria-label={t.filterStatus}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t.allStatuses}</option>
          {["requested", "scheduled", "confirmed", "cancelled", "completed"].map((s) => (
            <option key={s} value={s}>
              {t[`status_${s}`]}
            </option>
          ))}
        </select>
        {canManage ? (
          <>
            <button
              type="button"
              className="practice-calendar__btn practice-calendar__btn--primary"
              onClick={() => {
                setShowForm(true);
                setSelected(null);
                setForm({
                  title: "",
                  startAt: toLocalInput(new Date()),
                  endAt: toLocalInput(new Date(Date.now() + 30 * 60000)),
                  locationType: "practice",
                  practicePatientLinkId: "",
                  practiceNote: "",
                });
              }}
            >
              {t.createAppointment}
            </button>
            <Link
              className="practice-calendar__btn"
              to={`/practice/calendar/settings?practiceId=${encodeURIComponent(practiceId)}`}
            >
              {t.openSettings}
            </Link>
          </>
        ) : (
          <p>{t.readOnly}</p>
        )}
      </div>

      {loading ? (
        <p aria-live="polite">{t.loading}</p>
      ) : null}
      {error ? (
        <p role="alert" className="practice-overview__status--error">
          {error}
        </p>
      ) : null}
      {statusMsg ? (
        <p aria-live="polite">{statusMsg}</p>
      ) : null}

      <div className="practice-calendar__layout">
        <section aria-label={t.heading}>
          {view === "week" ? (
            <div className="practice-calendar__week-grid" aria-hidden={false}>
              {weekCells.map((cell) => (
                <div key={cell.date.toISOString()} className="practice-calendar__week-cell">
                  <strong>
                    {t.weekdays[cell.date.getDay()]} {cell.date.getDate()}
                  </strong>
                  <ul className="practice-calendar__list">
                    {cell.appointments.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          className="practice-calendar__card"
                          onClick={() => onSelect(a)}
                        >
                          {a.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="practice-calendar__list">
              {appointments.length === 0 ? (
                <li>{t.noAppointments}</li>
              ) : (
                appointments.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className={`practice-calendar__card${selected?.id === a.id ? " practice-calendar__card--selected" : ""}`}
                      onClick={() => onSelect(a)}
                      aria-current={selected?.id === a.id ? "true" : undefined}
                    >
                      <strong>{a.title}</strong>
                      <div>{fmt(a.startAt, language)}</div>
                      <span className="practice-calendar__status">{t[`status_${a.status}`] || a.status}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </section>

        <aside className="practice-calendar__panel" aria-label={showForm ? t.createAppointment : t.selectAppointment}>
          {showForm ? (
            <form className="practice-calendar__form" onSubmit={handleCreate}>
              <label htmlFor="cal-title">{t.title}</label>
              <input
                id="cal-title"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <label htmlFor="cal-start">{t.start}</label>
              <input
                id="cal-start"
                type="datetime-local"
                required
                value={form.startAt}
                onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
              />
              <label htmlFor="cal-end">{t.end}</label>
              <input
                id="cal-end"
                type="datetime-local"
                required
                value={form.endAt}
                onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
              />
              <label htmlFor="cal-link">{t.linkId}</label>
              <input
                id="cal-link"
                value={form.practicePatientLinkId}
                onChange={(e) => setForm((f) => ({ ...f, practicePatientLinkId: e.target.value }))}
              />
              <div className="practice-calendar__actions">
                <button type="submit" className="practice-calendar__btn practice-calendar__btn--primary" disabled={busy}>
                  {t.save}
                </button>
                <button type="button" className="practice-calendar__btn" onClick={() => setShowForm(false)}>
                  {t.cancel}
                </button>
              </div>
            </form>
          ) : selected ? (
            <div className="practice-calendar__form">
              <h2>{t.editAppointment}</h2>
              <label htmlFor="cal-edit-title">{t.title}</label>
              <input
                id="cal-edit-title"
                value={form.title}
                disabled={!canManage}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <label htmlFor="cal-edit-start">{t.start}</label>
              <input
                id="cal-edit-start"
                type="datetime-local"
                disabled={!canManage}
                value={form.startAt}
                onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
              />
              <label htmlFor="cal-edit-end">{t.end}</label>
              <input
                id="cal-edit-end"
                type="datetime-local"
                disabled={!canManage}
                value={form.endAt}
                onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
              />
              <p>
                <strong>{t.status}:</strong> {t[`status_${selected.status}`] || selected.status}
              </p>
              {selected.preVisitUrl ? (
                <p>
                  <Link to={selected.preVisitUrl}>{t.openPreparation}</Link>
                </p>
              ) : null}
              {selected.telemedicineSessionId ? (
                <p>
                  <Link
                    to={`/practice/telemedicine/${selected.telemedicineSessionId}?practiceId=${encodeURIComponent(practiceId)}`}
                  >
                    {(getMessages(language).practiceTelemedicine || getMessages("en").practiceTelemedicine)
                      .openVideoFromCalendar}
                  </Link>
                </p>
              ) : null}
              {canManage ? (
                <div className="practice-calendar__actions">
                  <button type="button" className="practice-calendar__btn practice-calendar__btn--primary" disabled={busy} onClick={handleSave}>
                    {t.save}
                  </button>
                  <button type="button" className="practice-calendar__btn" disabled={busy} onClick={handleReschedule}>
                    {t.rescheduleAppointment}
                  </button>
                  <button type="button" className="practice-calendar__btn" disabled={busy} onClick={handleCancel}>
                    {t.cancelAppointment}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p>{t.selectAppointment}</p>
          )}
        </aside>
      </div>
    </main>
  );
}
