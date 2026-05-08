import { openai } from "../openaiClient.js";
import { CATEGORY_MICRO_RULES } from "./adaptive/adaptiveCategoryMeta.js";
import {
  ADAPTIVE_SYSTEM_PROMPT,
  ADAPTIVE_INSTR_BLOCK,
  MULTILINGUAL_STYLE_NOTE,
  OUTPUT_VIOLATION_PATTERNS,
  STRICT_RETRY_SUFFIX,
  listViolationPatternsSummary,
} from "./adaptive/adaptivePromptRules.js";
import {
  buildAdaptiveUserBlob,
  buildCrossCategoryHints,
  compactLongitudinal,
  compactRecentQuestions,
  normalizePreviousSessionContext,
  trimPreviousReplies,
} from "./adaptive/adaptiveIntakeCompactContext.js";
import { sanitizeAdaptiveModelOutput } from "./adaptive/adaptiveIntakeOutputGuard.js";

const MODEL = "gpt-4o-mini";
const MAX_FOLLOWUPS_SERVER = 6;
const ALLOWED_FLAGS = new Set([
  "missing_information",
  "unclear_statement",
  "category_complete",
  "needs_patient_confirmation",
]);

const CATEGORY_LIMITS = {
  symptomsOwnWords: 4,
  onsetAndCourse: 3,
  medications: 3,
  preExistingConditions: 2,
  patientQuestions: 2,
};

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function cleanFlags(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x || "").trim())
    .filter((x) => ALLOWED_FLAGS.has(x))
    .slice(0, 4);
}

function toShortString(v, max = 2000) {
  return String(v || "").trim().slice(0, max);
}

function countPatternViolations(text) {
  if (!text) return 0;
  const s = String(text);
  let n = 0;
  for (const re of OUTPUT_VIOLATION_PATTERNS) {
    if (re.test(s)) n += 1;
  }
  return n;
}

function violationScore(parsed) {
  return (
    countPatternViolations(parsed?.nextQuestion) +
    countPatternViolations(parsed?.compiledAnswer)
  );
}

async function callOpenAI(system, userJson) {
  const t0 = Date.now();
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.12,
    max_tokens: 520,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userJson },
    ],
  });
  const durationMs = Date.now() - t0;
  const usage = completion?.usage || {};
  return { completion, durationMs, usage };
}

function logAdaptiveMetrics({
  categoryKey,
  durationMs,
  usage,
  previousRepliesCount,
  crossCategoryHintCount,
  isComplete,
  retryUsed,
  sanitizeMeta,
}) {
  console.info(
    JSON.stringify({
      event: "adaptive_intake_step",
      categoryKey,
      durationMs,
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
      previousRepliesCount,
      crossCategoryHintCount,
      isComplete,
      retryUsed,
      fallbackQuestionUsed: Boolean(sanitizeMeta?.usedFallbackQuestion),
      strippedCompiled: Boolean(sanitizeMeta?.strippedCompiled),
    }),
  );
}

