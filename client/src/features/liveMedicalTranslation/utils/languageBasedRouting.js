/**
 * Language-based side routing (not speaker identity detection).
 * Maps detected speech language to patient or doctor/practice side.
 */

/** ISO 639-1 / common Realtime transcription aliases per configured language code. */
const LANGUAGE_ALIASES = {
  de: ["de", "deu", "ger"],
  en: ["en", "eng"],
  fr: ["fr", "fra", "fre"],
  es: ["es", "spa"],
  it: ["it", "ita"],
  ru: ["ru", "rus"],
  uk: ["uk", "ukr"],
  tr: ["tr", "tur"],
  pt: ["pt", "por"],
  ar: ["ar", "ara"],
  fa: ["fa", "fas", "pes", "per"],
  pl: ["pl", "pol"],
  ro: ["ro", "ron", "rum"],
  nl: ["nl", "nld", "dut"],
  ckb: ["ckb", "ku"],
  ku: ["ku", "kur"],
  el: ["el", "ell", "gre"],
  sq: ["sq", "sqi", "alb"],
  hr: ["hr", "hrv"],
  bs: ["bs", "bos"],
  sr: ["sr", "srp"],
  he: ["he", "heb"],
  ur: ["ur", "urd"],
};

/** @param {string | null | undefined} code */
export function normalizeLanguageCode(code) {
  if (!code || typeof code !== "string") return null;
  const trimmed = code.trim().toLowerCase().replace(/_/g, "-");
  if (!trimmed) return null;
  return trimmed.split("-")[0] || null;
}

/**
 * @param {string} patientLanguage
 * @param {string} doctorLanguage
 */
export function isLanguageRoutingEnabled(patientLanguage, doctorLanguage) {
  const patient = normalizeLanguageCode(patientLanguage);
  const doctor = normalizeLanguageCode(doctorLanguage);
  return Boolean(patient && doctor && patient !== doctor);
}

/**
 * @param {string | null | undefined} detected
 * @param {string} selectedCode
 */
export function detectedLanguageMatches(detected, selectedCode) {
  const selected = normalizeLanguageCode(selectedCode);
  const raw = String(detected || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (!selected || !raw) return false;

  const base = raw.split("-")[0];
  if (base === selected) return true;

  const aliases = LANGUAGE_ALIASES[selected] || [selected];
  return aliases.includes(base) || aliases.includes(raw);
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
  if (!isLanguageRoutingEnabled(patientLanguage, doctorLanguage)) {
    return {
      speaker: currentSpeaker,
      uncertain: false,
      routingEnabled: false,
      reason: "same_language",
    };
  }

  const lang = detected;
  if (!lang || !String(lang).trim()) {
    return {
      speaker: currentSpeaker,
      uncertain: true,
      routingEnabled: true,
      reason: "missing",
    };
  }

  const matchesPatient = detectedLanguageMatches(lang, patientLanguage);
  const matchesDoctor = detectedLanguageMatches(lang, doctorLanguage);

  if (matchesPatient && !matchesDoctor) {
    return {
      speaker: /** @type {"patient"} */ ("patient"),
      uncertain: false,
      routingEnabled: true,
      reason: "detected",
    };
  }
  if (matchesDoctor && !matchesPatient) {
    return {
      speaker: /** @type {"doctor"} */ ("doctor"),
      uncertain: false,
      routingEnabled: true,
      reason: "detected",
    };
  }

  if (!matchesPatient && !matchesDoctor) {
    return {
      speaker: currentSpeaker,
      uncertain: true,
      routingEnabled: true,
      reason: "outside_pair",
    };
  }

  return {
    speaker: currentSpeaker,
    uncertain: true,
    routingEnabled: true,
    reason: "ambiguous",
  };
}

/**
 * Build a user-visible direction label for the active side.
 * @param {{
 *   activeSpeaker: "patient" | "doctor";
 *   patientLanguageLabel: string;
 *   doctorLanguageLabel: string;
 *   patientRoleLabel: string;
 *   doctorRoleLabel: string;
 * }} params
 */
/**
 * Fallback when Realtime ASR omits language metadata — lightweight DE/EN heuristics only.
 * @param {string} text
 * @param {string} patientLanguage
 * @param {string} doctorLanguage
 * @returns {string | null} ISO 639-1 code or null
 */
export function inferLanguageFromTranscript(text, patientLanguage, doctorLanguage) {
  const sample = String(text || "").trim().slice(0, 280);
  if (sample.length < 2) return null;

  const patient = normalizeLanguageCode(patientLanguage);
  const doctor = normalizeLanguageCode(doctorLanguage);
  if (!patient || !doctor || patient === doctor) return null;

  const lower = sample.toLowerCase();
  const germanHint =
    /[äöüß]/.test(sample) ||
    /\b(ich|sie|habe|keine|kopf|fieber|schmerz|allerg|seit|wie kann ich|haben sie|bitte|danke)\b/i.test(
      lower,
    );
  const englishHint =
    /\b(i |i'|you |your |have |help |fever|headache|pain|allergy|since |how can|do you|please|thank)\b/i.test(
      lower,
    );

  if (patient === "de" && doctor === "en") {
    if (germanHint && !englishHint) return "de";
    if (englishHint && !germanHint) return "en";
    return null;
  }

  if (patient === "en" && doctor === "de") {
    if (englishHint && !germanHint) return "en";
    if (germanHint && !englishHint) return "de";
    return null;
  }

  if (germanHint && !englishHint) {
    if (detectedLanguageMatches("de", patientLanguage)) return patient;
    if (detectedLanguageMatches("de", doctorLanguage)) return doctor;
  }
  if (englishHint && !germanHint) {
    if (detectedLanguageMatches("en", patientLanguage)) return patient;
    if (detectedLanguageMatches("en", doctorLanguage)) return doctor;
  }

  return null;
}

export function buildDirectionLabel({
  activeSpeaker,
  patientLanguageLabel,
  doctorLanguageLabel,
  patientRoleLabel,
  doctorRoleLabel,
}) {
  if (activeSpeaker === "patient") {
    return `${patientRoleLabel}/${patientLanguageLabel} → ${doctorRoleLabel}/${doctorLanguageLabel}`;
  }
  return `${doctorRoleLabel}/${doctorLanguageLabel} → ${patientRoleLabel}/${patientLanguageLabel}`;
}
