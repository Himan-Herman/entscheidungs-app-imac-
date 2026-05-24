/** Minimum completed turns before client-side scope evaluation. */
export const MEDICAL_SCOPE_MIN_TURNS = 6;

/** Minimum session duration (ms) before client-side scope evaluation — 2 minutes. */
export const MEDICAL_SCOPE_MIN_MS = 2 * 60 * 1000;

const CONSULTATION_OPENER_PATTERNS = [
  /\bhow can i help you\b/i,
  /\bwhat brings you (here|in|to the (clinic|practice|hospital|office))?\b/i,
  /\bplease (tell|describe|explain)\b/i,
  /\bcan you describe\b/i,
  /\bdo you have (any )?pain\b/i,
  /\bsince when\b/i,
  /\bhow long have you\b/i,
  /\bwhat happened\b/i,
  /\bwhat (is|are) (your )?(symptoms?|problem|complaint)\b/i,
  /\bplease describe your symptoms\b/i,
  /\bgood (morning|afternoon|evening)\b/i,
  /\bhello\b/i,
  /\bhi\b/i,
  /\bwie kann ich (ihnen )?helfen\b/i,
  /\bwas führt sie (heute )?(hierher|her)\b/i,
  /\bwas bringt sie (heute )?(hierher|her)\b/i,
  /\bbitte (erzählen|beschreiben|schildern)\b/i,
  /\bkönnen sie (das )?beschreiben\b/i,
  /\bhaben sie schmerzen\b/i,
  /\bseit wann\b/i,
  /\bwas ist passiert\b/i,
  /\bbeschreiben sie (bitte )?(ihre )?(symptome|beschwerden)\b/i,
  /\bguten (tag|morgen|abend)\b/i,
  /\bhallo\b/i,
  /\bgrüß gott\b/i,
];

const NON_HEALTHCARE_PATTERNS = [
  /\b(shopping|mall|store|amazon|ebay|buy|purchase|discount|sale)\b/i,
  /\b(restaurant|menu|dinner|lunch|breakfast|reservation|table for)\b/i,
  /\b(vacation|holiday|tourism|tourist|hotel|flight|airport|beach)\b/i,
  /\b(university|school|homework|exam|professor|semester)\b/i,
  /\b(movie|netflix|football|soccer|game|party|weekend plans)\b/i,
  /\b(einkaufen|kaufen|geschäft|laden|rabatt|angebot)\b/i,
  /\b(restaurant|speisekarte|reservierung|tisch für)\b/i,
  /\b(urlaub|reise|tourismus|hotel|flug|flughafen)\b/i,
  /\b(universität|schule|hausaufgabe|prüfung|semester)\b/i,
  /\b(film|fußball|party|wochenende)\b/i,
];

const SCOPE_REFUSAL_MARKERS = [
  "only for medical",
  "only for healthcare",
  "intended only for healthcare",
  "intended only for medical",
  "not for medical",
  "nicht für medizin",
  "nur für medizin",
  "nur für gesundheit",
  "gesundheitskommunikation gedacht",
  "medizinische gespräche gedacht",
  "cannot help because",
  "can not help because",
  "this feature is only",
  "diese funktion ist nur",
  "please use it for doctor",
  "bitte nutzen sie sie für",
];

/**
 * @param {string} text
 */
export function isConsultationOpener(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return false;
  return CONSULTATION_OPENER_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * @param {string} text
 */
export function isLikelyNonHealthcareContent(text) {
  const normalized = String(text || "").trim();
  if (!normalized || normalized.length < 8) return false;
  if (isConsultationOpener(normalized)) return false;
  return NON_HEALTHCARE_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * @param {string} translated
 * @param {{ medicalDomainWarningDe?: string; medicalDomainWarningEn?: string }} [options]
 */
export function isModelScopeRefusal(translated, options = {}) {
  const normalized = String(translated || "").trim().toLowerCase();
  if (!normalized) return false;

  const customWarnings = [
    options.medicalDomainWarningDe,
    options.medicalDomainWarningEn,
  ]
    .filter(Boolean)
    .map((w) => String(w).trim().toLowerCase());

  if (customWarnings.some((w) => w && (normalized.includes(w.slice(0, 24)) || w.includes(normalized.slice(0, 24))))) {
    return true;
  }

  return SCOPE_REFUSAL_MARKERS.some((marker) => normalized.includes(marker));
}

/**
 * @param {number} completedTurns
 * @param {number} elapsedMs
 * @param {boolean} [userConfirmedContinue]
 */
export function shouldEvaluateMedicalScope(completedTurns, elapsedMs, userConfirmedContinue = false) {
  if (userConfirmedContinue) return false;
  return (
    completedTurns >= MEDICAL_SCOPE_MIN_TURNS || elapsedMs >= MEDICAL_SCOPE_MIN_MS
  );
}

/**
 * @param {Array<{ originalText?: string; status?: string }>} turns
 * @param {number} elapsedMs
 * @param {boolean} [userConfirmedContinue]
 */
export function shouldShowScopeWarning(turns, elapsedMs, userConfirmedContinue = false) {
  if (userConfirmedContinue) return false;

  const completed = turns.filter(
    (t) => t.status === "translated" || t.status === "corrected",
  );
  if (!shouldEvaluateMedicalScope(completed.length, elapsedMs, userConfirmedContinue)) {
    return false;
  }

  const recent = completed.slice(-4);
  const nonHealthcareCount = recent.filter((t) =>
    isLikelyNonHealthcareContent(t.originalText || ""),
  ).length;

  return nonHealthcareCount >= 2;
}

/**
 * @param {number} completedTurns
 * @param {number} elapsedMs
 * @param {boolean} userConfirmedContinue
 * @param {string} originalText
 * @param {string} translatedText
 */
export function shouldRetryScopeRefusal(
  completedTurns,
  elapsedMs,
  userConfirmedContinue,
  originalText,
  translatedText,
) {
  if (!isModelScopeRefusal(translatedText)) return false;
  if (isConsultationOpener(originalText)) return true;
  if (!shouldEvaluateMedicalScope(completedTurns, elapsedMs, userConfirmedContinue)) {
    return true;
  }
  if (isLikelyNonHealthcareContent(originalText)) return false;
  return true;
}
