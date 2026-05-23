/**
 * Central MDR-/store-aligned AI safety policy (runtime + prompt alignment).
 * No diagnosis, triage, treatment, specialist routing, urgency scoring, or certainty claims.
 */

/** @typedef {'symptom_check'|'image_analysis'|'body_map'|'meda'|'previsit_intake'|'previsit_adaptive'|'previsit_history_diff'|'previsit_case_continuity'|'previsit_doctor_transform'|'previsit_followup_format'|'medical_interpreter'|'generic'} AiSafetyModule */

export const AI_MODULES = {
  SYMPTOM_CHECK: "symptom_check",
  MEDA: "meda",
  IMAGE_ANALYSIS: "image_analysis",
  BODY_MAP: "body_map",
  PREVISIT_INTAKE: "previsit_intake",
  PREVISIT_ADAPTIVE: "previsit_adaptive",
  PREVISIT_HISTORY_DIFF: "previsit_history_diff",
  PREVISIT_CASE_CONTINUITY: "previsit_case_continuity",
  PREVISIT_DOCTOR_TRANSFORM: "previsit_doctor_transform",
  /** Bilingual assistant-style orientation questions (questions only, no answers) */
  PREVISIT_ASSISTANT_QUESTIONS: "previsit_assistant_questions",
  /** Reserved for future AI-assisted follow-up message formatting */
  PREVISIT_FOLLOWUP_FORMAT: "previsit_followup_format",
  /**
   * B2C Medical Interpreter — multilingual healthcare communication support only.
   * Not a diagnostic assistant. See MEDICAL_INTERPRETER_SAFETY_SCOPE.
   */
  MEDICAL_INTERPRETER: "medical_interpreter",
  GENERIC: "generic",
};

/**
 * Medical Interpreter safety scope (communication layer only).
 * Allowed: translation, transcription support, language simplification,
 * conversation documentation, neutral structuring of spoken content.
 * Forbidden: diagnosis, triage, urgency classification, treatment recommendation,
 * medication advice, specialist recommendation, medical interpretation of symptoms, risk scoring.
 */
export const MEDICAL_INTERPRETER_SAFETY_SCOPE = {
  allowed: [
    "translation",
    "transcription_support",
    "language_simplification",
    "conversation_documentation",
    "neutral_structuring",
  ],
  forbidden: [
    "diagnosis",
    "triage",
    "urgency_classification",
    "treatment_recommendation",
    "medication_advice",
    "specialist_recommendation",
    "symptom_medical_interpretation",
    "risk_scoring",
  ],
};

/** Prompt alignment for Medical Interpreter services (English meta; output in user languages). */
export const MEDICAL_INTERPRETER_COMMUNICATION_STYLE = `
Medical Interpreter safety (all languages): Translate, transcribe, simplify wording, document turns, and structure spoken content neutrally only.
Never: diagnosis or suspected disease; triage or urgency; treatment or medication advice; specialist routing; medical interpretation of symptoms; risk scores or clinical certainty.
Preserve meaning without adding facts. If unsafe to output, refuse briefly and ask for neutral rephrasing or direct discussion with the care team — in the user's language.
`.trim();

/** Short snippet to append to system prompts for consistency (English; models follow user language elsewhere). */
export const ALLOWED_COMMUNICATION_STYLE = `
Safety (all languages): Documentation and neutral clarification only. Never: diagnosis or suspected disease as fact;
probability/likelihood of illness; emergency/triage/urgency directives; treatment or medication advice; specialist/clinic routing;
clinical certainty; risk scores; “AI certainty”. Prefer patient wording, plain visible descriptions for images, and visit-prep structure only.
`.trim();

/** Stricter one-shot retry suffix for chat completions (English meta-instruction). */
export const STRICT_RETRY_SUFFIX_COMPLETION = `
STRICT REWRITE: Remove any diagnostic, urgency, treatment, specialist, or likelihood-of-disease wording.
If you cannot comply fully, respond only with a neutral apology that information could not be structured safely and invite neutral description + clinician discussion — in the user’s language.
`.trim();

/**
 * Phrase-level scrubbing (multilingual). Applied before regex concept scan.
 * @type {{ re: RegExp, replacement: string }[]}
 */
