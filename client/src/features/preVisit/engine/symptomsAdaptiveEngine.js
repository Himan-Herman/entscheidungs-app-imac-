/**
 * Bounded adaptive intake — prototype category: symptomsOwnWords only.
 * No diagnosis / triage / treatment / specialist logic (client-side guardrails + server prompt).
 */

export const PREVISIT_INTAKE_SCHEMA_VERSION = 1;

/** Max follow-up Q&A pairs after the initial free-text seed (configurable cap). */
export const PREVISIT_SYMPTOMS_MAX_FOLLOWUPS = 4;

/** Categories that use adaptive engine (others stay linear). */
export const PREVISIT_ADAPTIVE_CATEGORY_KEYS = new Set(["symptomsOwnWords"]);

const FALLBACK_DE = [
  "Seit wann bestehen die Beschwerden?",
  "Sind sie eher dauerhaft oder kommen und gehen sie?",
  "Gibt es etwas, wovon Sie denken, dass es die Beschwerden beeinflusst (besser oder schlechter)?",
  "Was ist Ihnen noch wichtig, damit der Arzt oder die Ärztin Ihre Schilderung versteht?",
];

const FALLBACK_EN = [
  "When did the symptoms start?",
  "Are they mostly constant, or do they come and go?",
  "Is there anything you feel makes them better or worse?",
  "What else do you want the clinician to know about how you experience this?",
];

export function createEmptySymptomsIntakeSlice() {
  return {
    status: "active",
    seedStatement: "",
    currentQuestion: null,
    qaHistory: [],
    completeness: 0,
  };
}

/**
 * @param {string} seed
 * @param {{ question: string, answer: string }[]} qaHistory
 */
export function compileSymptomsDocumentation(seed, qaHistory) {
  const s = String(seed || "").trim();
  const lines = [];
  if (s) lines.push(s);
  const pairs = Array.isArray(qaHistory) ? qaHistory : [];
  if (pairs.length) {
    lines.push("");
    lines.push("Nachfragen (Dokumentation):");
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
 * @param {number} index zero-based follow-up index
 */
export function getOfflineFollowUpQuestion(lang, index) {
  const list = lang === "en" ? FALLBACK_EN : FALLBACK_DE;
  if (index < 0 || index >= list.length) return null;
  return list[index];
}

/**
 * @param {object} session
 * @returns {boolean}
 */
export function shouldUseLegacySymptomsEditor(session) {
  const ans = String(session?.answers?.symptomsOwnWords || "").trim();
  if (!ans) return false;
  const slice = session?.intakeV1?.symptomsOwnWords;
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
 * @returns {{ schemaVersion: number, symptomsOwnWords?: object } | undefined}
 */
export function normalizeIntakeV1FromStorage(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const schemaVersion = Number(raw.schemaVersion);
  if (schemaVersion !== PREVISIT_INTAKE_SCHEMA_VERSION) return undefined;
  const out = { schemaVersion: PREVISIT_INTAKE_SCHEMA_VERSION };
  const sw = raw.symptomsOwnWords;
  if (sw && typeof sw === "object" && !Array.isArray(sw)) {
    out.symptomsOwnWords = {
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
      completeness: Math.min(
        1,
        Math.max(0, Number(sw.completeness) || 0)
      ),
    };
  }
  return out;
}
