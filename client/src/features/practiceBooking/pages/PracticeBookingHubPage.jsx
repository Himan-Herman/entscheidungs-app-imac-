import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  fetchBookingSettings,
  patchBookingSettings,
  fetchBookingRequests,
  acceptBookingRequest,
  declineBookingRequest,
} from "../api/practiceBookingApi.js";
import { fetchPractices } from "../../../api/practicesApi.js";
import "../styles/PracticeBookingHubPage.css";

const MAX_NOTE_CHARS = 300;

function toDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtDt(iso, lang) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  const locale =
    lang === "de" ? "de-DE"
    : lang === "fr" ? "fr-FR"
    : lang === "it" ? "it-IT"
    : lang === "es" ? "es-ES"
    : "en-GB";
  return d.toLocaleString(locale, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function PracticeBookingHubPage() {
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const t = useMemo(
    () => getMessages(language).practiceBooking || getMessages("en").practiceBooking,
    [language],
  );

  // ── practice list ────────────────────────────────────────────────────────────
  const [practices, setPractices] = useState([]);
  const [practiceId, setPracticeId] = useState(searchParams.get("practiceId") || "");

  // ── settings state ───────────────────────────────────────────────────────────
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [draftEnabled, setDraftEnabled] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [draftLinkId, setDraftLinkId] = useState("");

  // ── tab state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("settings");

  // ── requests state ───────────────────────────────────────────────────────────
  const [requests, setRequests] = useState([]);
  const [canManageRequests, setCanManageRequests] = useState(false);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState("");

  // ── action (accept / decline) state ─────────────────────────────────────────
  const [actingId, setActingId] = useState(null);
  const [actingMode, setActingMode] = useState(null); // "accept" | "decline"
  const [acceptStart, setAcceptStart] = useState("");
  const [acceptEnd, setAcceptEnd] = useState("");
  const [acceptNote, setAcceptNote] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const successTimerRef = useRef(null);

  useEffect(() => { document.title = t.pageTitle; }, [t.pageTitle]);

  // ── load practice list ───────────────────────────────────────────────────────
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

  // ── load settings ────────────────────────────────────────────────────────────
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
      if (res.status === 404 || code === "feature_disabled") { setLoadError(t.featureDisabled); return; }
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

  // ── load requests ────────────────────────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    if (!practiceId) return;
    setReqLoading(true);
    setReqError("");
    try {
      const { res, data } = await fetchBookingRequests(practiceId);
      if (res.ok && data.ok) {
        setRequests(data.requests ?? []);
        setCanManageRequests(data.canManage ?? false);
        return;
      }
      setReqError(t.reqLoadError);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setReqError(t.reqLoadError);
    } finally {
      setReqLoading(false);
    }
  }, [practiceId, t]);

  useEffect(() => {
    if (activeTab === "requests") void loadRequests();
  }, [activeTab, loadRequests]);

  // ── settings save ────────────────────────────────────────────────────────────
  const canManageSettings = settings?.canManage ?? false;

  async function handleSave(e) {
    e.preventDefault();
    if (!canManageSettings) return;
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

  // ── request action helpers ───────────────────────────────────────────────────
  function startAccept(req) {
    setActingId(req.id);
    setActingMode("accept");
    setAcceptStart(toDatetimeLocal(req.requestedStartAt || req.startAt));
    setAcceptEnd(toDatetimeLocal(req.requestedEndAt || req.endAt));
    setAcceptNote("");
    setActionError("");
  }

  function startDecline(req) {
    setActingId(req.id);
    setActingMode("decline");
    setDeclineReason("");
    setActionError("");
  }

  function cancelAction() {
    setActingId(null);
    setActingMode(null);
    setActionError("");
  }

  async function handleAccept(e) {
    e.preventDefault();
    if (!acceptStart || !acceptEnd) { setActionError(t.reqAcceptInvalidTime); return; }
    const startIso = new Date(acceptStart).toISOString();
    const endIso = new Date(acceptEnd).toISOString();
    if (new Date(endIso) <= new Date(startIso)) { setActionError(t.reqAcceptInvalidTime); return; }
    setActionSaving(true);
    setActionError("");
    try {
      const { res, data } = await acceptBookingRequest(practiceId, actingId, {
        startAt: startIso,
        endAt: endIso,
        ...(acceptNote.trim() ? { practiceNote: acceptNote.trim() } : {}),
      });
      if (res.ok && data.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== actingId));
        cancelAction();
        return;
      }
      const code = data?.error || "";
      setActionError(code === "not_a_request" ? t.reqErrorNotARequest : t.reqAcceptError);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setActionError(t.reqAcceptError);
    } finally {
      setActionSaving(false);
    }
  }

  async function handleDecline(e) {
    e.preventDefault();
    setActionSaving(true);
    setActionError("");
    try {
      const { res, data } = await declineBookingRequest(practiceId, actingId, {
        ...(declineReason.trim() ? { reason: declineReason.trim() } : {}),
      });
      if (res.ok && data.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== actingId));
        cancelAction();
        return;
      }
      const code = data?.error || "";
      setActionError(code === "not_a_request" ? t.reqErrorNotARequest : t.reqDeclineError);
    } catch (e) {
      if (e?.message === "SESSION_EXPIRED") return;
      setActionError(t.reqDeclineError);
    } finally {
      setActionSaving(false);
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────
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
          {/* ── Tab bar ─────────────────────────────────────────────────── */}
          <div className="booking-hub__tabs" role="tablist" aria-label={t.heading}>
            <button
              role="tab"
              id="tab-settings"
              aria-selected={activeTab === "settings"}
              aria-controls="tabpanel-settings"
              className={`booking-hub__tab${activeTab === "settings" ? " booking-hub__tab--active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              {t.tabSettings}
            </button>
            <button
              role="tab"
              id="tab-requests"
              aria-selected={activeTab === "requests"}
              aria-controls="tabpanel-requests"
              className={`booking-hub__tab${activeTab === "requests" ? " booking-hub__tab--active" : ""}`}
              onClick={() => setActiveTab("requests")}
            >
              {t.tabRequests}
              {requests.length > 0 && (
                <span className="booking-hub__tab-badge" aria-hidden="true">
                  {requests.length}
                </span>
              )}
            </button>
          </div>

          {/* ── Settings tab ────────────────────────────────────────────── */}
          {activeTab === "settings" && (
            <div role="tabpanel" id="tabpanel-settings" aria-labelledby="tab-settings">
              <form onSubmit={(e) => void handleSave(e)} noValidate>
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
                        disabled={!canManageSettings || saving}
                        onChange={(e) => setDraftEnabled(e.target.checked)}
                      />
                      <span className="booking-hub__toggle-slider" aria-hidden="true" />
                    </label>
                  </div>
                </div>

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
                      disabled={!canManageSettings || saving}
                      onChange={(e) => setDraftNote(e.target.value)}
                    />
                    <div className="booking-hub__field-hint">
                      {t.requestFormNoteHint}
                      {" · "}
                      {(t.requestFormNoteCharsLeft || "{{n}} left").replace("{{n}}", noteCharsLeft)}
                    </div>
                  </div>
                </div>

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
                        disabled={!canManageSettings || saving}
                        onChange={(e) => setDraftLinkId(e.target.value)}
                      />
                      {draftLinkId && canManageSettings && (
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

                {canManageSettings && (
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
                {!canManageSettings && (
                  <p className="booking-hub__readonly-notice" role="note">
                    {t.readOnly}
                  </p>
                )}
              </form>
            </div>
          )}

          {/* ── Requests tab ────────────────────────────────────────────── */}
          {activeTab === "requests" && (
            <div role="tabpanel" id="tabpanel-requests" aria-labelledby="tab-requests">
              {reqLoading && (
                <p className="booking-hub__status" aria-busy="true">{t.reqLoading}</p>
              )}
              {reqError && (
                <p className="booking-hub__status booking-hub__status--error" role="alert">
                  {reqError}
                </p>
              )}

              {!reqLoading && !reqError && (
                <>
                  {!canManageRequests && (
                    <p className="booking-hub__readonly-notice" role="note">
                      {t.reqReadOnly}
                    </p>
                  )}

                  {requests.length === 0 ? (
                    <p className="booking-hub__status">{t.reqEmpty}</p>
                  ) : (
                    <ul className="booking-hub__req-list">
                      {requests.map((req) => (
                        <li key={req.id} className="booking-hub__req-card">
                          {/* Card header */}
                          <div className="booking-hub__req-header">
                            <span className="booking-hub__req-title">{req.title}</span>
                            <span
                              className={`booking-hub__req-badge booking-hub__req-badge--${req.status}`}
                            >
                              {t[`reqBadge_${req.status}`] || req.status}
                            </span>
                          </div>

                          {/* Card details */}
                          <dl className="booking-hub__req-details">
                            {(req.requestedStartAt || req.requestedEndAt) && (
                              <>
                                <dt>{t.reqWishedTime}</dt>
                                <dd>
                                  {fmtDt(req.requestedStartAt, language)}
                                  {req.requestedEndAt &&
                                    ` – ${fmtDt(req.requestedEndAt, language)}`}
                                </dd>
                              </>
                            )}
                            {req.appointmentType && (
                              <>
                                <dt>{t.reqType}</dt>
                                <dd>{req.appointmentType.name}</dd>
                              </>
                            )}
                            {req.patientNote && (
                              <>
                                <dt>{t.reqNote}</dt>
                                <dd className="booking-hub__req-note">{req.patientNote}</dd>
                              </>
                            )}
                            <dt>{t.reqCreated}</dt>
                            <dd>{fmtDt(req.createdAt, language)}</dd>
                          </dl>

                          {/* Action buttons (manage roles only, no active panel) */}
                          {canManageRequests && actingId !== req.id && (
                            <div className="booking-hub__req-actions">
                              <button
                                type="button"
                                className="booking-hub__btn booking-hub__btn--sm"
                                onClick={() => startAccept(req)}
                              >
                                {t.reqAccept}
                              </button>
                              <button
                                type="button"
                                className="booking-hub__btn booking-hub__btn--sm booking-hub__btn--outline"
                                onClick={() => startDecline(req)}
                              >
                                {t.reqDecline}
                              </button>
                            </div>
                          )}

                          {/* Accept panel */}
                          {actingId === req.id && actingMode === "accept" && (
                            <form
                              className="booking-hub__action-panel"
                              onSubmit={(e) => void handleAccept(e)}
                              noValidate
                              aria-label={t.reqAcceptHeading}
                            >
                              <h3 className="booking-hub__action-heading">{t.reqAcceptHeading}</h3>
                              <div className="booking-hub__field">
                                <label
                                  className="booking-hub__field-label"
                                  htmlFor={`accept-start-${req.id}`}
                                >
                                  {t.reqAcceptStart}
                                </label>
                                <input
                                  id={`accept-start-${req.id}`}
                                  type="datetime-local"
                                  className="booking-hub__input"
                                  value={acceptStart}
                                  onChange={(e) => setAcceptStart(e.target.value)}
                                  required
                                  disabled={actionSaving}
                                />
                              </div>
                              <div className="booking-hub__field">
                                <label
                                  className="booking-hub__field-label"
                                  htmlFor={`accept-end-${req.id}`}
                                >
                                  {t.reqAcceptEnd}
                                </label>
                                <input
                                  id={`accept-end-${req.id}`}
                                  type="datetime-local"
                                  className="booking-hub__input"
                                  value={acceptEnd}
                                  onChange={(e) => setAcceptEnd(e.target.value)}
                                  required
                                  disabled={actionSaving}
                                />
                              </div>
                              <div className="booking-hub__field">
                                <label
                                  className="booking-hub__field-label"
                                  htmlFor={`accept-note-${req.id}`}
                                >
                                  {t.reqAcceptPracticeNote}
                                </label>
                                <textarea
                                  id={`accept-note-${req.id}`}
                                  className="booking-hub__textarea"
                                  value={acceptNote}
                                  placeholder={t.reqAcceptPracticeNotePlaceholder}
                                  onChange={(e) => setAcceptNote(e.target.value)}
                                  disabled={actionSaving}
                                  rows={2}
                                />
                              </div>
                              {actionError && (
                                <p
                                  className="booking-hub__status booking-hub__status--error"
                                  role="alert"
                                >
                                  {actionError}
                                </p>
                              )}
                              <div className="booking-hub__actions">
                                <button
                                  type="submit"
                                  className="booking-hub__btn booking-hub__btn--sm"
                                  disabled={actionSaving}
                                >
                                  {actionSaving ? t.saving : t.reqAcceptConfirm}
                                </button>
                                <button
                                  type="button"
                                  className="booking-hub__btn booking-hub__btn--sm booking-hub__btn--outline"
                                  onClick={cancelAction}
                                  disabled={actionSaving}
                                >
                                  {t.cancel}
                                </button>
                              </div>
                            </form>
                          )}

                          {/* Decline panel */}
                          {actingId === req.id && actingMode === "decline" && (
                            <form
                              className="booking-hub__action-panel"
                              onSubmit={(e) => void handleDecline(e)}
                              noValidate
                              aria-label={t.reqDeclineHeading}
                            >
                              <h3 className="booking-hub__action-heading">{t.reqDeclineHeading}</h3>
                              <div className="booking-hub__field">
                                <label
                                  className="booking-hub__field-label"
                                  htmlFor={`decline-reason-${req.id}`}
                                >
                                  {t.reqDeclineReason}
                                </label>
                                <textarea
                                  id={`decline-reason-${req.id}`}
                                  className="booking-hub__textarea"
                                  value={declineReason}
                                  placeholder={t.reqDeclineReasonPlaceholder}
                                  onChange={(e) => setDeclineReason(e.target.value)}
                                  disabled={actionSaving}
                                  rows={2}
                                />
                                <div className="booking-hub__field-hint booking-hub__field-hint--warning">
                                  {t.reqDeclineHint}
                                </div>
                              </div>
                              {actionError && (
                                <p
                                  className="booking-hub__status booking-hub__status--error"
                                  role="alert"
                                >
                                  {actionError}
                                </p>
                              )}
                              <div className="booking-hub__actions">
                                <button
                                  type="submit"
                                  className="booking-hub__btn booking-hub__btn--sm booking-hub__btn--danger"
                                  disabled={actionSaving}
                                >
                                  {actionSaving ? t.saving : t.reqDeclineConfirm}
                                </button>
                                <button
                                  type="button"
                                  className="booking-hub__btn booking-hub__btn--sm booking-hub__btn--outline"
                                  onClick={cancelAction}
                                  disabled={actionSaving}
                                >
                                  {t.cancel}
                                </button>
                              </div>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="booking-hub__req-footer">
                    <button
                      type="button"
                      className="booking-hub__btn booking-hub__btn--outline booking-hub__btn--sm"
                      onClick={() => void loadRequests()}
                      disabled={reqLoading}
                    >
                      {t.reqRefresh}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