export const PHRASE_REPLACEMENTS = [
  { re: /\bthis looks like\b/gi, replacement: "[neutral observation omitted]" },
  { re: /\bpossible melanoma\b/gi, replacement: "[non-diagnostic detail omitted]" },
  { re: /\blikely condition\b/gi, replacement: "[non-diagnostic detail omitted]" },
  { re: /\bseek (a )?specialist\b/gi, replacement: "discuss with a clinician if you choose" },
  { re: /\bconsult (a )?(cardiologist|neurologist|specialist)\b/gi, replacement: "discuss with a clinician if you choose" },
  { re: /\bDas (klingt|deutet) (nach|auf)\b/gi, replacement: "[Beschreibung ohne Bewertung]" },
  { re: /\b(könnte|kann) (auf|hinweisen)\b/gi, replacement: "[ohne Einordnung]" },
  { re: /\bgo immediately\b/gi, replacement: "seek care as you normally would" },
  { re: /\bsofort (zu )?(Notfall|Notaufnahme)\b/gi, replacement: "[keine Dringlichkeitseinschätzung]" },
];

/** Global output patterns (EN/DE focus + common Latin-script clinical cues). */
const GLOBAL_FORBIDDEN = [
  /\bdiagnos(e|is|es|ed|ing)\b/i,
  /\bDIAGNOSE\b/,
  /\btriage\b/i,
  /\burgent(ly)?\b/i,
  /\burgency\b/i,
  /\bemergency\s+(room|care|services)?\b/i,
  /\bNotfall\b/i,
  /\bNotaufnahme\b/i,
  /\bimmediately\b/i,
  /\bsofort (?:zu )?(?:einem )?(?:Arzt|Ärztin|Klinik)\b/i,
  /\byou should see (a )?(doctor|specialist|cardiologist|neurologist)\b/i,
  /\bsee (a )?(cardiologist|neurologist|dermatologist|specialist)\b/i,
  /\bbei (einem )?(Kardiologen|Neurologen|Facharzt|Hautarzt)\b/i,
  /\b(recommend|prescribe|dosage|mg\b|take this medication)\b/i,
  /\b(empfehle|Therapie|Medikament|einnehmen|dosieren)\b/i,
  /\bmay indicate\b/i,
  /\bcould indicate\b/i,
  /\bthis sounds like\b/i,
  /\blikely\s+(diagnosis|disease|condition)\b/i,
  /\bwahrscheinlich(e)?\s+(Diagnose|Erkrankung)\b/i,
  /\bhigh risk\b/i,
  /\brisiko\s*score\b/i,
  /\bclinical certainty\b/i,
  /\bwith certainty\b/i,
  /\bsicher(e)?\s+(Diagnose|Erkrankung)\b/i,
];

/** Symptom / body-map chat style outputs. */
const SYMPTOM_EXTRA = [
  /\bpossibly (a |an )?\w+ (disorder|disease|syndrome)\b/i,
  /\bprobability\b/i,
  /\bwahrscheinlichkeit\b/i,
];

/** Image / visible interpretation leakage. */
const IMAGE_EXTRA = [
  /\bmelanoma\b/i,
  /\bfracture\b/i,
  /\b(infection|cellulitis|abscess)\b/i,
  /\btumor\b/i,
  /\bcancer\b/i,
  /\bKrebs\b/i,
  /\bInfektion\b/i,
  /\bFraktur\b/i,
  /\bdangerous\b/i,
  /\bgefährlich\b/i,
  /\blife-?threatening\b/i,
  /\blebensbedrohlich\b/i,
];

/**
 * Medical Interpreter output scan — reuses global clinical blocks; adds communication-layer leaks
 * (symptom interpretation, referrals, prescriptions) without changing other modules' pattern sets.
 */
/**
 * Interpreter translations may contain medication names, dosages, and negated
 * patient statements — avoid blocking those tokens. Block advisory/diagnostic leaks.
 */
const MEDICAL_INTERPRETER_OUTPUT_FORBIDDEN = [
  /\bdiagnos(e|is|es|ed|ing)\b/i,
  /\bDIAGNOSE\b/,
  /\btriage\b/i,
  /\burgency\b/i,
  /\bemergency\s+(room|care|services)\b/i,
  /\bNotaufnahme\b/i,
  /\byou should (see|take|start|go)\b/i,
  /\bSie sollten (sofort|einen|zum|zur)\b/i,
  /\bI recommend (that you|you)\b/i,
  /\bich empfehle\b/i,
  /\b(prescribe|verschreiben) (you|ihnen)\b/i,
  /\bsee (a )?(cardiologist|neurologist|dermatologist|specialist) (immediately|today)\b/i,
  /\bsofort (zu )?(einem )?(Kardiologen|Neurologen|Facharzt)\b/i,
  /\bmay indicate\b/i,
  /\bcould indicate\b/i,
  /\bthis sounds like\b/i,
  /\blikely\s+(diagnosis|disease|condition)\b/i,
  /\bwahrscheinlich(e)?\s+(Diagnose|Erkrankung)\b/i,
  /\bhigh risk\b/i,
  /\brisiko\s*score\b/i,
  /\bclinical certainty\b/i,
];

