import { openai } from "../../openaiClient.js";
import { getOpenAiChatModel } from '../../config/openAiModels.js';
import {
  ALLOWED_COMMUNICATION_STYLE,
  STRICT_RETRY_SUFFIX_COMPLETION,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from "../aiSafetySanitizer.js";
import {
  getMedicationPlanByLink,
  getMedicationPlanForPatient,
} from "./medicationPlanService.js";

const MAX_NOTE_LEN = 2000;

/**
 * @param {string} locale
 */
function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

const MED_SYSTEM = `You help structure EXISTING medication plan information for practice staff or patients.

Allowed:
- Organize existing entries into clear sections or bullet lists
- Plain-language explanations of what is already documented
- Mark missing organizational fields (dosage, schedule, duration) as "not provided" / "nicht angegeben"
- Improve readability without changing medical meaning

Forbidden:
- Recommend medications or dosages
- Suggest therapy changes
- Assess interactions or side effects clinically
- Triage urgency or diagnose
- Invent medical facts not in the source data

${ALLOWED_COMMUNICATION_STYLE}`;

/**
 * @param {string} prompt
 * @param {string} locale
 */
async function runAi(prompt, locale) {
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      temperature: 0.3,
      messages: [
        { role: "system", content: MED_SYSTEM },
        {
          role: "user",
          content:
            attempt === 0 ? prompt : `${prompt}\n\n${STRICT_RETRY_SUFFIX_COMPLETION}`,
        },
      ],
    });
    raw = completion.choices[0]?.message?.content || "";
    if (!shouldRegenerateUnsafeOutput(raw)) break;
    raw = "";
  }

  if (!raw) {
    return langCode(locale) === "en"
      ? "Structured summary could not be generated safely. Please review the plan manually."
      : "Strukturierte Übersicht konnte nicht sicher erstellt werden. Bitte prüfen Sie den Plan manuell.";
  }

  const safe = sanitizeAiOutput(raw, { locale: langCode(locale) });
  return safe.text;
}

/**
 * @param {{ title?: string | null, note?: string | null, items?: Array<Record<string, unknown>> }} plan
 * @param {string} locale
 */
function planContextLines(plan, locale) {
  const isEn = langCode(locale) === "en";
  const lines = [];
  if (plan.title) lines.push(`${isEn ? "Title" : "Titel"}: ${plan.title}`);
  if (plan.note) lines.push(`${isEn ? "Note" : "Hinweis"}: ${plan.note}`);
  for (const item of plan.items || []) {
    lines.push(
      [
        item.medicationName,
        item.dosage ? `${isEn ? "dosage" : "Dosierung"}: ${item.dosage}` : null,
        item.frequency ? `${isEn ? "frequency" : "Häufigkeit"}: ${item.frequency}` : null,
        item.route ? `${isEn ? "route" : "Weg"}: ${item.route}` : null,
        item.schedule ? `${isEn ? "schedule" : "Zeit"}: ${item.schedule}` : null,
        item.instructions ? `${isEn ? "instructions" : "Hinweise"}: ${item.instructions}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }
  return lines.join("\n");
}

/**
 * @param {{ linkId: string, practiceProfileId: string, planId: string, locale?: string }} input
 */
export async function generatePracticeMedicationPlanAiFormat(input) {
  const plan = await getMedicationPlanByLink(
    input.planId,
    input.practiceProfileId,
    input.linkId,
  );
  const locale = input.locale || "de";
  const isEn = langCode(locale) === "en";
  const prompt = isEn
    ? `Structure this medication plan for practice staff review. List missing organizational fields. Do not recommend changes.\n\n${planContextLines(plan, locale)}`
    : `Strukturiere diesen Medikationsplan zur Prüfung durch die Praxis. Fehlende organisatorische Angaben markieren. Keine Empfehlungen.\n\n${planContextLines(plan, locale)}`;

  const text = await runAi(prompt, locale);
  return { text, aiDraft: true };
}

/**
 * @param {{ planId: string, patientUserId: string, locale?: string }} input
 */
export async function generatePatientMedicationPlanSimpleLanguage(input) {
  const plan = await getMedicationPlanForPatient(input.planId, input.patientUserId);
  const locale = input.locale || "de";
  const isEn = langCode(locale) === "en";
  const prompt = isEn
    ? `Explain this practice-provided medication plan in simple, patient-friendly language. Only use information below. No new medical advice.\n\n${planContextLines(plan, locale)}`
    : `Erkläre diesen von der Praxis bereitgestellten Medikationsplan in einfacher Sprache. Nur vorhandene Informationen. Keine neuen medizinischen Empfehlungen.\n\n${planContextLines(plan, locale)}`;

  const text = await runAi(prompt, locale);
  return { text, aiDraft: true };
}
