import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchBookingSettings, patchBookingSettings } from "../api/practiceBookingApi.js";
import {
  createAvailability,
  deleteAvailability,
  fetchAppointmentTypes,
  fetchAvailability,
} from "../../practiceCalendar/api/practiceCalendarApi.js";
import { fetchPractices } from "../../../api/practicesApi.js";
import "../styles/PracticeBookingHubPage.css";

const MAX_NOTE_CHARS = 300;

export default function PracticeBookingHubPage() {
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceBooking || getMessages("en").practiceBooking,
    [language],
  );

  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(searchParams.get("practiceId") || "");
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [draftEnabled, setDraftEnabled] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [draftLinkId, setDraftLinkId] = useState("");

  const [types, setTypes] = useState([]);

  const [availability, setAvailability] = useState([]);
  const [avWeekday, setAvWeekday] = useState(1);
  const [avStart, setAvStart] = useState("09:00");
  const [avEnd, setAvEnd] = useState("17:00");
  const [avBusy, setAvBusy] = useState(false);
  const [avMsg, setAvMsg] = useState("");
  const [avErr, setAvErr] = useState("");

  const successTimerRef = useRef(null);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    fetchPractices()
      .then(({ res, data }) => {
        if (res.ok && Array.isArray(data.practices)) {
          setPractices(data.practices);
          if (!practiceId && data.practices.length > 0) {
            setPracticeId(data.practices[0].id);
          }
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSettings = useCallback(async () => {
    if (!practiceId) return;
    setLoading(true);
    setLoadError("");
    setSaveSuccess(false);
    try {
      const [settingsResult, typesResult, availResult] = await Promise.all([
        fetchBookingSettings(practiceId),
        fetchAppointmentTypes(practiceId).catch(() => ({ res: { ok: false }, data: {} })),
        fetchAvailability(practiceId).catch(() => ({ res: { ok: false }, data: {} })),
      ]);
      const { res, data } = settingsResult;
      if (typesResult.res.ok) setTypes(typesResult.data.types || []);
      if (availResult.res.ok) setAvailability(availResult.data.availability || []);
      if (res.status === 401) { setLoadError(t.loadErrorUnauthorized); return; }
      if (res.status === 404 || data?.error === "feature_disabled") {
        setLoadError(t.featureDisabled);
        return;
      }
      if (res.status >= 500) { setLoadError(t.loadErrorServer); return; }
      if (!res.ok || !data.ok) { setLoadError(t.loadError); return; }
      setSettings(data.settings);
      setDraftEnabled(data.settings.bookingEnabled ?? false);
      setDraftNote(data.settings.requestFormNote ?? "");
      setDraftLinkId(data.settings.linkedAnamnesisLinkId ?? "");
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setLoadError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, t]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => () => {
    clearTimeout(successTimerRef.current);
  }, []);

  const canManage = settings?.canManage ?? false;

  async function handleSave(e) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    const body = {
      bookingEnabled: draftEnabled,
      requestFormNote: draftNote.trim() || null,
      linkedAnamnesisLinkId: draftLinkId.trim() || null,
    };
    try {
      const { res, data } = await patchBookingSettings(practiceId, body);
      if (res.ok && data.ok) {
        setSettings(data.settings);
        setDraftEnabled(data.settings.bookingEnabled ?? false);
        setDraftNote(data.settings.requestFormNote ?? "");
        setDraftLinkId(data.settings.linkedAnamnesisLinkId ?? "");
        setSaveSuccess(true);
        clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setSaveSuccess(false), 3500);
        return;
      }
      const code = data?.error || "";
      if (code === "booking_mode_conflict") { setSaveError(t.errorBookingModeConflict); return; }
      if (code === "anamnesis_link_not_found") { setSaveError(t.errorAnamnesisLinkNotFound); return; }
      if (code === "anamnesis_link_inactive") { setSaveError(t.errorAnamnesisLinkInactive); return; }
      if (code === "anamnesis_link_expired") { setSaveError(t.errorAnamnesisLinkExpired); return; }
      setSaveError(t.saveError);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setSaveError(t.saveError);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (!settings) return;
    setDraftEnabled(settings.bookingEnabled ?? false);
    setDraftNote(settings.requestFormNote ?? "");
    setDraftLinkId(settings.linkedAnamnesisLinkId ?? "");
    setSaveError("");
    setSaveSuccess(false);
  }

  async function handleAddAvailability(e) {
    e.preventDefault();
    if (!avStart || !avEnd) return;
    setAvBusy(true);
    setAvErr("");
    setAvMsg("");
    try {
      const { res } = await createAvailability(practiceId, {
        weekday: avWeekday,
        startTime: avStart,
        endTime: avEnd,
        timezone: "Europe/Berlin",
      });
      if (!res.ok) { setAvErr(t.actionError); return; }
      setAvMsg(t.availabilityAdded);
      const { res: ar, data: ad } = await fetchAvailability(practiceId);
      if (ar.ok) setAvailability(ad.availability || []);
    } catch {
      setAvErr(t.actionError);
    } finally {
      setAvBusy(false);
    }
  }

  async function handleRemoveAvailability(id) {
    setAvBusy(true);
    setAvErr("");
    setAvMsg("");
    try {
      const { res } = await deleteAvailability(practiceId, id);
      if (!res.ok) { setAvErr(t.actionError); return; }
      setAvMsg(t.availabilityRemoved);
      setAvailability((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setAvErr(t.actionError);
    } finally {
      setAvBusy(false);
    }
  }

  const noteCharsLeft = MAX_NOTE_CHARS - draftNote.length;
  const isDirty =
    settings != null &&
    (draftEnabled !== settings.bookingEnabled ||
      (draftNote.trim() || null) !== (settings.requestFormNote || null) ||
      (draftLinkId.trim() || null) !== (settings.linkedAnamnesisLinkId || null));

  const weekdays = Array.isArray(t.weekdays) ? t.weekdays : [];

  return (
    <div className="booking-hub">
      <nav className="booking-hub__top-nav" aria-label="navigation">
        <Link className="booking-hub__back-link" to="/practice/hub">
          ← {t.backHub}
        </Link>
      </nav>

      <header className="booking-hub__header">
        <h1 className="booking-hub__heading">{t.heading}</h1>
        <p className="booking-hub__intro">{t.intro}</p>
      </header>

      <div className="booking-hub__toolbar">
        <label className="booking-hub__select-label" htmlFor="booking-practice-select">
          {t.selectPractice}
        </label>
        <select
          id="booking-practice-select"
          className="booking-hub__select"
          value={practiceId}
          onChange={(e) => setPracticeId(e.target.value)}
        >
          {practices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.practiceName || p.id}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="booking-hub__status">{t.loading}</p>}

      {loadError && (
        <p className="booking-hub__status booking-hub__status--error" role="alert">
          {loadError}
        </p>
      )}

      {!loading && !loadError && settings && (
        <>
          <form onSubmit={(e) => void handleSave(e)} noValidate>
            {/* ── Activation ──────────────────────────────────────────────── */}
            <div className="booking-hub__card">
              <h2 className="booking-hub__section-title">{t.sectionActivation}</h2>
              <div className="booking-hub__toggle-row">
                <div className="booking-hub__toggle-label">
                  <div className="booking-hub__toggle-label-text">{t.bookingEnabledLabel}</div>
                  <div className="booking-hub__toggle-hint">{t.bookingEnabledHint}</div>
                </div>
                <label
                  className="booking-hub__toggle"
                  aria-label={draftEnabled ? t.bookingEnabledOn : t.bookingEnabledOff}
                >
                  <input
                    type="checkbox"
                    checked={draftEnabled}
                    disabled={!canManage || saving}
                    onChange={(e) => setDraftEnabled(e.target.checked)}
                  />
                  <span className="booking-hub__toggle-slider" aria-hidden="true" />
                </label>
              </div>
            </div>

            {/* ── Request note ────────────────────────────────────────────── */}
            <div className="booking-hub__card">
              <h2 className="booking-hub__section-title">{t.sectionRequestNote}</h2>
              <div className="booking-hub__field">
                <label className="booking-hub__field-label" htmlFor="booking-request-note">
                  {t.requestFormNoteLabel}
                </label>
                <textarea
                  id="booking-request-note"
                  className="booking-hub__textarea"
                  value={draftNote}
                  placeholder={t.requestFormNotePlaceholder}
                  maxLength={MAX_NOTE_CHARS}
                  disabled={!canManage || saving}
                  onChange={(e) => setDraftNote(e.target.value)}
                />
                <div className="booking-hub__field-hint">
                  {t.requestFormNoteHint}
                  {" · "}
                  {(t.requestFormNoteCharsLeft || "{{n}} left").replace("{{n}}", noteCharsLeft)}
                </div>
              </div>
            </div>

            {/* ── Anamnesis link ───────────────────────────────────────────── */}
            <div className="booking-hub__card">
              <h2 className="booking-hub__section-title">{t.sectionAnamnesis}</h2>
              <div className="booking-hub__field">
                <label className="booking-hub__field-label" htmlFor="booking-anamnesis-link">
                  {t.linkedAnamnesisLabel}
                </label>
                <div className="booking-hub__linked-row">
                  <input
                    id="booking-anamnesis-link"
                    type="text"
                    className="booking-hub__input"
                    value={draftLinkId}
                    placeholder={t.linkedAnamnesisPlaceholder}
                    disabled={!canManage || saving}
                    onChange={(e) => setDraftLinkId(e.target.value)}
                  />
                  {draftLinkId && canManage && (
                    <button
                      type="button"
                      className="booking-hub__btn--ghost"
                      onClick={() => setDraftLinkId("")}
                      disabled={saving}
                    >
                      {t.linkedAnamnesisRemove}
                    </button>
                  )}
                </div>
                <div className="booking-hub__field-hint">{t.linkedAnamnesisHint}</div>
              </div>
            </div>

            {/* ── Save / feedback ─────────────────────────────────────────── */}
            {canManage && (
              <div className="booking-hub__actions">
                <button
                  type="submit"
                  className="booking-hub__btn"
                  disabled={saving || !isDirty}
                >
                  {saving ? t.saving : t.save}
                </button>
                {isDirty && !saving && (
                  <button
                    type="button"
                    className="booking-hub__btn booking-hub__btn--outline"
                    onClick={handleCancel}
                  >
                    {t.cancel}
                  </button>
                )}
              </div>
            )}

            {saveError && (
              <p className="booking-hub__status booking-hub__status--error" role="alert">
                {saveError}
              </p>
            )}
            {saveSuccess && (
              <p className="booking-hub__status booking-hub__status--success" role="status">
                {t.saved}
              </p>
            )}

            {!canManage && (
              <p className="booking-hub__readonly-notice" role="note">
                {t.readOnly}
              </p>
            )}
          </form>

          {/* ── Appointment types ─────────────────────────────────────────── */}
          <section className="booking-hub__card" aria-labelledby="bh-types-heading">
            <h2 id="bh-types-heading" className="booking-hub__section-title">
              {t.sectionTypes}
            </h2>
            <p className="booking-hub__field-hint">{t.typesHint}</p>
            {types.length === 0 ? (
              <p className="booking-hub__status">{t.typesEmpty}</p>
            ) : (
              <ul className="booking-hub__list" aria-label={t.sectionTypes}>
                {types.map((type) => (
                  <li key={type.id} className="booking-hub__list-item">
                    {type.color && (
                      <span
                        className="booking-hub__color-dot"
                        style={{ background: type.color }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="booking-hub__list-item-name">{type.name}</span>
                    <span className="booking-hub__badge">
                      {type.durationMinutes}&thinsp;{t.typeDurationMin}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Availability windows ──────────────────────────────────────── */}
          <section className="booking-hub__card" aria-labelledby="bh-avail-heading">
            <h2 id="bh-avail-heading" className="booking-hub__section-title">
              {t.sectionAvailability}
            </h2>
            <p className="booking-hub__field-hint">{t.availabilityHint}</p>

            {avMsg && (
              <p className="booking-hub__status booking-hub__status--success" role="status">
                {avMsg}
              </p>
            )}
            {avErr && (
              <p className="booking-hub__status booking-hub__status--error" role="alert">
                {avErr}
              </p>
            )}

            {availability.length === 0 ? (
              <p className="booking-hub__status">{t.availabilityEmpty}</p>
            ) : (
              <ul className="booking-hub__list" aria-label={t.sectionAvailability}>
                {availability.map((a) => (
                  <li key={a.id} className="booking-hub__list-item">
                    <span className="booking-hub__list-item-name">
                      {weekdays[a.weekday] ?? a.weekday}
                    </span>
                    <span className="booking-hub__badge">
                      {a.startTime}–{a.endTime}
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        className="booking-hub__btn--ghost booking-hub__btn--remove"
                        disabled={avBusy}
                        aria-label={`${t.removeAvailability}: ${weekdays[a.weekday] ?? a.weekday} ${a.startTime}–${a.endTime}`}
                        onClick={() => handleRemoveAvailability(a.id)}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canManage && (
              <form
                className="booking-hub__av-form"
                onSubmit={(e) => void handleAddAvailability(e)}
                aria-label={t.addAvailability}
                noValidate
              >
                <div className="booking-hub__av-form-fields">
                  <div className="booking-hub__field">
                    <label className="booking-hub__field-label" htmlFor="av-weekday">
                      {t.weekday}
                    </label>
                    <select
                      id="av-weekday"
                      className="booking-hub__select"
                      value={avWeekday}
                      disabled={avBusy}
                      onChange={(e) => setAvWeekday(Number(e.target.value))}
                    >
                      {weekdays.map((day, i) => (
                        <option key={i} value={i}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="booking-hub__field">
                    <label className="booking-hub__field-label" htmlFor="av-start">
                      {t.startTime}
                    </label>
                    <input
                      id="av-start"
                      type="time"
                      className="booking-hub__input"
                      value={avStart}
                      disabled={avBusy}
                      required
                      onChange={(e) => setAvStart(e.target.value)}
                    />
                  </div>
                  <div className="booking-hub__field">
                    <label className="booking-hub__field-label" htmlFor="av-end">
                      {t.endTime}
                    </label>
                    <input
                      id="av-end"
                      type="time"
                      className="booking-hub__input"
                      value={avEnd}
                      disabled={avBusy}
                      required
                      onChange={(e) => setAvEnd(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="booking-hub__btn"
                  disabled={avBusy || !avStart || !avEnd}
                >
                  {t.addAvailability}
                </button>
              </form>
            )}
          </section>
        </>
      )}
    </div>
  );
}
