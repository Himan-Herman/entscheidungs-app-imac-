import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { fetchBookingSettings, patchBookingSettings } from "../api/practiceBookingApi.js";
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

  // draft form state (mirrors settings once loaded)
  const [draftEnabled, setDraftEnabled] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [draftLinkId, setDraftLinkId] = useState("");

  const successTimerRef = useRef(null);

  useEffect(() => { document.title = t.pageTitle; }, [t.pageTitle]);

  useEffect(() => {
    fetchPractices().then(({ res, data }) => {
      if (res.ok && Array.isArray(data.practices)) {
        setPractices(data.practices);
        if (!practiceId && data.practices.length > 0) {
          setPracticeId(data.practices[0].id);
        }
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSettings = useCallback(async () => {
    if (!practiceId) return;
    setLoading(true);
    setLoadError("");
    setSaveSuccess(false);
    try {
      const { res, data } = await fetchBookingSettings(practiceId);
      if (res.ok && data.ok) {
        setSettings(data.settings);
        setDraftEnabled(data.settings.bookingEnabled ?? false);
        setDraftNote(data.settings.requestFormNote ?? "");
        setDraftLinkId(data.settings.linkedAnamnesisLinkId ?? "");
        return;
      }
      const code = data?.error || "";
      if (res.status === 401) { setLoadError(t.loadErrorUnauthorized); return; }
      if (res.status === 404 || code === "feature_disabled") {
        setLoadError(t.featureDisabled);
        return;
      }
      if (res.status >= 500) { setLoadError(t.loadErrorServer); return; }
      setLoadError(t.loadError);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setLoadError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [practiceId, t]);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  useEffect(() => () => { clearTimeout(successTimerRef.current); }, []);

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

  const noteCharsLeft = MAX_NOTE_CHARS - draftNote.length;
  const isDirty =
    settings != null &&
    (draftEnabled !== settings.bookingEnabled ||
      (draftNote.trim() || null) !== (settings.requestFormNote || null) ||
      (draftLinkId.trim() || null) !== (settings.linkedAnamnesisLinkId || null));

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
      )}
    </div>
  );
}
