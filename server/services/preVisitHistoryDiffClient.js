import { openai } from '../openaiClient.js';
import { AI_MODULES } from '../config/aiSafetyPolicy.js';
import { sanitizeStructuredPlainText } from './aiSafetySanitizer.js';
import { getOpenAiChatModel } from '../config/openAiModels.js';


const SYSTEM = `You compare two patient-reported pre-visit documents over time.
Strict rules:
- No diagnosis
- No treatment advice
- No urgency assessment
- No specialist recommendation
- No inferred medical facts
- Only compare what is explicitly stated by the patient

Allowed wording themes:
- factual presence/absence across the two snapshots
- you may phrase additions as neutral statements such as "patient added new information regarding …" ONLY when clearly new compared to the earlier document
- you may phrase omissions neutrally such as "patient did not mention previously reported information about …" ONLY when something appeared in the earlier document and is absent or not clearly referenced in the current document

Forbidden wording (never output these concepts): improved, worsened, better, worse, concerning, dangerous, clinically suspicious, likely diagnosis, urgent, emergency, triage, severity.

Return factual differences only as JSON with this exact shape:
{
  "newlyMentioned": string[],
  "stillMentioned": string[],
  "noLongerMentioned": string[],
  "unclear": string[],
  "patientAddedNewInformation": string[],
  "patientDidNotMentionPreviouslyReportedInformation": string[]
}

Each item must be one short neutral bullet in doctorLanguage.
If a list has no valid items, return an empty array.
`;

function normalizeAnswers(input) {
  const src =
    input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    appointmentReason: String(src.appointmentReason || ''),
    symptomsOwnWords: String(src.symptomsOwnWords || ''),
    onsetAndCourse: String(src.onsetAndCourse || ''),
    medications: String(src.medications || ''),
    preExistingConditions: String(src.preExistingConditions || ''),
    relevantDocuments: String(src.relevantDocuments || ''),
    patientQuestions: String(src.patientQuestions || ''),
  };
}

function cleanItems(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

const BANNED =
  /\b(diagnosis|diagnoses|triage|urgent|urgency|emergency|improved|improvement|worsened|worse|better|concerning|dangerous|suspicious|severe|severity|likely\s+disease|treatment\s+recommended)\b/gi;

function scrubBullets(arr) {
  return cleanItems(arr).filter((line) => {
    BANNED.lastIndex = 0;
    return !BANNED.test(line);
  });
}

function polishLine(line, doctorLanguage) {
  return sanitizeStructuredPlainText(line, {
    module: AI_MODULES.PREVISIT_HISTORY_DIFF,
    locale: doctorLanguage,
  });
}

export async function summarizePreVisitHistoryDiff(params) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    const err = new Error('OPENAI_API_KEY missing');
    err.statusCode = 500;
    err.safeMessage =
      'The service is not configured correctly. Please try again later.';
    throw err;
  }

  const previousAnswers = normalizeAnswers(params?.previousAnswers);
  const currentAnswers = normalizeAnswers(params?.currentAnswers);
  const patientLanguage = String(params?.patientLanguage || 'de').slice(0, 12);
  const doctorLanguage = String(params?.doctorLanguage || 'de').slice(0, 12);

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      temperature: 0.1,
      max_tokens: 850,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: JSON.stringify({
            patientLanguage,
            doctorLanguage,
            previousAnswers,
            currentAnswers,
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
      '[preVisitHistoryDiffClient] OpenAI failed:',
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
    newlyMentioned: scrubBullets(parsed.newlyMentioned).map((l) => polishLine(l, doctorLanguage)),
    stillMentioned: scrubBullets(parsed.stillMentioned).map((l) => polishLine(l, doctorLanguage)),
    noLongerMentioned: scrubBullets(parsed.noLongerMentioned).map((l) => polishLine(l, doctorLanguage)),
    unclear: scrubBullets(parsed.unclear).map((l) => polishLine(l, doctorLanguage)),
    patientAddedNewInformation: scrubBullets(parsed.patientAddedNewInformation).map((l) =>
      polishLine(l, doctorLanguage),
    ),
    patientDidNotMentionPreviouslyReportedInformation: scrubBullets(
      parsed.patientDidNotMentionPreviouslyReportedInformation,
    ).map((l) => polishLine(l, doctorLanguage)),
  };
}
