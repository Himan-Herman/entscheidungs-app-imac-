import { getAdaptiveCategoryConfig, isAdaptiveCategoryKey } from "./adaptiveCategories.js";

export const ADAPTIVE_SCHEMA_VERSION = 2;

export function createEmptyAdaptiveSlice(categoryKey) {
  const cfg = getAdaptiveCategoryConfig(categoryKey);
  return {
    status: "active",
    followupsUsed: 0,
    maxFollowups: cfg?.maxFollowups ?? 2,
    currentQuestion: "",
    compiledAnswer: "",
    replies: [],
    askedQuestions: [],
    safetyFlags: [],
  };
}

export function getAdaptiveSlice(session, categoryKey) {
  const existing = session?.intakeV1?.[categoryKey];
  if (existing && typeof existing === "object") return existing;
  return createEmptyAdaptiveSlice(categoryKey);
}

/**
 * Cross-category hints for the adaptive model — excludes active category to reduce duplication tokens.
 */
export function compactAdaptiveContext(answers = {}, excludeCategoryKey = "") {
  const raw = {
    appointmentReason: String(answers.appointmentReason || ""),
    symptomsOwnWords: String(answers.symptomsOwnWords || ""),
    onsetAndCourse: String(answers.onsetAndCourse || ""),
    medications: String(answers.medications || ""),
    preExistingConditions: String(answers.preExistingConditions || ""),
    patientQuestions: String(answers.patientQuestions || ""),
  };
  const out = {};
  const maxLen = 280;
  for (const [k, v] of Object.entries(raw)) {
    if (excludeCategoryKey && k === excludeCategoryKey) continue;
    const t = v.trim().replace(/\s+/g, " ");
    if (!t) continue;
    out[k] = t.length <= maxLen ? t : `${t.slice(0, maxLen - 1)}…`;
  }
  return out;
}

export function normalizeAdaptiveIntakeV1(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const version = Number(raw.schemaVersion);
  if (!Number.isFinite(version)) return undefined;
  const out = { schemaVersion: ADAPTIVE_SCHEMA_VERSION };
  for (const key of Object.keys(raw)) {
    if (!isAdaptiveCategoryKey(key)) continue;
    const v = raw[key];
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    out[key] = {
      status: v.status === "complete" ? "complete" : "active",
      followupsUsed: Math.max(0, Number(v.followupsUsed) || 0),
      maxFollowups: Math.max(1, Number(v.maxFollowups) || 1),
      currentQuestion: String(v.currentQuestion || ""),
      compiledAnswer: String(v.compiledAnswer || ""),
      replies: Array.isArray(v.replies)
        ? v.replies
            .map((r) => String(r || "").trim())
            .filter(Boolean)
            .slice(0, 20)
        : [],
      askedQuestions: Array.isArray(v.askedQuestions)
        ? v.askedQuestions
            .map((q) => String(q || "").trim())
            .filter(Boolean)
            .slice(0, 12)
        : [],
      safetyFlags: Array.isArray(v.safetyFlags)
        ? v.safetyFlags.map((s) => String(s || "").trim()).filter(Boolean)
        : [],
    };
  }
  return out;
}