const MEDICAL_INTERPRETER_EXTRA = [
  /\bclinical (assessment|evaluation|interpretation)\b/i,
  /\bmedizinische (Beurteilung|Bewertung|Interpretation)\b/i,
  /\bsymptom(s)? (suggest|indicate|mean|point to)\b/i,
  /\bBeschwerden? (deuten|hinweisen|sprechen für)\b/i,
  /\binterpret (your |these |the )?symptoms\b/i,
  /\bSymptome? interpretieren\b/i,
  /\bSie haben (wahrscheinlich|vermutlich)\b/i,
  /\byou (likely|probably) have (a |an )?\w+/i,
  /\brefer (you |the patient )?to (a |an )?(specialist|cardiologist|neurologist|dermatologist)\b/i,
  /\büberweis(en|ung) (zu|an|zum|zur)\b/i,
  /\bRisikoeinschätzung\b/i,
  /\burgent care\b/i,
  /\bsofortige Behandlung\b/i,
];

/** Multilingual cues (Arabic / Persian / Kurdish Latin / Turkish / Russian). False positives possible — kept to high-risk clinical verbs. */
const MULTILINGUAL_EXTRA = [
  /\bتشخيص\b/,
  /\bطوارئ\b/,
  /\btanı\b/i,
  /\bteşhis\b/i,
  /\bacil\b/i,
  /\bдиагноз\b/i,
  /\bсрочно\b/i,
  /\bнемедленно\b/i,
];

/**
 * Combined patterns per module (output scanning).
 * @param {string} module
 * @returns {RegExp[]}
 */
export function getOutputSafetyPatterns(module) {
  const base = [...GLOBAL_FORBIDDEN, ...MULTILINGUAL_EXTRA];
  switch (module) {
    case AI_MODULES.IMAGE_ANALYSIS:
      return [...base, ...IMAGE_EXTRA];
    case AI_MODULES.SYMPTOM_CHECK:
    case AI_MODULES.BODY_MAP:
    case AI_MODULES.MEDA:
      return [...base, ...SYMPTOM_EXTRA];
    case AI_MODULES.PREVISIT_INTAKE:
    case AI_MODULES.PREVISIT_ADAPTIVE:
    case AI_MODULES.PREVISIT_HISTORY_DIFF:
    case AI_MODULES.PREVISIT_CASE_CONTINUITY:
    case AI_MODULES.PREVISIT_DOCTOR_TRANSFORM:
    case AI_MODULES.PREVISIT_ASSISTANT_QUESTIONS:
      return [...base, ...SYMPTOM_EXTRA];
    case AI_MODULES.PREVISIT_FOLLOWUP_FORMAT:
      return [...base, ...SYMPTOM_EXTRA];
    case AI_MODULES.MEDICAL_INTERPRETER:
      return [
        ...MEDICAL_INTERPRETER_OUTPUT_FORBIDDEN,
        ...MULTILINGUAL_EXTRA,
        ...MEDICAL_INTERPRETER_EXTRA,
      ];
    default:
      return [...base, ...SYMPTOM_EXTRA];
  }
}

/** When a structured field still matches forbidden patterns after stripping. */
export const STRUCTURED_FIELD_PLACEHOLDER = {
  de: "(Angabe gekürzt — bitte prüfen.)",
  en: "(Entry shortened — please review.)",
};

