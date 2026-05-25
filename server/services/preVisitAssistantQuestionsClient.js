/**
 * Pre-Visit: bilingual assistant-style orientation questions for the doctor visit.
 * Questions only — no AI answers. Patient fills answers locally for the PDF.
 */
import { openai } from '../openaiClient.js';
import { ALLOWED_COMMUNICATION_STYLE, AI_MODULES } from '../config/aiSafetyPolicy.js';
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from './aiSafetySanitizer.js';
import { PREVISIT_ANSWER_KEYS, normalizeAnswers } from './preVisitOpenAiClient.js';
import { getOpenAiChatModel } from '../config/openAiModels.js';

const MIN_QUESTIONS = 2;
const MAX_QUESTIONS = 7;

const SYSTEM_INSTRUCTION = `You help patients prepare for a doctor appointment by suggesting neutral documentation questions.
You are NOT a doctor. You do NOT diagnose, triage, assess urgency, recommend treatment or specialists, or infer medical causes.

Your job: based ONLY on the patient's existing pre-visit answers (and optional timeline notes), produce between ${MIN_QUESTIONS} and ${MAX_QUESTIONS} short questions that a professional medical assistant would ask to help the patient orient themselves and give the doctor clearer context.

Rules:
- Output ONLY questions — never answers, interpretations, or clinical conclusions.
- Choose the number of questions (${MIN_QUESTIONS}–${MAX_QUESTIONS}) based on how much clarification would help for THIS case; simpler cases need fewer questions.
- Each question must have TWO forms:
  • patientQuestion: warm, plain language in patientLanguage — what the patient reads and answers.
  • doctorQuestion: concise professional wording in doctorLanguage — what the doctor sees alongside the patient's answer.
- Questions must help the patient reflect on symptoms, course, medications, documents, concerns, or what they want clarified — only topics already touched in the patient answers.
- Do NOT introduce new symptoms, diagnoses, or tests the patient did not mention.
- Do NOT ask emergency or urgency questions.
- Tone: supportive medical assistant preparing documentation, not clinical judgment.

Output MUST be a single JSON object:
{
  "questions": [ { "id": "q1", "patientQuestion": "...", "doctorQuestion": "..." }, ... ],
  "safetyNotice": "one short sentence in doctorLanguage: patient-reported prep only, not clinical evaluation"
}

${ALLOWED_COMMUNICATION_STYLE}`;

