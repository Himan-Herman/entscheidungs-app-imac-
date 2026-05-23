import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import {
  fetchPublicPracticeDoctors,
  patientSelectPracticeDoctor,
} from "../api/practicePatientAssignmentApi.js";

export default function PatientPracticeDoctorSelect({ practiceId, currentDoctorUserId, onUpdated }) {
  const { language } = useLanguage();
  const t = useMemo(
    () =>
      getMessages(language).practiceOrganization ||
      getMessages("en").practiceOrganization,
    [language],
  );
  const [doctors, setDoctors] = useState([]);
  const [mode, setMode] = useState(currentDoctorUserId ? "doctor" : "general");
  const [doctorId, setDoctorId] = useState(currentDoctorUserId || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPublicPracticeDoctors(practiceId);
        if (!cancelled) setDoctors(data.doctors || []);
      } catch {
        if (!cancelled) setDoctors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await patientSelectPracticeDoctor(
        practiceId,
        mode === "doctor" && doctorId ? doctorId : null,
      );
      onUpdated?.();
      setMsg(t.assignmentSaved);
    } catch (e) {
      setMsg(e.message === "SESSION_EXPIRED" ? "" : t.saveError || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!doctors.length) return null;

  return (
    <fieldset className="patient-data-control__doctor-select">
      <legend>{t.patientSelectDoctor}</legend>
      <label className="patient-data-control__radio">
        <input
          type="radio"
          name={`contact-${practiceId}`}
          checked={mode === "general"}
          onChange={() => setMode("general")}
        />
        <span>{t.patientSendToPractice}</span>
      </label>
      <label className="patient-data-control__radio">
        <input
          type="radio"
          name={`contact-${practiceId}`}
          checked={mode === "doctor"}
          onChange={() => setMode("doctor")}
        />
        <span>{t.patientSelectDoctor}</span>
      </label>
      {mode === "doctor" ? (
        <label>
          <span className="visually-hidden">{t.patientSelectDoctor}</span>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            disabled={busy}
          >
            <option value="">{t.noDoctorsVisible}</option>
            {doctors.map((d) => (
              <option key={d.userId} value={d.userId}>
                {d.doctorTitle ? `${d.doctorTitle} ` : ""}
                {d.displayName}
                {d.specialty ? ` — ${d.specialty}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        className="patient-threads__btn patient-threads__btn--secondary"
        disabled={busy}
        onClick={save}
      >
        {t.saveAssignment}
      </button>
      {msg ? (
        <p className="pp-muted" role="status">
          {msg}
        </p>
      ) : null}
    </fieldset>
  );
}
