import { openai } from "../openaiClient.js";

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

const SYSTEM = `You support a pre-visit intake workflow.
Strictly forbidden:
- diagnosis
- disease names or likely conditions
- urgency assessment
- treatment advice
- specialist recommendation
- inferred medical facts

Allowed:
- one short neutral clarification question
- structuring only patient-provided statements
- identifying missing information neutrally
- factual comparison wording only if previousSessionContext is provided explicitly
- if longitudinalCaseCompact is provided, use it only as a short neutral reminder of past patient-authored statements across linked preparations — never infer progression or severity

Return JSON only:
{
  "nextQuestion": string,
  "isComplete": boolean,
  "compiledAnswer": string,
  "safetyFlags": string[]
}

Rules:
- ask only one question at a time
- nextQuestion must be in patientLanguage
- if complete: isComplete true, nextQuestion empty
- compiledAnswer must contain only patient-provided facts in neutral wording
- safetyFlags allowed only: missing_information, unclear_statement, category_complete, needs_patient_confirmation
- do not invent missing facts
`;

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

  const previousReplies = Array.isArray(params?.previousReplies)
    ? params.previousReplies.map((r) => toShortString(r, 800)).filter(Boolean)
    : [];
  const maxFollowupsClient = Number(params?.maxFollowups);
  const maxFollowups = clamp(
    Number.isFinite(maxFollowupsClient)
      ? maxFollowupsClient
      : CATEGORY_LIMITS[categoryKey],
    1,
    Math.min(MAX_FOLLOWUPS_SERVER, CATEGORY_LIMITS[categoryKey])
  );

  if (previousReplies.length >= maxFollowups) {
    return {
      nextQuestion: "",
      isComplete: true,
      compiledAnswer: toShortString(
        params?.existingCategoryAnswer || params?.currentPatientReply || "",
        4000
      ),
      safetyFlags: ["category_complete"],
    };
  }

  const payload = {
    patientLanguage: toShortString(params?.patientLanguage || "de", 12),
    categoryKey,
    categoryTitle: toShortString(params?.categoryTitle || categoryKey, 100),
    existingCategoryAnswer: toShortString(params?.existingCategoryAnswer || ""),
    currentPatientReply: toShortString(params?.currentPatientReply || ""),
    previousReplies,
    maxFollowups,
    compactContext:
      params?.compactContext && typeof params.compactContext === "object"
        ? params.compactContext
        : {},
    previousSessionContext:
      params?.previousSessionContext && typeof params.previousSessionContext === "object"
        ? params.previousSessionContext
        : undefined,
    longitudinalCaseCompact: toShortString(params?.longitudinalCaseCompact || "", 2400),
  };

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.15,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
  } catch (apiErr) {
    const err = new Error("OpenAI request failed");
    err.statusCode = 502;
    err.safeMessage =
      "The AI service is temporarily unavailable. Please try again later.";
    console.error("[preVisitAdaptiveIntakeClient] OpenAI failed:", apiErr?.message || apiErr);
    throw err;
  }

  let parsed = {};
  try {
    parsed = JSON.parse(String(completion?.choices?.[0]?.message?.content || "{}"));
  } catch {
    parsed = {};
  }

  const isComplete = Boolean(parsed.isComplete);
  const compiledAnswer = toShortString(
    parsed.compiledAnswer || payload.existingCategoryAnswer || payload.currentPatientReply,
    4000
  );
  const nextQuestion = isComplete ? "" : toShortString(parsed.nextQuestion || "", 240);
  const safetyFlags = cleanFlags(parsed.safetyFlags);

  return {
    nextQuestion,
    isComplete,
    compiledAnswer,
    safetyFlags: safetyFlags.length ? safetyFlags : isComplete ? ["category_complete"] : [],
  };
}