/** Fallback user-facing strings when output cannot be safely shown. */
export const SAFE_FALLBACKS = {
  [AI_MODULES.SYMPTOM_CHECK]: {
    de: "Die Angaben konnten nicht sicher strukturiert werden. Bitte beschreiben Sie Ihre Beschwerden möglichst neutral und besprechen Sie medizinische Fragen direkt mit medizinischem Fachpersonal.",
    en: "The information could not be safely structured. Please describe your symptoms as neutrally as possible and discuss medical questions directly with healthcare professionals.",
  },
  [AI_MODULES.IMAGE_ANALYSIS]: {
    de: "Die Bildbeschreibung konnte nicht in einer sicheren, neutralen Form ausgegeben werden. Bitte beschreiben Sie sichtbare Merkmale in eigenen Worten und klären Sie medizinische Fragen direkt mit medizinischem Fachpersonal.",
    en: "The image notes could not be returned in a safe neutral form. Please describe what you see in your own words and discuss medical questions directly with healthcare professionals.",
  },
  [AI_MODULES.BODY_MAP]: {
    de: "Die Antwort konnte nicht sicher formuliert werden. Bitte ergänzen Sie Ihre Notizen in eigenen Worten; medizinische Fragen besprechen Sie direkt mit medizinischem Fachpersonal.",
    en: "This reply could not be safely worded. Please add notes in your own words and discuss medical questions directly with healthcare professionals.",
  },
  [AI_MODULES.MEDA]: {
    de: "Dazu kann ich keine sichere Kurzantwort geben. Bei persönlichen Beschwerden wende dich bitte an medizinisches Fachpersonal.",
    en: "I cannot provide a safe short answer on that. For personal symptoms, please speak with a healthcare professional.",
  },
  [AI_MODULES.PREVISIT_INTAKE]: {
    de: "Die Rückfrage konnte nicht sicher formuliert werden. Bitte ergänzen Sie den Abschnitt in eigenen Worten.",
    en: "The follow-up question could not be safely worded. Please add your notes in your own words.",
  },
  [AI_MODULES.PREVISIT_ADAPTIVE]: {
    de: "Die Rückfrage konnte nicht sicher formuliert werden. Bitte ergänzen Sie den Abschnitt in eigenen Worten.",
    en: "The follow-up question could not be safely worded. Please add your notes in your own words.",
  },
  [AI_MODULES.PREVISIT_HISTORY_DIFF]: {
    de: "Der Vergleich konnte nicht vollständig sicher dargestellt werden. Es werden nur eindeutig patientenseitig genannte Fakten ohne medizinische Bewertung angezeigt.",
    en: "The comparison could not be fully shown in a safe form. Only clearly patient-stated facts are shown without medical assessment.",
  },
  [AI_MODULES.PREVISIT_CASE_CONTINUITY]: {
    de: "Die Zusammenfassung konnte nicht vollständig sicher dargestellt werden. Es werden nur wiederkehrende patientenseitige Angaben ohne Bewertung angezeigt.",
    en: "The summary could not be fully shown in a safe form. Only recurring patient-stated items are shown without assessment.",
  },
  [AI_MODULES.PREVISIT_DOCTOR_TRANSFORM]: {
    de: "Ein Teil der Texte konnte nicht sicher übernommen werden und wurde gekürzt. Inhaltliche Fragen bitte direkt mit dem Behandlungsteam klären.",
    en: "Some text could not be safely retained and was shortened. Please clarify content questions directly with the care team.",
  },
  [AI_MODULES.PREVISIT_ASSISTANT_QUESTIONS]: {
    de: "Die Orientierungsfragen konnten nicht sicher formuliert werden. Bitte ergänzen Sie Ihre Angaben in eigenen Worten.",
    en: "The orientation questions could not be safely worded. Please add your notes in your own words.",
  },
  [AI_MODULES.PREVISIT_FOLLOWUP_FORMAT]: {
    de: "Der Text konnte nicht in einer sicheren Form ausgegeben werden. Bitte formulieren Sie neutral und klären Sie medizinische Fragen mit medizinischem Fachpersonal.",
    en: "This text could not be returned in a safe form. Please phrase neutrally and discuss medical questions with healthcare professionals.",
  },
  [AI_MODULES.MEDICAL_INTERPRETER]: {
    de: "Diese Ausgabe konnte nicht sicher als Kommunikationshilfe angezeigt werden. Bitte formulieren Sie den Inhalt neutral und klären Sie medizinische Fragen direkt mit Ihrem Behandlungsteam. Dieses Modul bietet keine Diagnose, keine Dringlichkeitseinschätzung und keine Behandlungsempfehlung.",
    en: "This output could not be safely shown as communication support. Please phrase the content neutrally and discuss medical questions directly with your care team. This module does not provide diagnosis, urgency assessment, or treatment recommendations.",
  },
  generic: {
    de: "Die Ausgabe konnte nicht sicher strukturiert werden. Bitte formulieren Sie neutral und besprechen Sie medizinische Fragen mit medizinischem Fachpersonal.",
    en: "The output could not be safely structured. Please phrase neutrally and discuss medical questions with healthcare professionals.",
  },
};

export function normalizeUiLocale(lang) {
  const c = String(lang || "en")
    .trim()
    .split(/[-_]/)[0]
    .toLowerCase();
  if (c === "de") return "de";
  return "en";
}

export function getSafeFallback(module, locale) {
  const loc = normalizeUiLocale(locale);
  const table = SAFE_FALLBACKS[module] || SAFE_FALLBACKS.generic;
  return table[loc] || table.en || SAFE_FALLBACKS.generic.en;
}
