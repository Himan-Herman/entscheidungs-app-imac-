import { useCallback, useEffect, useState } from "react";
import { usePracticeContext } from "../usePracticeContext.js";
import { useScopedRequest } from "../hooks/useScopedRequest.js";
import {
  cancelScopedAppointmentRequest,
  confirmScopedAppointment,
  fetchScopedAppointments,
} from "../api/scopedAppointmentsApi.js";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";
import "../../../styles/PatientAppointmentsPage.css";

/**
 * Appointments of one care relationship (Phase 2E.1).
 *
 * A context migration, not a redesign: it reuses the existing appointment
 * i18n namespace and the existing `patient-appt__*` presentation, so a patient
 * sees the same appointment they always saw — only inside an explicit practice
 * context instead of a cross-practice list.
 *
 * The practice identity is NOT repeated here; the context bar above already
 * carries name, specialty and city.
 *
 * Every request runs through useScopedRequest, so a response can only be
 * applied while its own context is still active.
 */

/** Same status vocabulary as the cross-practice page. */
function statusText(status, t) {
  return t[`status_${status}`] || t.notProvided;
}

function statusBadgeClass(status) {
  const map = {
    scheduled: "patient-appt__badge--scheduled",
    confirmed: "patient-appt__badge--confirmed",
    cancelled: "patient-appt__badge--cancelled",
    completed: "patient-appt__badge--completed",
    requested: "patient-appt__badge--requested",
    no_show: "patient-appt__badge--cancelled",
  };
  return `patient-appt__badge ${map[status] || ""}`.trim();
}

export default function PracticeContextAppointmentsPage() {
  const { linkId, isActiveRelationship } = usePracticeContext();
  const { run } = useScopedRequest(linkId);
  const { language } = useLanguage();
  const t =
    getMessages(language).patientAppointments || getMessages("en").patientAppointments;
  const tc = getMessages(language).practiceContext || getMessages("en").practiceContext;

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const outcome = await run(
        ({ signal }) => fetchScopedAppointments(linkId, { signal }),
        ({ res, data }) => {
          if (!res.ok || !data.ok) {
            setAppointments([]);
            setError(res.status === 404 ? tc.notFoundBody : t.loadError);
            return;
          }
          setAppointments(Array.isArray(data.appointments) ? data.appointments : []);
        },
      );
      if (!outcome.applied) return;
    } catch {
      setAppointments([]);
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [linkId, run, t.loadError, tc.notFoundBody]);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = async (appointmentId, work) => {
    setBusyId(appointmentId);
    setError("");
    try {
      await run(work, ({ res, data }) => {
        if (!res.ok || !data.ok) {
          setError(t.loadError);
          return;
        }
        setAppointments((prev) =>
          prev.map((a) => (a.id === data.appointment.id ? { ...a, ...data.appointment } : a)),
        );
      });
    } catch {
      setError(t.loadError);
    } finally {
      setBusyId("");
    }
  };

  const fmt = (iso) => {
    try {
      return new Date(iso).toLocaleString(getPrimaryIntlLocale(language), {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="practice-context patient-appt">
      <h1 className="practice-context__title">{tc.appointmentsTitle}</h1>

      {loading ? (
        <p className="practice-context__state" role="status" aria-live="polite">
          {t.loading}
        </p>
      ) : null}

      {error ? (
        <p className="practice-context__state" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && appointments.length === 0 ? (
        <p className="practice-context__state">{t.empty}</p>
      ) : null}

      {!loading && !error && appointments.length > 0 ? (
        <ul className="patient-appt__list" data-testid="scoped-appointment-list">
          {appointments.map((a) => (
            <li key={a.id} className="practice-appt__item">
              <h2 className="practice-appt__item-title">{a.title}</h2>
              <p className="practice-appt__when">{fmt(a.startAt)}</p>
              {/* Status is a word, never only a colour. */}
              <p className={statusBadgeClass(a.status)}>{statusText(a.status, t)}</p>
              {a.locationText ? <p className="practice-appt__when">{a.locationText}</p> : null}

              {isActiveRelationship &&
              ["scheduled", "requested", "rescheduled"].includes(a.status) ? (
                <div className="practice-appt__actions">
                  <button
                    type="button"
                    disabled={busyId === a.id}
                    onClick={() =>
                      mutate(a.id, ({ signal }) =>
                        confirmScopedAppointment(linkId, a.id, { signal }),
                      )
                    }
                  >
                    {t.confirmAppointment}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === a.id}
                    onClick={() =>
                      mutate(a.id, ({ signal }) =>
                        cancelScopedAppointmentRequest(linkId, a.id, "", { signal }),
                      )
                    }
                  >
                    {t.requestCancellation}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
