import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authFetch } from "../../../api/authFetch.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import {
  PRE_VISIT_QUESTION_STEPS,
} from "../../preVisit/constants/questionFlow.js";
import {
  PREVISIT_LOCALE_STORAGE_KEY,
  computePreVisitAiFingerprint,
  savePreVisitSession,
} from "../../preVisit/constants/preVisitSession.js";
import {
  cancelRequestPatientAppointment,
  confirmPatientAppointment,
  fetchPatientAppointments,
  fetchPracticeBookingCheck,
  requestPatientAppointment,
} from "../api/patientAppointmentsApi.js";
import "../../../styles/PatientInboxPage.css";
import "../../../styles/PatientAppointmentsPage.css";

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

function statusBadgeClass(status) {
  const map = {
    requested: "patient-appt__badge--requested",
    scheduled: "patient-appt__badge--scheduled",
    confirmed: "patient-appt__badge--confirmed",
    cancelled: "patient-appt__badge--cancelled",
    completed: "patient-appt__badge--completed",
    rescheduled: "patient-appt__badge--rescheduled",
    no_show: "patient-appt__badge--cancelled",
  };
  return `patient-appt__badge ${map[status] || ""}`.trim();
}

function hydratePreVisitSession(record) {
  const answers =
    record.answers && typeof record.answers === "object" && !Array.isArray(record.answers)
      ? JSON.parse(JSON.stringify(record.answers))
      : {};
  const doctorLang = record.doctorLanguage || record.patientLanguage || "de";
  const patientLang = record.patientLanguage || "de";
  const payload = {
    patientLanguage: patientLang,
    doctorLanguage: doctorLang,
    answers,
    stepIndex: PRE_VISIT_QUESTION_STEPS.length - 1,
  };
  if (record.aiDoctorVersion != null) {
    payload.aiDoctorVersion = record.aiDoctorVersion;
    payload.aiSafetyNotice =
      typeof record.aiSafetyNotice === "string" ? record.aiSafetyNotice : "";
    payload.aiDoctorVersionFingerprint = computePreVisitAiFingerprint(
      answers,
      doctorLang,
    );
  }
  savePreVisitSession(payload);
  try {
    sessionStorage.setItem(PREVISIT_LOCALE_STORAGE_KEY, patientLang);
  } catch {
    /* ignore */
  }
}

const ACTIVE_STATUSES = ["requested", "scheduled", "confirmed", "rescheduled"];
const PAST_STATUSES = ["cancelled", "completed", "no_show"];

