/**
 * Token-efficient payload shaping for adaptive intake — no large timelines by default.
 */

const CC_KEYS = [
  "appointmentReason",
  "symptomsOwnWords",
  "onsetAndCourse",
  "medications",
  "preExistingConditions",
  "patientQuestions",
];

const MAX_REPLY_SNIPPET = 320;
const MAX_REPLY_ITEMS = 6;
const MAX_CROSS_CAT = 220;
const MAX_LONGITUDINAL = 900;
const MAX_PREV_SESSION = 700;

function trim(s, n) {
  const t = String(s || "").trim().replace(/\s+/g, " ");
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function dedupeLines(lines) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const k = line.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(line);
  }
  return out;
}

/**
 * Builds compact cross-category lines; skips empty and optionally the active category
 * (avoid duplicating the same text already in existing/current reply).
 */
export function buildCrossCategoryHints(compactContext, excludeCategoryKey) {
  if (!compactContext || typeof compactContext !== "object") return [];
  const lines = [];
  for (const key of CC_KEYS) {
    if (excludeCategoryKey && key === excludeCategoryKey) continue;
    const v = trim(compactContext[key], MAX_CROSS_CAT);
    if (v) lines.push(`${key}:${v}`);
  }
  return dedupeLines(lines);
}

export function trimPreviousReplies(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((r) => trim(r, MAX_REPLY_SNIPPET))
    .filter(Boolean)
    .slice(-MAX_REPLY_ITEMS);
}

export function compactRecentQuestions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((q) => trim(q, 140))
    .filter(Boolean)
    .slice(-6);
}

export function normalizePreviousSessionContext(ctx) {
  if (ctx == null) return undefined;
  if (typeof ctx === "string") return trim(ctx, MAX_PREV_SESSION);
  if (typeof ctx === "object") {
    if (typeof ctx.summary === "string") return trim(ctx.summary, MAX_PREV_SESSION);
    try {
      return trim(JSON.stringify(ctx), MAX_PREV_SESSION);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function compactLongitudinal(raw) {
  return trim(raw, MAX_LONGITUDINAL);
}

/**
 * Single user message blob — abbreviated keys reduce prompt tokens.
 */
export function buildAdaptiveUserBlob({
  patientLanguage,
  categoryKey,
  categoryTitle,
  categoryRule,
  existingCategoryAnswer,
  currentPatientReply,
  previousReplies,
  maxFollowups,
  crossCategoryLines,
  previousSessionStr,
  longitudinalStr,
  recentQuestions,
  forbiddenSummary,
}) {
  return {
    lng: patientLanguage,
    cat: categoryKey,
    title: categoryTitle,
    catRule: categoryRule,
    existing: trim(existingCategoryAnswer, 2000),
    current: trim(currentPatientReply, 2000),
    prevReplies: previousReplies,
    maxFU: maxFollowups,
    otherCats: crossCategoryLines,
    prevSess: previousSessionStr || undefined,
    longit: longitudinalStr || undefined,
    askedBefore: recentQuestions.length ? recentQuestions : undefined,
    forbiddenPatterns: forbiddenSummary,
  };
}
