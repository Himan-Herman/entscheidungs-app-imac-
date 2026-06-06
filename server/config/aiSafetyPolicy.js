/**
 * Central MDR-/store-aligned AI safety policy (runtime + prompt alignment).
 * No diagnosis, triage, treatment, specialist routing, urgency scoring, or certainty claims.
 */

/** @typedef {'symptom_check'|'image_analysis'|'body_map'|'meda'|'previsit_intake'|'previsit_adaptive'|'previsit_history_diff'|'previsit_case_continuity'|'previsit_doctor_transform'|'previsit_followup_format'|'medical_interpreter'|'lab_patient_explanation'|'anamnesis_translation'|'appointment_assistant'|'billing_plausibility'|'generic'} AiSafetyModule */

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
  /**
   * Patient-facing plain-language explanation of individual lab values.
   * Allowed: what the parameter measures, whether value is within/outside reference range.
   * Forbidden: diagnosis, urgency, treatment/medication advice, disease probability.
   */
  LAB_PATIENT_EXPLANATION: "lab_patient_explanation",
  /**
   * Anamnesis submission translation — strict translation only.
   * Allowed: verbatim translation of patient free-text answers between languages.
   * Forbidden: diagnosis, triage, urgency, treatment advice, medical interpretation,
   * hallucinated content, summarization that introduces new facts.
   */
  ANAMNESIS_TRANSLATION: "anamnesis_translation",
  /**
   * Appointment request assistant — B2B practice tool, organisational layer only.
   * Allowed: structured summary of booking request, language detection, neutral translation
   * of patientNote, identification of missing organisational fields, neutral reply draft.
   * Forbidden: diagnosis, triage, urgency classification, treatment/medication advice,
   * specialist routing, medical interpretation of note content, risk scoring,
   * use of anamnesis data, health profile, or any clinical patient record.
   */
  APPOINTMENT_ASSISTANT: "appointment_assistant",
  /**
   * Billing plausibility AI hints (Phase E) — organisational/billing layer only.
   * Allowed: neutral observations about code combinations, factor thresholds, catalogue
   *          match status, documentation gap hints.
   * Forbidden: diagnosis, therapy recommendation, urgency/triage, reimbursement decision,
   *            invented GOÄ rules, invented point values, statements about invoice
   *            correctness/incorrectness, medical interpretation of any kind.
   */
  BILLING_PLAUSIBILITY: "billing_plausibility",
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

/**
 * Billing Plausibility AI safety scope (billing hint layer only).
 * No diagnosis, no therapy, no urgency, no reimbursement decision,
 * no invented GOÄ rules, no final invoice correctness statements.
 */
export const BILLING_PLAUSIBILITY_SAFETY_SCOPE = {
  allowed: [
    "neutral_code_combination_observation",
    "factor_threshold_note",
    "catalogue_match_status_note",
    "documentation_gap_hint",
    "uncertainty_note",
  ],
  forbidden: [
    "diagnosis",
    "therapy_recommendation",
    "urgency_classification",
    "triage",
    "reimbursement_decision",
    "invoice_correctness_verdict",
    "invented_goae_rules",
    "invented_point_values",
    "medical_interpretation",
    "final_legal_billing_decision",
  ],
};

/**
 * Appointment Assistant safety scope (organisational scheduling layer only).
 * No medical evaluation, no clinical content, no anamnesis or health-record access.
 */
export const APPOINTMENT_ASSISTANT_SAFETY_SCOPE = {
  allowed: [
    "organisational_summary",
    "language_detection",
    "neutral_translation",
    "missing_field_detection",
    "neutral_reply_draft",
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
    "anamnesis_data_use",
    "health_profile_access",
    "medical_record_access",
  ],
};

/**
 * System-prompt safety suffix for the Appointment Assistant.
 * Prepended to every call; English meta-instruction, model responds in user locale.
 */
