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
    safetyFlags: [],
  };
}

export function getAdaptiveSlice(session, categoryKey) {
  const existing = session?.intakeV1?.[categoryKey];
  if (existing && typeof existing === "object") return existing;
  return createEmptyAdaptiveSlice(categoryKey);
}

export function compactAdaptiveContext(answers = {}) {
  return {
    appointmentReason: String(answers.appointmentReason || "").slice(0, 500),
    symptomsOwnWords: String(answers.symptomsOwnWords || "").slice(0, 500),
    onsetAndCourse: String(answers.onsetAndCourse || "").slice(0, 500),
    medications: String(answers.medications || "").slice(0, 500),
    preExistingConditions: String(answers.preExistingConditions || "").slice(0, 500),
  };
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
      safetyFlags: Array.isArray(v.safetyFlags)
        ? v.safetyFlags.map((s) => String(s || "").trim()).filter(Boolean)
        : [],
    };
  }
  return out;
}

