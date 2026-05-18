import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  createAvailability,
  deleteAvailability,
  fetchAppointmentTypes,
  fetchAvailability,
} from "../api/practiceCalendarApi.js";
import "../../../styles/PracticeDashboardPage.css";
import "../styles/PracticeCalendarPage.css";

export default function PracticeCalendarSettingsPage() {
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceCalendar || getMessages("en").practiceCalendar,
    [language],
  );
  const [searchParams] = useSearchParams();
  const practiceId = searchParams.get("practiceId") || "";
  const [types, setTypes] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  const load = useCallback(async () => {
    if (!practiceId) return;
    setLoading(true);
    try {
      const [tr, ar] = await Promise.all([
        fetchAppointmentTypes(practiceId),
        fetchAvailability(practiceId),
      ]);
      if (!tr.res.ok) throw new Error(tr.data.error || "load_failed");
      setTypes(tr.data.types || []);
      if (ar.res.ok) setAvailability(ar.data.availability || []);
    } catch (e) {
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, t.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const addSlot = async () => {
    const { res } = await createAvailability(practiceId, {
      weekday: Number(weekday),
      startTime,
      endTime,
      timezone: "Europe/Berlin",
    });
    if (res.ok) await load();
    else setError(t.loadError);
  };

  const removeSlot = async (id) => {
    const { res } = await deleteAvailability(practiceId, id);
    if (res.ok) await load();
  };

  return (
    <main className="practice-dashboard practice-calendar" aria-labelledby="cal-settings-heading">
      <header className="practice-dashboard__header">
        <p className="practice-dashboard__eyebrow">
          <Link to={`/practice/calendar?practiceId=${encodeURIComponent(practiceId)}`}>
            {t.backCalendar}
          </Link>
        </p>
        <h1 id="cal-settings-heading">{t.settingsHeading}</h1>
      </header>

      {loading ? <p aria-live="polite">{t.loading}</p> : null}
      {error ? (
        <p role="alert">{error}</p>
      ) : null}

      <section className="practice-calendar__panel" aria-labelledby="types-heading">
        <h2 id="types-heading">{t.sectionTypes}</h2>
        <ul>
          {types.map((type) => (
            <li key={type.id}>
              {type.name} — {type.durationMinutes} min
            </li>
          ))}
        </ul>
      </section>

      <section className="practice-calendar__panel" aria-labelledby="avail-heading">
        <h2 id="avail-heading">{t.sectionAvailability}</h2>
        <div className="practice-calendar__form">
          <label htmlFor="avail-weekday">{t.weekday}</label>
          <select
            id="avail-weekday"
            value={weekday}
            onChange={(e) => setWeekday(e.target.value)}
          >
            {t.weekdays.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
          <label htmlFor="avail-start">{t.startTime}</label>
          <input
            id="avail-start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <label htmlFor="avail-end">{t.endTime}</label>
          <input
            id="avail-end"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <button type="button" className="practice-calendar__btn practice-calendar__btn--primary" onClick={addSlot}>
            {t.addAvailability}
          </button>
        </div>
        <ul>
          {availability.map((a) => (
            <li key={a.id}>
              {t.weekdays[a.weekday]} {a.startTime}–{a.endTime}
              <button type="button" className="practice-calendar__btn" onClick={() => removeSlot(a.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
