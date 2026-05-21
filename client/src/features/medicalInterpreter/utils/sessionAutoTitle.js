import { formatLanguageDisplayName } from "../../../i18n/intlLocale.js";
import { formatInterpreterDateOnly, formatInterpreterDateTime } from "./formatInterpreterDate.js";
import { isUnsafeSessionTitle } from "./sessionTitleSafety.js";

/**
 * Deterministic safe session title (no AI). Neutral context only.
 * @param {import('../types.js').InterpreterSession} session
 * @param {object} t — medicalInterpreter messages
 * @param {string} [uiLanguage]
 */
export function buildAutoSessionTitle(session, t, uiLanguage = "de") {
  const history = t?.history ?? {};

  if (session.appointmentDateTime?.trim()) {
    const date = formatInterpreterDateOnly(session.appointmentDateTime);
    const practice = session.practiceName?.trim();
    const doctor = session.doctorName?.trim();
    if (practice) {
      const title = history.titleWithAppointmentPractice
        ?.replace("{{date}}", date || "—")
        ?.replace("{{practice}}", practice);
      if (title && !isUnsafeSessionTitle(title)) return title;
    }
    if (doctor) {
      const title = history.titleWithAppointmentDoctor
        ?.replace("{{date}}", date || "—")
        ?.replace("{{doctor}}", doctor);
      if (title && !isUnsafeSessionTitle(title)) return title;
    }
    const title = history.titleWithAppointment
      ?.replace("{{date}}", date || "—");
    if (title && !isUnsafeSessionTitle(title)) return title;
  }

  if (session.practiceName?.trim()) {
    const title = history.titleWithPractice?.replace(
      "{{practice}}",
      session.practiceName.trim(),
    );
    if (title && !isUnsafeSessionTitle(title)) return title;
  }

  if (session.doctorName?.trim()) {
    const title = history.titleWithDoctor?.replace(
      "{{doctor}}",
      session.doctorName.trim(),
    );
    if (title && !isUnsafeSessionTitle(title)) return title;
  }

  const patient = formatLanguageDisplayName(uiLanguage, session.patientLanguage);
  const doctor = formatLanguageDisplayName(uiLanguage, session.doctorLanguage);
  if (patient && doctor) {
    const title = history.titleLanguagePair
      ?.replace("{{patient}}", patient)
      ?.replace("{{doctor}}", doctor);
    if (title && !isUnsafeSessionTitle(title)) return title;
  }

  const date = formatInterpreterDateTime(session.createdAt);
  return history.fallbackTitle?.replace("{{date}}", date || "—") ?? "—";
}
