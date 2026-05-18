import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { authFetch } from "../../../api/authFetch.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  cancelRequestPatientAppointment,
  confirmPatientAppointment,
  fetchPatientAppointments,
  requestPatientAppointment,
} from "../api/patientAppointmentsApi.js";
import "../../../styles/PatientInboxPage.css";

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

export default function PatientAppointmentsPage() {
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
    if (res.status === 404 && data.error === "feature_disabled") throw new Error("feature_disabled");
    if (!res.ok) throw new Error(data.error || "load_failed");
    setAppointments(data.appointments || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
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
        await reload();
      } catch (e) {
        if (!cancelled) setError(t.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, t.loadError]);

  const submitRequest = async (e) => {
    e.preventDefault();
    setBusy(true);
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
      setError(t.loadError);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const { res, data } = await confirmPatientAppointment(selected.id);
      if (!res.ok) throw new Error("failed");
      await reload();
      setSelected(data.appointment);
    } catch {
      setError(t.loadError);
    } finally {
      setBusy(false);
    }
  };

  const cancelReq = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const { res, data } = await cancelRequestPatientAppointment(selected.id, {});
      if (!res.ok) throw new Error("failed");
      await reload();
      setSelected(data.appointment);
    } catch {
      setError(t.loadError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="patient-inbox-page" aria-labelledby="patient-appt-heading">
      <header className="patient-inbox-page__header">
        <h1 id="patient-appt-heading">{t.heading}</h1>
        <p>{t.intro}</p>
        <p>
          <Link to="/patient/hub">{t.backHub || "Hub"}</Link>
        </p>
      </header>

      <div className="patient-inbox-page__actions">
        <button
          type="button"
          className="patient-inbox-page__btn patient-inbox-page__btn--primary"
          onClick={() => setShowRequest(true)}
        >
          {t.requestAppointment}
        </button>
      </div>

      {loading ? (
        <p aria-live="polite">{t.loading}</p>
      ) : null}
      {error ? (
        <p role="alert">{error}</p>
      ) : null}

      {showRequest ? (
        <form className="patient-inbox-page__panel" onSubmit={submitRequest}>
          <h2>{t.requestAppointment}</h2>
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
          <button type="submit" className="patient-inbox-page__btn patient-inbox-page__btn--primary" disabled={busy}>
            {t.submitRequest}
          </button>
        </form>
      ) : null}

      <ul className="patient-inbox-page__list patient-inbox__practice-group">
        {appointments.length === 0 && !loading ? (
          <li>{t.empty}</li>
        ) : (
          appointments.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="patient-inbox-page__item"
                onClick={() => setSelected(a)}
                aria-current={selected?.id === a.id ? "true" : undefined}
              >
                <strong>{a.title}</strong>
                <span>{a.practiceName || t.notProvided}</span>
                <span>{fmt(a.startAt, language)}</span>
                <span>{t[`status_${a.status}`] || a.status}</span>
              </button>
            </li>
          ))
        )}
      </ul>

      {selected ? (
        <section className="patient-inbox-page__panel" aria-label={t.heading}>
          <h2>{selected.title}</h2>
          <p>
            <strong>{t.status}:</strong> {t[`status_${selected.status}`] || selected.status}
          </p>
          <p>{fmt(selected.startAt, language)}</p>
          {selected.patientNote ? <p>{selected.patientNote}</p> : null}
          <div className="patient-inbox-page__actions">
            {["scheduled", "requested", "rescheduled"].includes(selected.status) ? (
              <button
                type="button"
                className="patient-inbox-page__btn patient-inbox-page__btn--primary"
                disabled={busy}
                onClick={confirm}
              >
                {t.confirmAppointment}
              </button>
            ) : null}
            {!["cancelled"].includes(selected.status) ? (
              <button type="button" className="patient-inbox-page__btn" disabled={busy} onClick={cancelReq}>
                {t.requestCancellation}
              </button>
            ) : null}
            {selected.preVisitSessionId ? (
              <Link
                className="patient-inbox-page__btn"
                to={`/previsit/cases?session=${selected.preVisitSessionId}`}
              >
                {t.openPreparation}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
