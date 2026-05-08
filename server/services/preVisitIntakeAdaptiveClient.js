/**
 * Pre-Visit adaptive intake (symptoms prototype): bounded follow-up questions only.
 * No diagnosis, urgency, treatment, specialist recommendation, or invented symptoms.
 */
import { openai } from '../openaiClient.js';

const MODEL = 'gpt-4o-mini';
const SERVER_MAX_FOLLOWUPS = 6;
const DEFAULT_MAX_FOLLOWUPS = 4;

const SYSTEM = `You help patients DOCUMENT what they already said before a doctor visit.
You are NOT a doctor. You do NOT diagnose, triage, assess urgency, recommend treatment or specialists, infer causes, or add symptoms the patient did not mention.

Your job: produce at most ONE short neutral follow-up question to improve completeness of the patient's OWN wording — OR mark the category done.

Output rules:
- Reply as a single JSON object ONLY with keys: "done" (boolean), "followUpQuestion" (string or null), "completeness" (number 0-1).
- If done is true: followUpQuestion MUST be null.
- If done is false: followUpQuestion MUST be one concise question (max ~120 characters) in the patient's language (see patientLanguage).
- Questions must be generic documentation prompts (timing, pattern, triggers/relievers, context the patient thinks matters). Never name a condition. Never warn about emergencies. Never suggest what the doctor should do.
- completeness is your conservative estimate of how well the combined text covers what the patient might want recorded (0-1). It does NOT measure medical severity.
- If the latest patient text is empty or unusable, set done false and ask one neutral clarification, unless follow-up limit is reached (then done true).
- If you already have enough plain-language detail for this category, set done true.`;

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function isNonEmptyString(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

function extractJsonObject(text) {
  const t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  return t;
}

function normalizeQaHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const q = row.question != null ? String(row.question).trim() : '';
    const a = row.answer != null ? String(row.answer).trim() : '';
    if (q && a) out.push({ question: q, answer: a });
  }
  return out;
}

/**
 * @param {{
 *   patientLanguage?: string,
 *   seedStatement: string,
 *   qaHistory?: { question: string, answer: string }[],
 *   maxFollowUps?: number,
 * }} params
 * @returns {Promise<{ done: boolean, followUpQuestion: string | null, completeness: number }>}
 */
export async function runSymptomsAdaptiveTurn(params) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    const err = new Error('OPENAI_API_KEY missing');
    err.statusCode = 500;
    err.safeMessage =
      'The service is not configured correctly. Please try again later.';
    throw err;
  }

  const patientLanguage = params?.patientLanguage != null
    ? String(params.patientLanguage).slice(0, 12)
    : 'de';

  const seedStatement =
    params?.seedStatement != null ? String(params.seedStatement).trim() : '';
  if (!seedStatement) {
    const err = new Error('seedStatement required');
    err.statusCode = 400;
    err.safeMessage = 'Invalid request.';
    throw err;
  }

  const qaHistory = normalizeQaHistory(params?.qaHistory);
  const requestedMax = Number.isFinite(Number(params?.maxFollowUps))
    ? Number(params.maxFollowUps)
    : DEFAULT_MAX_FOLLOWUPS;
  const maxFollowUps = clamp(
    requestedMax,
    1,
    SERVER_MAX_FOLLOWUPS
  );

  if (qaHistory.length >= maxFollowUps) {
    return {
      done: true,
      followUpQuestion: null,
      completeness: clamp(0.75 + qaHistory.length * 0.02, 0, 1),
    };
  }

  const payload = {
    patientLanguage,
    category: 'symptomsOwnWords',
    maxFollowUps,
    followUpsSoFar: qaHistory.length,
    seedStatement: seedStatement.slice(0, 6000),
    qaHistory: qaHistory.map((p) => ({
      question: p.question.slice(0, 2000),
      answer: p.answer.slice(0, 2000),
    })),
  };

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.15,
      max_tokens: 320,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Return next JSON action for symptomsOwnWords intake',
            payload,
          }),
        },
      ],
    });
  } catch (apiErr) {
    console.error(
      '[preVisitIntakeAdaptiveClient] OpenAI failed:',
      apiErr?.message || apiErr
    );
    const err = new Error('OpenAI request failed');
    err.statusCode = 502;
    err.safeMessage =
      'The AI service is temporarily unavailable. Please try again later.';
    throw err;
  }

  const raw = completion?.choices?.[0]?.message?.content;
  if (!isNonEmptyString(raw)) {
    const err = new Error('Empty model response');
    err.statusCode = 502;
    err.safeMessage =
      'The AI service returned an invalid response. Please try again later.';
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch {
    const err = new Error('Invalid JSON from model');
    err.statusCode = 502;
    err.safeMessage =
      'The AI service returned an invalid response. Please try again later.';
    throw err;
  }

  const done = Boolean(parsed.done);
  let followUpQuestion =
    parsed.followUpQuestion == null ? null : String(parsed.followUpQuestion).trim();
  let completeness = Number(parsed.completeness);
  if (!Number.isFinite(completeness)) completeness = 0.5;
  completeness = clamp(completeness, 0, 1);

  if (done) {
    followUpQuestion = null;
  } else if (!followUpQuestion) {
    followUpQuestion = null;
  } else {
    followUpQuestion = followUpQuestion.slice(0, 400);
  }

  if (!done && followUpQuestion && qaHistory.length + 1 > maxFollowUps) {
    return {
      done: true,
      followUpQuestion: null,
      completeness: clamp(completeness, 0, 1),
    };
  }

  return { done, followUpQuestion, completeness };
}