export const APPOINTMENT_ASSISTANT_SYSTEM_PROMPT_SAFETY = `
Appointment Assistant safety (all languages): Summarise, translate, and draft responses for appointment booking requests at an organisational level only.
Allowed: appointment type requested, preferred date/time, location type (in-person/video/phone), language of the patient note, neutral translation of organisational intent, list of missing booking fields, neutral confirmation or cancellation draft.
Never: diagnosis or suspected disease; triage, urgency, or emergency directives; treatment or medication advice; specialist routing; medical interpretation of note content; risk assessment; clinical certainty; reference to anamnesis, health records, or medical history.
If the patient note contains medical content, summarise only the organisational intent (e.g. "requests an appointment") without repeating or interpreting any clinical detail.
`.trim();

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
  { re: /\bkönnte auf .{0,100}hinweis\w*/gi, replacement: "[Einschätzung entfernt]" },
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
  /\byou (likely|probably) have\b/i,
  /\bwahrscheinlich(e)?\s+(Diagnose|Erkrankung)\b/i,
  /\bSie haben (wahrscheinlich|vermutlich)\b/i,
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

/**
 * Lab patient explanation — blocks diagnostic and urgency leakage while allowing
 * reference-range comparison language ("liegt unterhalb/oberhalb des Referenzbereichs").
 */
