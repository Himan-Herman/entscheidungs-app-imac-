import { openai } from '../openaiClient.js';
import { AI_MODULES } from '../config/aiSafetyPolicy.js';
import { sanitizeStructuredPlainText } from './aiSafetySanitizer.js';
import { getOpenAiChatModel } from '../config/openAiModels.js';

const TITLE_MAX = 140;

const SYSTEM = `You summarize continuity across multiple patient-written pre-visit preparations for the same case.
Strict rules:
- Use ONLY information explicitly written by the patient across sessions.
- No diagnosis, no treatment advice, no urgency, no specialist recommendation.
- Do NOT infer disease progression, severity, or clinical concern.
- Do NOT use words like: improved, worsened, better, worse, concerning, dangerous, suspicious, likely, probably (diagnosis), urgent, emergency.
- Describe only recurring themes in neutral wording (e.g. "mentioned again in several entries" / "appears in multiple patient statements").

Return JSON with this exact shape:
{
  "recurringSymptoms": string[],
  "recurringMedications": string[],
  "recurringPatientQuestions": string[],
  "recurringConcerns": string[]
}

Each item: one short neutral bullet in doctorLanguage (max 8 items per array).
Empty array if nothing supported by the text.
`;

function normalizeAnswersBlock(ans) {
  if (!ans || typeof ans !== 'object' || Array.isArray(ans)) return {};
  return {
    appointmentReason: String(ans.appointmentReason || ''),
    symptomsOwnWords: String(ans.symptomsOwnWords || ''),
    onsetAndCourse: String(ans.onsetAndCourse || ''),
    medications: String(ans.medications || ''),
    preExistingConditions: String(ans.preExistingConditions || ''),
    relevantDocuments: String(ans.relevantDocuments || ''),
    patientQuestions: String(ans.patientQuestions || ''),
  };
}

function cleanItems(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function lineHasBannedWording(s) {
  const t = String(s || '').toLowerCase();
  const words = [
    'improved',
    'improvement',
    'worsened',
    'worse',
    'better',
    'concerning',
    'dangerous',
    'suspicious',
    'urgent',
    'emergency',
    'diagnosis',
    'triage',
    'severe',
    'severity',
  ];
  return words.some((w) => {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return re.test(t);
  });
}

function scrubList(arr) {
  return cleanItems(arr).filter((s) => !lineHasBannedWording(s));
}

function polishLine(line, doctorLanguage) {
  return sanitizeStructuredPlainText(line, {
    module: AI_MODULES.PREVISIT_CASE_CONTINUITY,
    locale: doctorLanguage,
  });
}

export async function summarizeCaseContinuity(params) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    const err = new Error('OPENAI_API_KEY missing');
    err.statusCode = 500;
    err.safeMessage =
      'The service is not configured correctly. Please try again later.';
    throw err;
  }

  const caseTitle = String(params?.caseTitle || '').slice(0, TITLE_MAX);
  const patientLanguage = String(params?.patientLanguage || 'de').slice(0, 12);
  const doctorLanguage = String(params?.doctorLanguage || 'de').slice(0, 12);
  const sessions = Array.isArray(params?.sessions) ? params.sessions : [];

  const compact = sessions.map((s) => ({
    date: s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : '',
    ...normalizeAnswersBlock(s.answers),
  }));

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      temperature: 0.1,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: JSON.stringify({
            caseTitle,
            patientLanguage,
            doctorLanguage,
            sessions: compact,
          }),
        },
      ],
    });
  } catch (apiErr) {
    const err = new Error('OpenAI request failed');
    err.statusCode = 502;
    err.safeMessage =
      'The AI service is temporarily unavailable. Please try again later.';
    console.error(
      '[preVisitCaseContinuityClient] OpenAI failed:',
      apiErr?.message || apiErr,
    );
    throw err;
  }

  const raw = completion?.choices?.[0]?.message?.content;
  let parsed = {};
  try {
    parsed = JSON.parse(String(raw || '{}'));
  } catch {
    const err = new Error('Invalid JSON from model');
    err.statusCode = 502;
    err.safeMessage =
      'The AI service returned an invalid response. Please try again later.';
    throw err;
  }

  return {
    recurringSymptoms: scrubList(parsed.recurringSymptoms).map((l) => polishLine(l, doctorLanguage)),
    recurringMedications: scrubList(parsed.recurringMedications).map((l) =>
      polishLine(l, doctorLanguage),
    ),
    recurringPatientQuestions: scrubList(parsed.recurringPatientQuestions).map((l) =>
      polishLine(l, doctorLanguage),
    ),
    recurringConcerns: scrubList(parsed.recurringConcerns).map((l) =>
      polishLine(l, doctorLanguage),
    ),
  };
}