export default function PatientAppointmentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).patientAppointments ||
      getMessages("en").patientAppointments,
    [language],
  );

  const [appointments, setAppointments] = useState([]);
  const [links, setLinks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showRequest, setShowRequest] = useState(false);
  const [requestForm, setRequestForm] = useState({
    practiceProfileId: "",
    requestedStartAt: "",
    requestedEndAt: "",
    patientNote: "",
    consentAccepted: false,
  });
  const [busy, setBusy] = useState(false);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [bookingCheckLoading, setBookingCheckLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const reload = useCallback(async () => {
    const { res, data } = await fetchPatientAppointments();
    if (res.status === 404 && data.error === "feature_disabled") {
      throw new Error("feature_disabled");
    }
    if (!res.ok) throw new Error(data.error || "load_failed");
    const list = data.appointments || [];
    setAppointments(list);
    return list;
  }, []);

  useEffect(() => {
    document.title = t.pageTitle;
  }, [t.pageTitle]);

  useEffect(() => {
    let cancelled = false;
    const urlPracticeId = searchParams.get("practiceId");
    (async () => {
      setLoading(true);
      setError("");
      try {
        const linksRes = await authFetch("/api/patient/links");
        const linksData = await linksRes.json().catch(() => ({}));
        const allLinks = Array.isArray(linksData.links) ? linksData.links : [];
        if (!cancelled) {
          setLinks(allLinks);
          const firstActiveId = allLinks.find((l) => l.status === "active")?.practice?.id || "";
          const preselect = urlPracticeId || firstActiveId;
          if (preselect) {
            setRequestForm((f) => ({ ...f, practiceProfileId: preselect }));
          }
          if (urlPracticeId) {
            setShowRequest(true);
          }
        }
        const list = await reload();
        const deepLinkId = searchParams.get("appointmentId");
        if (!cancelled && deepLinkId) {
          const match = list.find((a) => a.id === deepLinkId);
          if (match) setSelected(match);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message === "feature_disabled" ? t.featureDisabled : t.loadError);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, searchParams, t.featureDisabled, t.loadError]);

  useEffect(() => {
    const practiceId = requestForm.practiceProfileId;
    if (!practiceId) {
      setBookingStatus(null);
      return;
    }
    let cancelled = false;
    setBookingCheckLoading(true);
    setBookingStatus(null);
    fetchPracticeBookingCheck(practiceId)
      .then(({ res, data }) => {
        if (cancelled) return;
        if (res.ok && data.ok) {
          setBookingStatus({ bookingEnabled: data.bookingEnabled, bookingMode: data.bookingMode });
        } else {
          setBookingStatus({ bookingEnabled: false, bookingMode: "disabled" });
        }
      })
      .catch(() => {
        if (!cancelled) setBookingStatus({ bookingEnabled: false, bookingMode: "disabled" });
      })
      .finally(() => {
        if (!cancelled) setBookingCheckLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestForm.practiceProfileId]);

  const bookingActive =
    bookingStatus?.bookingEnabled === true &&
    bookingStatus?.bookingMode === "medscoutx_request";

  const openRequestForm = () => {
    setRequestForm((f) => ({ ...f, consentAccepted: false }));
    setSuccessMsg("");
    setError("");
    setShowRequest(true);
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!requestForm.consentAccepted) {
      setError(t.consentRequired);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { res, data } = await requestPatientAppointment({
        practiceProfileId: requestForm.practiceProfileId,
        requestedStartAt: requestForm.requestedStartAt
          ? new Date(requestForm.requestedStartAt).toISOString()
          : undefined,
        requestedEndAt: requestForm.requestedEndAt
          ? new Date(requestForm.requestedEndAt).toISOString()
          : undefined,
        patientNote: requestForm.patientNote || undefined,
        title: t.requestAppointment,
        locale: language,
        consentAccepted: true,
      });
      if (!res.ok) {
        if (data.error === "practice_booking_disabled") throw new Error("booking_disabled");
        if (data.error === "appointment_request_consent_required") throw new Error("consent_missing");
        throw new Error(data.error || "failed");
      }
      await reload();
      setShowRequest(false);
      setRequestForm((f) => ({
        ...f,
        requestedStartAt: "",
        requestedEndAt: "",
        patientNote: "",
        consentAccepted: false,
      }));
      setSuccessMsg(t.successText);
    } catch (e) {
      if (e.message === "booking_disabled") setError(t.bookingDisabledError);
      else if (e.message === "consent_missing") setError(t.consentMissingError);
      else setError(t.actionError);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const { res, data } = await confirmPatientAppointment(selected.id);
      if (!res.ok) throw new Error(data.error || "failed");
      await reload();
      setSelected(data.appointment);
    } catch {
      setError(t.actionError);
    } finally {
      setBusy(false);
    }
  };

  const cancelAppt = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const { res, data } = await cancelRequestPatientAppointment(
        selected.id,
        { reason: cancelReason.trim() || undefined },
      );
      if (!res.ok) throw new Error(data.error || "failed");
      await reload();
      setSelected(null);
      setShowCancelConfirm(false);
      setCancelReason("");
      setSuccessMsg(t.cancelledSuccess);
    } catch {
      setError(t.actionError);
    } finally {
      setBusy(false);
    }
  };

  const openPreparation = async () => {
    if (!selected?.preVisitSessionId) return;
    setBusy(true);
    setError("");
    try {
      const res = await authFetch(
        `/api/previsit/sessions/${encodeURIComponent(selected.preVisitSessionId)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.session) throw new Error("get");
      hydratePreVisitSession(data.session);
      navigate("/pre-visit/document");
    } catch {
      setError(t.preparationOpenError);
    } finally {
      setBusy(false);
    }
  };

  function selectAppointment(a) {
    setSelected(a);
    setShowCancelConfirm(false);
    setCancelReason("");
    setError("");
  }

  const activeAppts = appointments.filter((a) => ACTIVE_STATUSES.includes(a.status));
  const pastAppts = appointments.filter((a) => PAST_STATUSES.includes(a.status));
  const hasBothGroups = activeAppts.length > 0 && pastAppts.length > 0;
  const canCancel = selected != null && ACTIVE_STATUSES.includes(selected.status);

  return (
    <main className="patient-inbox" aria-labelledby="patient-appt-heading">
      <Link className="patient-inbox__back" to="/patient/practice">
        {t.backHub}
      </Link>
      <header className="patient-inbox__header">
        <h1 id="patient-appt-heading" className="patient-inbox__title">
          {t.heading}
        </h1>
        <p className="patient-inbox__intro">{t.intro}</p>
      </header>

      {loading ? (
        <p className="patient-inbox__muted" aria-live="polite">
          {t.loading}
        </p>
      ) : null}
      {error ? (
        <p className="patient-inbox__error" role="alert">
          {error}
        </p>
      ) : null}

      {successMsg && !showRequest ? (
        <div className="patient-appt__success" role="status">
          <p className="patient-appt__success-heading">{t.successHeading}</p>
          <p>{successMsg}</p>
        </div>
      ) : null}

      {!loading && !showRequest ? (
        <div className="patient-inbox__actions">
          {bookingCheckLoading ? (
            <p className="patient-inbox__muted" aria-live="polite" style={{ fontSize: "0.88rem" }}>
              {t.loading}
            </p>
          ) : bookingActive ? (
            <button
              type="button"
              className="patient-inbox__btn patient-inbox__btn--primary"
              onClick={openRequestForm}
            >
              {t.requestAppointment}
            </button>
          ) : bookingStatus && !bookingActive ? (
            <p className="patient-appt__booking-disabled">{t.bookingDisabled}</p>
          ) : null}
        </div>
      ) : null}

      {showRequest ? (
        <form
          className="patient-appt__panel patient-appt__form"
          onSubmit={submitRequest}
          aria-label={t.requestAppointment}
          noValidate
        >
          <h2 className="patient-inbox__item-title">{t.requestAppointment}</h2>

          <label htmlFor="req-practice">{t.selectPractice}</label>
          <select
            id="req-practice"
            required
            value={requestForm.practiceProfileId}
            onChange={(e) =>
              setRequestForm((f) => ({
                ...f,
                practiceProfileId: e.target.value,
                consentAccepted: false,
              }))
            }
          >
            {links
              .filter((l) => l.status === "active")
              .map((l) => (
                <option key={l.id} value={l.practice?.id || ""}>
                  {l.practice?.practiceName || l.practice?.id || "—"}
                </option>
              ))}
          </select>

          <label htmlFor="req-start">{t.preferredStart}</label>
          <input
            id="req-start"
            type="datetime-local"
            value={requestForm.requestedStartAt}
            onChange={(e) =>
              setRequestForm((f) => ({ ...f, requestedStartAt: e.target.value }))
            }
          />

          <label htmlFor="req-end">{t.preferredEnd}</label>
          <input
            id="req-end"
            type="datetime-local"
            value={requestForm.requestedEndAt}
            onChange={(e) =>
              setRequestForm((f) => ({ ...f, requestedEndAt: e.target.value }))
            }
          />

          <label htmlFor="req-note">{t.note}</label>
          <textarea
            id="req-note"
            rows={3}
            value={requestForm.patientNote}
            maxLength={2000}
            onChange={(e) => setRequestForm((f) => ({ ...f, patientNote: e.target.value }))}
          />

          <fieldset className="patient-appt__consent">
            <legend className="patient-appt__consent-heading">{t.consentHeading}</legend>
            <p className="patient-appt__consent-disclaimer">{t.consentDisclaimer}</p>
            <label className="patient-appt__consent-label">
              <input
                type="checkbox"
                checked={requestForm.consentAccepted}
                required
                aria-required="true"
                onChange={(e) =>
                  setRequestForm((f) => ({ ...f, consentAccepted: e.target.checked }))
                }
              />
              {t.consentLabel}
            </label>
          </fieldset>

          <div className="patient-appt__form-actions">
            <button
              type="submit"
              className="patient-inbox__btn patient-inbox__btn--primary"
              disabled={busy || !requestForm.consentAccepted}
            >
              {t.submitRequest}
            </button>
            <button
              type="button"
              className="patient-inbox__btn patient-inbox__btn--secondary"
              disabled={busy}
              onClick={() => {
                setShowRequest(false);
                setError("");
              }}
            >
              {t.cancelRequest}
            </button>
          </div>
        </form>
      ) : null}

      {/* ── Appointments list ─────────────────────────────────────────── */}
      {appointments.length === 0 && !loading ? (
        <p className="patient-inbox__muted">{t.empty}</p>
      ) : (
        <>
          {hasBothGroups && (
            <h2 className="patient-appt__section-heading">{t.sectionUpcoming}</h2>
          )}
          {activeAppts.length > 0 && (
            <ul
              className="patient-inbox__list"
              aria-label={hasBothGroups ? t.sectionUpcoming : t.listCaption}
            >
              {activeAppts.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="patient-inbox__item patient-appt__row"
                    onClick={() => selectAppointment(a)}
                    aria-current={selected?.id === a.id ? "true" : undefined}
                    aria-label={`${a.title}, ${a.practiceName || t.notProvided}, ${fmt(a.startAt, language)}, ${t[`status_${a.status}`] || a.status}`}
                  >
                    <strong>{a.title}</strong>
                    <span className="patient-inbox__meta">{a.practiceName || t.notProvided}</span>
                    <span className="patient-inbox__meta">{fmt(a.startAt, language)}</span>
                    <span className={statusBadgeClass(a.status)}>
                      {t[`status_${a.status}`] || a.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pastAppts.length > 0 && (
            <>
              <h2 className="patient-appt__section-heading">{t.sectionPast}</h2>
              <ul className="patient-inbox__list" aria-label={t.sectionPast}>
                {pastAppts.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="patient-inbox__item patient-appt__row"
                      onClick={() => selectAppointment(a)}
                      aria-current={selected?.id === a.id ? "true" : undefined}
                      aria-label={`${a.title}, ${a.practiceName || t.notProvided}, ${fmt(a.startAt, language)}, ${t[`status_${a.status}`] || a.status}`}
                    >
                      <strong>{a.title}</strong>
                      <span className="patient-inbox__meta">{a.practiceName || t.notProvided}</span>
                      <span className="patient-inbox__meta">{fmt(a.startAt, language)}</span>
                      <span className={statusBadgeClass(a.status)}>
                        {t[`status_${a.status}`] || a.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {/* ── Appointment detail panel ──────────────────────────────────── */}
      {selected ? (
        <section className="patient-appt__panel" aria-label={t.detailHeading}>
          <h2 className="patient-inbox__item-title">{selected.title}</h2>
          <p className="patient-inbox__meta">
            <strong>{t.status}:</strong>{" "}
            <span className={statusBadgeClass(selected.status)}>
              {t[`status_${selected.status}`] || selected.status}
            </span>
          </p>
          {selected.practiceName && (
            <p className="patient-inbox__meta">{selected.practiceName}</p>
          )}
          <p className="patient-inbox__meta">{fmt(selected.startAt, language)}</p>
          {selected.patientNote ? (
            <p className="patient-inbox__summary">{selected.patientNote}</p>
          ) : null}
          {selected.cancellationReason ? (
            <p className="patient-inbox__summary">
              <strong>{t.cancellationReasonLabel}:</strong> {selected.cancellationReason}
            </p>
          ) : null}

          <div className="patient-inbox__actions">
            {["scheduled", "requested", "rescheduled"].includes(selected.status) ? (
              <button
                type="button"
                className="patient-inbox__btn patient-inbox__btn--primary"
                disabled={busy}
                onClick={confirm}
              >
                {t.confirmAppointment}
              </button>
            ) : null}
            {selected.preVisitSessionId ? (
              <button
                type="button"
                className="patient-inbox__btn patient-inbox__btn--secondary"
                disabled={busy}
                onClick={openPreparation}
              >
                {t.openPreparation}
              </button>
            ) : null}
          </div>

          {/* ── Cancel flow ─────────────────────────────────────────────── */}
          {canCancel ? (
            showCancelConfirm ? (
              <div
                className="patient-appt__cancel-form"
                role="group"
                aria-label={t.cancelModalTitle}
              >
                <p className="patient-appt__cancel-form-title">{t.cancelModalTitle}</p>
                <label
                  className="patient-appt__cancel-form-label"
                  htmlFor="cancel-reason"
                >
                  {t.cancelReasonLabel}
                </label>
                <textarea
                  id="cancel-reason"
                  className="patient-appt__cancel-reason"
                  value={cancelReason}
                  rows={3}
                  maxLength={500}
                  placeholder={t.cancelReasonPlaceholder}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <p className="patient-appt__cancel-hint">{t.cancelReasonHint}</p>
                <div className="patient-appt__form-actions">
                  <button
                    type="button"
                    className="patient-inbox__btn patient-inbox__btn--danger"
                    disabled={busy}
                    onClick={cancelAppt}
                  >
                    {t.cancelConfirmBtn}
                  </button>
                  <button
                    type="button"
                    className="patient-inbox__btn patient-inbox__btn--secondary"
                    disabled={busy}
                    onClick={() => {
                      setShowCancelConfirm(false);
                      setCancelReason("");
                    }}
                  >
                    {t.cancelDismissBtn}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="patient-inbox__btn patient-inbox__btn--secondary"
                  disabled={busy}
                  onClick={() => setShowCancelConfirm(true)}
                >
                  {t.requestCancellation}
                </button>
              </div>
            )
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
