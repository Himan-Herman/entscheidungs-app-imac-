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
  });
  const [busy, setBusy] = useState(false);

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
    (async () => {
      setLoading(true);
      setError("");
      try {
        const linksRes = await authFetch("/api/patient/links");
        const linksData = await linksRes.json().catch(() => ({}));
        if (!cancelled) {
          setLinks(Array.isArray(linksData.links) ? linksData.links : []);
          if (linksData.links?.[0]?.practiceProfileId) {
            setRequestForm((f) => ({
              ...f,
              practiceProfileId: linksData.links[0].practiceProfileId,
            }));
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

  const submitRequest = async (e) => {
    e.preventDefault();
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
      });
      if (!res.ok) throw new Error(data.error || "failed");
      await reload();
      setShowRequest(false);
      setSelected(data.appointment);
    } catch {
      setError(t.actionError);
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

  const cancelReq = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const { res, data } = await cancelRequestPatientAppointment(selected.id, {});
      if (!res.ok) throw new Error(data.error || "failed");
      await reload();
      setSelected(data.appointment);
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

      <div className="patient-inbox__actions">
        <button
          type="button"
          className="patient-inbox__btn patient-inbox__btn--primary"
          onClick={() => setShowRequest(true)}
        >
          {t.requestAppointment}
        </button>
      </div>

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

      {showRequest ? (
        <form className="patient-appt__panel patient-appt__form" onSubmit={submitRequest}>
          <h2 className="patient-inbox__item-title">{t.requestAppointment}</h2>
          <label htmlFor="req-practice">{t.selectPractice}</label>
          <select
            id="req-practice"
            required
            value={requestForm.practiceProfileId}
            onChange={(e) =>
              setRequestForm((f) => ({ ...f, practiceProfileId: e.target.value }))
            }
          >
            {links.map((l) => (
              <option key={l.id} value={l.practiceProfileId}>
                {l.practice?.practiceName || l.practiceProfileId}
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
            onChange={(e) => setRequestForm((f) => ({ ...f, patientNote: e.target.value }))}
          />
          <div className="patient-appt__form-actions">
            <button
              type="submit"
              className="patient-inbox__btn patient-inbox__btn--primary"
              disabled={busy}
            >
              {t.submitRequest}
            </button>
            <button
              type="button"
              className="patient-inbox__btn patient-inbox__btn--secondary"
              disabled={busy}
              onClick={() => setShowRequest(false)}
            >
              {t.cancelRequest}
            </button>
          </div>
        </form>
      ) : null}

      <ul className="patient-inbox__list" aria-label={t.listCaption}>
        {appointments.length === 0 && !loading ? (
          <li className="patient-inbox__muted">{t.empty}</li>
        ) : (
          appointments.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="patient-inbox__item patient-appt__row"
                onClick={() => setSelected(a)}
                aria-current={selected?.id === a.id ? "true" : undefined}
                aria-label={`${a.title}, ${a.practiceName || t.notProvided}, ${fmt(a.startAt, language)}, ${t[`status_${a.status}`] || a.status}`}
              >
                <strong>{a.title}</strong>
                <span className="patient-inbox__meta">{a.practiceName || t.notProvided}</span>
                <span className="patient-inbox__meta">{fmt(a.startAt, language)}</span>
                <span className="patient-inbox__meta">
                  {t[`status_${a.status}`] || a.status}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      {selected ? (
        <section className="patient-appt__panel" aria-label={t.detailHeading}>
          <h2 className="patient-inbox__item-title">{selected.title}</h2>
          <p className="patient-inbox__meta">
            <strong>{t.status}:</strong> {t[`status_${selected.status}`] || selected.status}
          </p>
          <p className="patient-inbox__meta">{fmt(selected.startAt, language)}</p>
          {selected.patientNote ? (
            <p className="patient-inbox__summary">{selected.patientNote}</p>
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
            {!["cancelled"].includes(selected.status) ? (
              <button
                type="button"
                className="patient-inbox__btn patient-inbox__btn--secondary"
                disabled={busy}
                onClick={cancelReq}
              >
                {t.requestCancellation}
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
        </section>
      ) : null}
    </main>
  );
}
