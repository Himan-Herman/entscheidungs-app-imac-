/**
 * Pre-Visit only: structured doctor-facing text from patient answers via OpenAI.
 * Does not diagnose or give medical advice — transform-only per system prompt.
 */
import { openai } from '../openaiClient.js';
import { ALLOWED_COMMUNICATION_STYLE, AI_MODULES } from '../config/aiSafetyPolicy.js';
import { sanitizeStructuredPlainText } from './aiSafetySanitizer.js';
import { getOpenAiChatModel } from '../config/openAiModels.js';


export const PREVISIT_ANSWER_KEYS = [
  'appointmentReason',
  'symptomsOwnWords',
  'onsetAndCourse',
  'medications',
  'preExistingConditions',
  'relevantDocuments',
  'patientQuestions',
];

const SYSTEM_INSTRUCTION = `You are not a doctor. You do not diagnose. You do not provide medical advice. You do not assess urgency. You do not recommend specialists or where to seek care.

Language roles (critical):
- patientLanguage: identifies the language the patient used when writing the values in "answers". Treat every answer string as being in that language (source language).
- doctorLanguage: the ONLY target language for your output. Every string in "doctorVersion" and in "safetyNotice" MUST be written entirely in doctorLanguage — including translations from patientLanguage when needed.

Your only job is to take the patient's own statements (field-by-field) and produce a neutral, structured doctor-facing version in doctorLanguage.

Rules:
- Translate from patientLanguage into doctorLanguage where they differ; tighten wording and structure text only from what the patient provided.
- Do NOT add facts, interpretations, causes, severity, or clinical implications not explicitly stated by the patient.
- Do NOT infer missing details. If a field is empty or whitespace-only in patient answers, set that output field to the "not specified" phrase appropriate for doctorLanguage (for German use exactly: "nicht angegeben"; for English use exactly: "not specified"; for other languages use the established equivalent in doctorLanguage).
- If the patient text is present but too vague to restate faithfully, use the "unclear" phrase appropriate for doctorLanguage (German: "unklar"; English: "unclear"; other languages: equivalent in doctorLanguage).
- Preserve the patient's meaning. Light clarification of wording is allowed only when it does not add medical content.
- Output MUST be a single JSON object with exactly two keys: "doctorVersion" and "safetyNotice", matching the schema described in the user message.
- "doctorVersion" must contain exactly these string keys: appointmentReason, symptomsOwnWords, onsetAndCourse, medications, preExistingConditions, relevantDocuments, patientQuestions — all values must be strings written in doctorLanguage only.
- "safetyNotice" must be one short sentence written in doctorLanguage reminding that the content is patient-reported only and not a substitute for clinical evaluation (no diagnosis/treatment/urgency implied).

${ALLOWED_COMMUNICATION_STYLE}`;

export function normalizeAnswers(input) {
  const src =
    input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const out = {};
  for (const key of PREVISIT_ANSWER_KEYS) {
    const v = src[key];
    out[key] = v == null ? '' : String(v);
  }
  return out;
}

function isNonEmptyString(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

function extractJsonObject(text) {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    return fence[1].trim();
  }
  return t;
}

function validateAndNormalizeResponse(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const { doctorVersion, safetyNotice } = parsed;
  if (!doctorVersion || typeof doctorVersion !== 'object' || Array.isArray(doctorVersion)) {
    return null;
  }
  if (typeof safetyNotice !== 'string' || !safetyNotice.trim()) {
    return null;
  }
  const normalized = {};
  for (const key of PREVISIT_ANSWER_KEYS) {
    const v = doctorVersion[key];
    if (typeof v !== 'string') {
      return null;
    }
    normalized[key] = v;
  }
  return {
    doctorVersion: normalized,
    safetyNotice: safetyNotice.trim(),
  };
}

/**
 * @param {{ patientLanguage?: string, doctorLanguage?: string, answers: object }} params
 * @returns {Promise<{ doctorVersion: Record<string,string>, safetyNotice: string }>}
 */
export async function generatePreVisitDoctorVersion(params) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    const err = new Error('OPENAI_API_KEY missing');
    err.statusCode = 500;
    err.safeMessage =
      'The service is not configured correctly. Please try again later.';
    throw err;
  }

  const patientLanguage = params?.patientLanguage != null
    ? String(params.patientLanguage)
    : 'de';
  const doctorLanguage = params?.doctorLanguage != null
    ? String(params.doctorLanguage)
    : 'de';

  if (!params?.answers || typeof params.answers !== 'object' || Array.isArray(params.answers)) {
    const err = new Error('answers required');
    err.statusCode = 400;
    err.safeMessage = 'Invalid request.';
    throw err;
  }

  const answers = normalizeAnswers(params.answers);

  const userPayload = {
    task: 'Transform patient answers into doctorVersion JSON',
    languageRoles: {
      patientLanguage:
        'Source language code: the language the patient used in the answer fields. Read all answer text as being in this language.',
      doctorLanguage:
        'Target output language code: produce every character of doctorVersion fields and safetyNotice in this language only.',
    },
    patientLanguage,
    doctorLanguage,
    answers,
    requiredOutputShape: {
      doctorVersion: Object.fromEntries(PREVISIT_ANSWER_KEYS.map((k) => [k, 'string'])),
      safetyNotice: 'string',
    },
  };

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      temperature: 0.2,
      max_tokens: 1200,
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
    console.error('[preVisitOpenAiClient] OpenAI request failed:', apiErr?.message || apiErr);
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

  const normalized = validateAndNormalizeResponse(parsed);
  if (!normalized) {
    const err = new Error('Response schema validation failed');
    err.statusCode = 502;
    err.safeMessage =
      'The AI service returned an invalid response. Please try again later.';
    throw err;
  }

  for (const key of PREVISIT_ANSWER_KEYS) {
    normalized.doctorVersion[key] = sanitizeStructuredPlainText(
      normalized.doctorVersion[key],
      {
        module: AI_MODULES.PREVISIT_DOCTOR_TRANSFORM,
        locale: doctorLanguage,
      },
    );
  }
  normalized.safetyNotice = sanitizeStructuredPlainText(normalized.safetyNotice, {
    module: AI_MODULES.PREVISIT_DOCTOR_TRANSFORM,
    locale: doctorLanguage,
  });

  return normalized;
}