const LAB_EXPLANATION_FORBIDDEN = [
  /\bdiagnos(e|is|es|ed|ing)\b/i,
  /\bDIAGNOSE\b/,
  /\btriage\b/i,
  /\burgent(ly)?\b/i,
  /\burgency\b/i,
  /\bemergency\s*(room|care|services)?\b/i,
  /\bNotfall\b/i,
  /\bNotaufnahme\b/i,
  /\bimmediately (see|consult|go)\b/i,
  /\bsofort (zu|einen|einer|zum|zur)\b/i,
  /\byou (likely|probably|definitely) have\b/i,
  /\bSie haben (wahrscheinlich|vermutlich|sicher)\b/i,
  /\b(could indicate|may indicate|suggests) (a |an )?\w+ (disease|disorder|condition|syndrome)\b/i,
  /\b(deutet auf|spricht für|weist auf) .{0,60}(hin\b|erkrankung|störung|krankheit)/i,
  /\b(könnte|kann|dürfte) (auf|eine?).{0,60}hinweis/i,
  /\b(could|may|might) (indicate|suggest|point to) .{0,40}(disease|disorder|condition|illness)\b/i,
  /\b(prescribe|recommend taking|start taking)\b/i,
  /\b(empfehle zu nehmen|sollten Sie einnehmen)\b/i,
  /\b(see a|consult a|visit a) (specialist|cardiologist|neurologist|endocrinologist)\b/i,
  /\b(gehen Sie zu|wenden Sie sich an) .{0,30}(spezialisten|facharzt)\b/i,
  /\bhigh risk\b/i,
  /\bRisikogruppe\b/i,
  /\blife-?threatening\b/i,
  /\blebensbedrohlich\b/i,
  /\blebensgefährlich\b/i,
  /\bgefährlich\b/i,
  /\bdangerous\b/i,
  /\bclinical certainty\b/i,
  /\bKrebs\b/i,
  /\bcancer\b/i,
  /\btumor\b/i,
  /\bInfarkt\b/i,
  /\bSchlaganfall\b/i,
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
 * Appointment Assistant output scan — catches organisational-to-clinical drift.
 * Blocks the model from reframing a scheduling note as a medical urgency signal,
 * adding clinical interpretation, or issuing advisory language.
 * Applied on top of MEDICAL_INTERPRETER_OUTPUT_FORBIDDEN + MEDICAL_INTERPRETER_EXTRA.
 */
const APPOINTMENT_ASSISTANT_EXTRA = [
  // Urgency framing in German scheduling context (distinguish from legitimate "dringlich" availability)
  /\bdringliche[rsnm]?\s+(Überweisung|Behandlung|Einweisung|Versorgung)\b/i,
  /\bsofortige?\s+(Behandlung|Einweisung|Untersuchung|Versorgung)\b/i,
  /\bmedizinisch\s+(notwendig|dringend|erforderlich|indiziert)\b/i,
  // Advisory leakage directed at patient or note content
  /\bPatient(?:in)?\s+(?:sollte|muss|braucht)\s+(?:sofort|dringend)\b/i,
  /\bpatient\s+(?:should|must|needs to)\s+(?:immediately|urgently)\b/i,
  // Clinical interpretation of the organisational note
  /\bBeschwerden?\s+(?:deuten|hinweisen|sprechen für)\b/i,
  /\bsymptom[se]?\s+(?:suggest|indicate|point to)\b/i,
  /\bNach\s+(?:meiner\s+|dieser\s+)?(?:Einschätzung|Beurteilung|Ansicht)\b/i,
  /\bin my\s+(?:assessment|opinion|view|clinical\s+judgment)\b/i,
  // Specialist routing in scheduling context
  /\b(?:zum|zur|an einen?)\s+(?:Kardiologen|Neurologen|Onkologen|Facharzt)\s+(?:überweisen|schicken|wechseln)\b/i,
  // "recommend/suggest seeing/consulting a cardiologist/specialist" (bare form not caught by interpreter patterns)
  /\brecommend\s+(?:seeing|visiting|consulting|going to)\s+(?:a\s+)?(?:specialist|cardiologist|neurologist|dermatologist|oncologist|doctor)\b/i,
  /\bempfehle?\s+(?:einen?|den)\s+(?:Spezialisten|Kardiologen|Neurologen|Onkologen|Facharzt)\s+aufzusuchen\b/i,
];

/**
 * System-prompt safety suffix for the Billing Plausibility AI reviewer.
 * Billing context only — never medical, never legal, never reimbursement.
 */
export const BILLING_PLAUSIBILITY_SYSTEM_PROMPT_SAFETY = `
Billing Plausibility AI safety (all languages): You observe GOÄ code combinations, factor values, and catalogue match status at an organisational/billing-hint level only.
Allowed: neutral observations about code combinations, factor values relative to § 5 GOÄ thresholds, documentation gap hints, uncertainty notes.
Never: diagnosis or suspected disease; triage or urgency assessment; treatment or medication advice; reimbursement predictions; statements that an invoice is correct or incorrect; invented GOÄ rules or invented point values; any medical interpretation of clinical content; final legal billing decisions.
Always include nonBinding: true in your JSON response. Keep hints short and plain.
`.trim();

/**
 * Billing plausibility output scan — blocks medical/legal/reimbursement leakage.
 * Applied to every string field in the AI JSON response.
 */
const BILLING_PLAUSIBILITY_FORBIDDEN = [
  /\bdiagnos(e|is|es|ed|ing)\b/i,
  /\bDIAGNOSE\b/,
  /\btriage\b/i,
  /\burgent(ly)?\b/i,
  /\burgency\b/i,
  /\bemergency\s*(room|care|services)?\b/i,
  /\bNotfall\b/i,
  /\bimmediately (see|consult|call)\b/i,
  /\byou (likely|probably|definitely) have\b/i,
  /\bSie haben (wahrscheinlich|vermutlich|sicher)\b/i,
  /\b(could indicate|may indicate|suggests?) (a |an )?\w+ (disease|disorder|condition|syndrome)\b/i,
  /\b(prescribe|recommend taking|start taking)\b/i,
  /\b(therapy|treatment) (is |for |required)\b/i,
  /\bTherapie\b/i,
  /\bBehandlung ist (notwendig|erforderlich|angezeigt)\b/i,
  // reimbursement / invoice verdict
  /\b(will|must|shall) (be )?(reimbursed|paid|covered|rejected)\b/i,
  /\b(wird|muss|soll) (erstattet|abgelehnt|bezahlt|übernommen)\b/i,
  /\binvoice is (correct|incorrect|valid|invalid)\b/i,
  /\brechnung (ist|ist nicht) (korrekt|richtig|zulässig)\b/i,
  /\b(correct|incorrect) billing\b/i,
  /\breimbursement (decision|prediction|determination)\b/i,
  /\bErstattungsentscheidung\b/i,
  /\b(final|binding) (billing|legal) (decision|opinion|ruling)\b/i,
  /\brechtsverbindlich(e?s?)?\b/i,
  // invented rules
  /\baccording to (GOÄ )?§\s*\d+[^,\s]*\s+(which states|requiring|mandating)\b/i,
  /\bgemäß GOÄ .{0,40}(ist|sind) (verboten|unzulässig|nicht erlaubt)\b/i,
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
    case AI_MODULES.LAB_PATIENT_EXPLANATION:
      return [...LAB_EXPLANATION_FORBIDDEN, ...MULTILINGUAL_EXTRA];
    case AI_MODULES.ANAMNESIS_TRANSLATION:
      return [
        ...MEDICAL_INTERPRETER_OUTPUT_FORBIDDEN,
        ...MULTILINGUAL_EXTRA,
        ...MEDICAL_INTERPRETER_EXTRA,
      ];
    case AI_MODULES.APPOINTMENT_ASSISTANT:
      return [
        ...MEDICAL_INTERPRETER_OUTPUT_FORBIDDEN,
        ...MULTILINGUAL_EXTRA,
        ...MEDICAL_INTERPRETER_EXTRA,
        ...APPOINTMENT_ASSISTANT_EXTRA,
      ];
    case AI_MODULES.BILLING_PLAUSIBILITY:
      return [...BILLING_PLAUSIBILITY_FORBIDDEN, ...MULTILINGUAL_EXTRA];
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
  [AI_MODULES.LAB_PATIENT_EXPLANATION]: {
    de: "Die Erklärung für diesen Wert konnte nicht sicher ausgegeben werden. Bitte besprechen Sie Ihre Laborwerte direkt mit Ihrem Arzt oder Ihrer Ärztin.",
    en: "The explanation for this value could not be safely generated. Please discuss your lab results directly with your doctor.",
  },
  [AI_MODULES.MEDICAL_INTERPRETER]: {
    de: "Diese Ausgabe konnte nicht sicher als Kommunikationshilfe angezeigt werden. Bitte formulieren Sie den Inhalt neutral und klären Sie medizinische Fragen direkt mit Ihrem Behandlungsteam. Dieses Modul bietet keine Diagnose, keine Dringlichkeitseinschätzung und keine Behandlungsempfehlung.",
    en: "This output could not be safely shown as communication support. Please phrase the content neutrually and discuss medical questions directly with your care team. This module does not provide diagnosis, urgency assessment, or treatment recommendations.",
  },
  [AI_MODULES.ANAMNESIS_TRANSLATION]: {
    de: "(Übersetzung nicht verfügbar — Original maßgeblich.)",
    en: "(Translation unavailable — original text is authoritative.)",
  },
  [AI_MODULES.APPOINTMENT_ASSISTANT]: {
    de: "Die Zusammenfassung konnte nicht in einer sicheren Form ausgegeben werden. Bitte prüfen Sie die Terminanfrage direkt. Dieses Modul bietet keine Diagnose, keine Dringlichkeitseinschätzung und keine medizinische Bewertung.",
    en: "The summary could not be safely generated. Please review the appointment request directly. This module does not provide diagnosis, urgency assessment, or medical evaluation.",
  },
  [AI_MODULES.BILLING_PLAUSIBILITY]: {
    de: "Der KI-Plausibilitätshinweis konnte nicht sicher ausgegeben werden. Die deterministischen Warnhinweise oben sind weiterhin gültig. Dieses Modul liefert keine rechtsverbindliche Abrechnungsentscheidung, keine Diagnose und keine Erstattungsvorhersage.",
    en: "The AI plausibility hint could not be safely generated. The deterministic warnings above remain valid. This module does not provide a legally binding billing decision, diagnosis, or reimbursement prediction.",
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