export async function runAdaptiveIntakeStep(params) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    const err = new Error("OPENAI_API_KEY missing");
    err.statusCode = 500;
    err.safeMessage =
      "The service is not configured correctly. Please try again later.";
    throw err;
  }

  const categoryKey = String(params?.categoryKey || "").trim();
  if (!CATEGORY_LIMITS[categoryKey]) {
    const err = new Error("invalid category");
    err.statusCode = 400;
    err.safeMessage = "Invalid request.";
    throw err;
  }

  const previousReplies = trimPreviousReplies(params?.previousReplies);
  const maxFollowupsClient = Number(params?.maxFollowups);
  const maxFollowups = clamp(
    Number.isFinite(maxFollowupsClient)
      ? maxFollowupsClient
      : CATEGORY_LIMITS[categoryKey],
    1,
    Math.min(MAX_FOLLOWUPS_SERVER, CATEGORY_LIMITS[categoryKey]),
  );

  if (previousReplies.length >= maxFollowups) {
    return {
      nextQuestion: "",
      isComplete: true,
      compiledAnswer: toShortString(
        params?.existingCategoryAnswer || params?.currentPatientReply || "",
        4000,
      ),
      safetyFlags: ["category_complete"],
    };
  }

  const patientLanguage = toShortString(params?.patientLanguage || "de", 12);
  const compactCtx =
    params?.compactContext && typeof params.compactContext === "object"
      ? params.compactContext
      : {};
  const crossCategoryLines = buildCrossCategoryHints(compactCtx, categoryKey);
  const recentQuestions = compactRecentQuestions(params?.recentQuestions);
  const longitudinalStr = compactLongitudinal(
    params?.longitudinalCaseCompact || "",
  );
  const previousSessionStr = normalizePreviousSessionContext(
    params?.previousSessionContext,
  );

  const categoryRule =
    CATEGORY_MICRO_RULES[categoryKey] ||
    "Stop when enough patient-stated detail exists.";

  const userBlob = buildAdaptiveUserBlob({
    patientLanguage,
    categoryKey,
    categoryTitle: toShortString(params?.categoryTitle || categoryKey, 100),
    categoryRule,
    existingCategoryAnswer: params?.existingCategoryAnswer || "",
    currentPatientReply: params?.currentPatientReply || "",
    previousReplies,
    maxFollowups,
    crossCategoryLines,
    previousSessionStr,
    longitudinalStr,
    recentQuestions,
    forbiddenSummary: listViolationPatternsSummary(),
  });

  const userJsonBase = JSON.stringify({
    task: "adaptive_intake_category_step",
    instr: ADAPTIVE_INSTR_BLOCK,
    ml: MULTILINGUAL_STYLE_NOTE,
    payload: userBlob,
  });

  let parsed = {};
  let durationMs = 0;
  let usage = {};
  let retryUsed = false;

  const runOnce = async (isRetry) => {
    const sys = isRetry
      ? ADAPTIVE_SYSTEM_PROMPT + STRICT_RETRY_SUFFIX
      : ADAPTIVE_SYSTEM_PROMPT;
    const { completion, durationMs: d, usage: u } = await callOpenAI(
      sys,
      userJsonBase,
    );
    durationMs += d;
    usage = u;
    try {
      parsed = JSON.parse(
        String(completion?.choices?.[0]?.message?.content || "{}"),
      );
    } catch {
      parsed = {};
    }
  };

  await runOnce(false);

  if (violationScore(parsed) > 0) {
    retryUsed = true;
    await runOnce(true);
  }

  let isComplete = Boolean(parsed.isComplete);
  let rawNext = isComplete
    ? ""
    : toShortString(parsed.nextQuestion || "", 220);
  if (!isComplete && !rawNext.trim()) {
    isComplete = true;
    rawNext = "";
  }
  const rawCompiled = toShortString(
    parsed.compiledAnswer ||
      params?.existingCategoryAnswer ||
      params?.currentPatientReply ||
      "",
    4000,
  );

  const sanitized = sanitizeAdaptiveModelOutput({
    patientLanguage,
    isComplete,
    nextQuestion: rawNext,
    compiledAnswer: rawCompiled,
    existingCategoryAnswer: params?.existingCategoryAnswer || "",
    currentPatientReply: params?.currentPatientReply || "",
  });

  const compiledAnswer = toShortString(sanitized.compiledAnswer, 4000);
  const nextQuestion = isComplete ? "" : toShortString(sanitized.nextQuestion, 220);
  const safetyFlags = cleanFlags(parsed.safetyFlags);

  logAdaptiveMetrics({
    categoryKey,
    durationMs,
    usage,
    previousRepliesCount: previousReplies.length,
    crossCategoryHintCount: crossCategoryLines.length,
    isComplete,
    retryUsed,
    sanitizeMeta: sanitized.meta,
  });

  return {
    nextQuestion,
    isComplete,
    compiledAnswer,
    safetyFlags: safetyFlags.length
      ? safetyFlags
      : isComplete
        ? ["category_complete"]
        : [],
  };
}
