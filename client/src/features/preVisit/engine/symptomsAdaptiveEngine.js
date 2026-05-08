/**
 * Bounded adaptive intake by category.
 * No diagnosis / triage / treatment / specialist logic (client-side guardrails + server prompt).
 */

export const PREVISIT_INTAKE_SCHEMA_VERSION = 1;

/** Max follow-up Q&A pairs after the initial free-text seed (configurable cap). */
export const PREVISIT_ADAPTIVE_MAX_FOLLOWUPS = 4;

/** Categories that use adaptive engine (others stay linear). */
export const PREVISIT_ADAPTIVE_CATEGORY_KEYS = new Set([
  "symptomsOwnWords",
  "onsetAndCourse",
  "medications",
  "patientQuestions",
]);

const FALLBACK_QUESTIONS = {
  de: {
    symptomsOwnWords: [
      "Seit wann bestehen die Beschwerden?",
      "Sind sie eher dauerhaft oder kommen und gehen sie?",
      "Gibt es etwas, das die Beschwerden beeinflusst (besser oder schlechter)?",
      "Was ist Ihnen noch wichtig, damit Ihre Schilderung gut verstanden wird?",
    ],
    onsetAndCourse: [
      "Wann haben Sie es zum ersten Mal bemerkt?",
      "Wie hat es sich seitdem entwickelt?",
      "Gibt es wiederkehrende Muster über den Tag oder die Woche?",
      "Welche Veränderung im Verlauf möchten Sie besonders festhalten?",
    ],
    medications: [
      "Welche Medikamente nehmen Sie aktuell regelmäßig ein?",
      "Können Sie Name, Dosis und Häufigkeit ergänzen?",
      "Gibt es Medikamente, die Sie nur bei Bedarf einnehmen?",
      "Welche Angabe zu Medikamenten ist Ihnen für den Termin noch wichtig?",
    ],
    patientQuestions: [
      "Welche Frage möchten Sie im Termin zuerst klären?",
      "Gibt es Entscheidungen oder nächste Schritte, zu denen Sie Klarheit möchten?",
      "Welche Information wünschen Sie sich besonders verständlich erklärt?",
      "Welche weitere Frage soll für den Termin dokumentiert werden?",
    ],
  },
  en: {
    symptomsOwnWords: [
      "When did these symptoms start?",
      "Are they mostly constant, or do they come and go?",
      "Is there anything you feel makes them better or worse?",
      "What else should be documented so your description is clear?",
    ],
    onsetAndCourse: [
      "When did you first notice this?",
      "How has it changed over time?",
      "Are there recurring patterns during the day or week?",
      "Which change over time is most important to document?",
    ],
    medications: [
      "Which medications do you currently take regularly?",
      "Can you add name, dose, and frequency?",
      "Do you take any medicines only when needed?",
      "What medication detail is most important for this visit?",
    ],
    patientQuestions: [
      "Which question do you want to address first in the appointment?",
      "Are there decisions or next steps you want clarified?",
      "Which information would you like explained clearly?",
      "What other question should be documented for the visit?",
    ],
  },
};

const CATEGORY_NOTE = {
  de: {
    symptomsOwnWords: "Nachfragen (Beschwerden):",
    onsetAndCourse: "Nachfragen (Beginn und Verlauf):",
    medications: "Nachfragen (Medikamente):",
    patientQuestions: "Nachfragen (Fragen an den Arzt):",
  },
  en: {
    symptomsOwnWords: "Follow-up notes (symptoms):",
    onsetAndCourse: "Follow-up notes (onset and course):",
    medications: "Follow-up notes (medications):",
    patientQuestions: "Follow-up notes (patient questions):",
  },
};

export function createEmptyAdaptiveIntakeSlice() {
  return {
    status: "active",
    seedStatement: "",
    currentQuestion: null,
    qaHistory: [],
    completeness: 0,
  };
}

/**
 * @param {string} categoryKey
 * @param {string} lang
 * @param {string} seed
 * @param {{ question: string, answer: string }[]} qaHistory
 */
export function compileAdaptiveDocumentation(categoryKey, lang, seed, qaHistory) {
  const s = String(seed || "").trim();
  const lines = [];
  if (s) lines.push(s);
  const pairs = Array.isArray(qaHistory) ? qaHistory : [];
  if (pairs.length) {
    lines.push("");
    const locale = lang === "en" ? "en" : "de";
    const note =
      CATEGORY_NOTE[locale]?.[categoryKey] ||
      CATEGORY_NOTE[locale].symptomsOwnWords;
    lines.push(note);
    for (const p of pairs) {
      const q = String(p?.question || "").trim();
      const a = String(p?.answer || "").trim();
      if (!q && !a) continue;
      lines.push(`- ${q}`);
      if (a) lines.push(`  ${a}`);
    }
  }
  return lines.join("\n").trim();
}

/**
 * @param {string} lang
 * @param {string} categoryKey
 * @param {number} index zero-based follow-up index
 */
export function getOfflineFollowUpQuestion(lang, categoryKey, index) {
  const locale = lang === "en" ? "en" : "de";
  const list =
    FALLBACK_QUESTIONS[locale]?.[categoryKey] ||
    FALLBACK_QUESTIONS[locale].symptomsOwnWords;
  if (index < 0 || index >= list.length) return null;
  return list[index];
}

/**
 * @param {object} session
 * @param {string} categoryKey
 * @returns {boolean}
 */
export function shouldUseLegacyAdaptiveEditor(session, categoryKey) {
  const ans = String(session?.answers?.[categoryKey] || "").trim();
  if (!ans) return false;
  const slice = session?.intakeV1?.[categoryKey];
  if (!slice) return true;
  return slice.status === "complete";
}

/**
 * @param {string} categoryKey
 */
export function isAdaptiveCategory(categoryKey) {
  return PREVISIT_ADAPTIVE_CATEGORY_KEYS.has(categoryKey);
}

/**
 * @param {unknown} raw
 * @returns {{ schemaVersion: number, [key: string]: object } | undefined}
 */
export function normalizeIntakeV1FromStorage(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const schemaVersion = Number(raw.schemaVersion);
  if (schemaVersion !== PREVISIT_INTAKE_SCHEMA_VERSION) return undefined;
  const out = { schemaVersion: PREVISIT_INTAKE_SCHEMA_VERSION };
  for (const key of PREVISIT_ADAPTIVE_CATEGORY_KEYS) {
    const sw = raw[key];
    if (!(sw && typeof sw === "object" && !Array.isArray(sw))) continue;
    out[key] = {
      status: sw.status === "complete" ? "complete" : "active",
      seedStatement: String(sw.seedStatement ?? ""),
      currentQuestion:
        sw.currentQuestion == null ? null : String(sw.currentQuestion),
      qaHistory: Array.isArray(sw.qaHistory)
        ? sw.qaHistory
            .filter((x) => x && typeof x === "object")
            .map((x) => ({
              question: String(x.question ?? "").trim(),
              answer: String(x.answer ?? "").trim(),
            }))
            .filter((x) => x.question && x.answer)
        : [],
      completeness: Math.min(1, Math.max(0, Number(sw.completeness) || 0)),
    };
  }
  return out;
}
