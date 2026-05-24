/**
 * Language-based side routing (not speaker identity detection).
 * Maps detected speech language to patient or doctor/practice side.
 */

/** @param {string | null | undefined} code */
export function normalizeLanguageCode(code) {
  if (!code || typeof code !== "string") return null;
  return code.trim().toLowerCase();
}

/**
 * @param {string | null | undefined} detected
 * @param {string} patientLanguage
 * @param {string} doctorLanguage
 * @param {"patient" | "doctor"} currentSpeaker
 */
export function resolveSpeakerFromDetectedLanguage(
  detected,
  patientLanguage,
  doctorLanguage,
  currentSpeaker,
) {
  const patient = normalizeLanguageCode(patientLanguage);
  const doctor = normalizeLanguageCode(doctorLanguage);

  if (!patient || !doctor || patient === doctor) {
    return { speaker: currentSpeaker, uncertain: true, reason: "same_language" };
  }

  const lang = normalizeLanguageCode(detected);
  if (!lang) {
    return { speaker: currentSpeaker, uncertain: true, reason: "missing" };
  }

  const matchesPatient = lang === patient || lang.startsWith(`${patient.slice(0, 2)}`);
  const matchesDoctor = lang === doctor || lang.startsWith(`${doctor.slice(0, 2)}`);

  if (matchesPatient && !matchesDoctor) {
    return { speaker: /** @type {"patient"} */ ("patient"), uncertain: false, reason: "detected" };
  }
  if (matchesDoctor && !matchesPatient) {
    return { speaker: /** @type {"doctor"} */ ("doctor"), uncertain: false, reason: "detected" };
  }

  return { speaker: currentSpeaker, uncertain: true, reason: "ambiguous" };
}