function isNonEmptyString(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

function extractJsonObject(text) {
  const t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  return t;
}

function normalizeTimelineContext(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const summary = raw.summary && typeof raw.summary === 'object' ? raw.summary : null;
  const caseTopic = raw.caseTopic != null ? String(raw.caseTopic).trim() : '';
  if (!summary && !caseTopic) return null;
  return {
    caseTopic: caseTopic.slice(0, 500),
    summary: summary
      ? {
          newlyMentioned: Array.isArray(summary.newlyMentioned)
            ? summary.newlyMentioned.slice(0, 12).map((x) => String(x || '').slice(0, 200))
            : [],
          stillMentioned: Array.isArray(summary.stillMentioned)
            ? summary.stillMentioned.slice(0, 12).map((x) => String(x || '').slice(0, 200))
            : [],
        }
      : null,
  };
}

function validateQuestions(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const { questions, safetyNotice } = parsed;
  if (!Array.isArray(questions)) return null;
  if (questions.length < MIN_QUESTIONS || questions.length > MAX_QUESTIONS) return null;
  if (typeof safetyNotice !== 'string' || !safetyNotice.trim()) return null;

  const normalized = [];
  for (let i = 0; i < questions.length; i++) {
    const row = questions[i];
    if (!row || typeof row !== 'object') return null;
    const patientQuestion =
      row.patientQuestion != null ? String(row.patientQuestion).trim() : '';
    const doctorQuestion =
      row.doctorQuestion != null ? String(row.doctorQuestion).trim() : '';
    if (!patientQuestion || !doctorQuestion) return null;
    const id =
      row.id != null && String(row.id).trim()
        ? String(row.id).trim().slice(0, 24)
        : `q${i + 1}`;
    normalized.push({
      id,
      patientQuestion: patientQuestion.slice(0, 600),
      doctorQuestion: doctorQuestion.slice(0, 600),
    });
  }
  return {
    questions: normalized,
    safetyNotice: safetyNotice.trim().slice(0, 500),
  };
}

/**
 * @param {{
 *   patientLanguage?: string,
 *   doctorLanguage?: string,
 *   answers: object,
 *   caseTimeline?: object | null,
 *   longitudinalSnippet?: string | null,
 * }} params
 * @returns {Promise<{ questions: { id: string, patientQuestion: string, doctorQuestion: string }[], safetyNotice: string }>}
 */
export async function generatePreVisitAssistantQuestions(params) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    const err = new Error('OPENAI_API_KEY missing');
    err.statusCode = 500;
    err.safeMessage =
      'The service is not configured correctly. Please try again later.';
    throw err;
  }

  const patientLanguage =
    params?.patientLanguage != null ? String(params.patientLanguage) : 'de';
  const doctorLanguage =
    params?.doctorLanguage != null ? String(params.doctorLanguage) : 'de';

  if (
    !params?.answers ||
    typeof params.answers !== 'object' ||
    Array.isArray(params.answers)
  ) {
    const err = new Error('answers required');
    err.statusCode = 400;
    err.safeMessage = 'Invalid request.';
    throw err;
  }

  const answers = normalizeAnswers(params.answers);
  const hasContent = PREVISIT_ANSWER_KEYS.some((k) => answers[k]?.trim());
  if (!hasContent) {
    const err = new Error('answers empty');
    err.statusCode = 400;
    err.safeMessage = 'Invalid request.';
    throw err;
  }

  const timelineContext = normalizeTimelineContext(params?.caseTimeline);
  const longitudinalSnippet =
    params?.longitudinalSnippet != null
      ? String(params.longitudinalSnippet).trim().slice(0, 2000)
      : '';

  const userPayload = {
    task: 'Generate assistant-style bilingual orientation questions JSON',
    patientLanguage,
    doctorLanguage,
    questionCountRange: { min: MIN_QUESTIONS, max: MAX_QUESTIONS },
    answers,
    caseTimeline: timelineContext,
    longitudinalSnippet: longitudinalSnippet || undefined,
    requiredOutputShape: {
      questions: [
        {
          id: 'string',
          patientQuestion: 'string in patientLanguage',
          doctorQuestion: 'string in doctorLanguage',
        },
      ],
      safetyNotice: 'string in doctorLanguage',
    },
  };

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      temperature: 0.25,
      max_tokens: 1400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        {
          role: 'user',
          content: JSON.stringify(userPayload),
        },
      ],
    });
  } catch (apiErr) {
    console.error(
      '[preVisitAssistantQuestionsClient] OpenAI failed:',
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

  let validated = validateQuestions(parsed);
  if (!validated) {
    const err = new Error('Invalid question shape');
    err.statusCode = 502;
    err.safeMessage =
      'The AI service returned an invalid response. Please try again later.';
    throw err;
  }

  const sanitizedNotice = sanitizeAiOutput(validated.safetyNotice, {
    module: AI_MODULES.PREVISIT_ASSISTANT_QUESTIONS,
  });
  validated = {
    ...validated,
    safetyNotice: sanitizedNotice.text,
    questions: validated.questions.map((q) => ({
      ...q,
      patientQuestion: sanitizeAiOutput(q.patientQuestion, {
        module: AI_MODULES.PREVISIT_ASSISTANT_QUESTIONS,
      }).text,
      doctorQuestion: sanitizeAiOutput(q.doctorQuestion, {
        module: AI_MODULES.PREVISIT_ASSISTANT_QUESTIONS,
      }).text,
    })),
  };

  if (
    shouldRegenerateUnsafeOutput(validated.safetyNotice, {
      module: AI_MODULES.PREVISIT_ASSISTANT_QUESTIONS,
    })
  ) {
    const err = new Error('Unsafe output');
    err.statusCode = 502;
    err.safeMessage =
      'The AI service returned an invalid response. Please try again later.';
    throw err;
  }

  return validated;
}
