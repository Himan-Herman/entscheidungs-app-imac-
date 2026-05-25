import { openai } from "../../openaiClient.js";
import { getOpenAiChatModel } from '../../config/openAiModels.js';
import {
  ALLOWED_COMMUNICATION_STYLE,
  STRICT_RETRY_SUFFIX_COMPLETION,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from "../aiSafetySanitizer.js";
import {
  getDocumentForPractice,
} from "./practiceDocumentService.js";

/**
 * @param {string} locale
 */
function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

const DOC_SYSTEM = `You help organize PRACTICE DOCUMENT METADATA only — never interpret file contents, lab values, or clinical findings.

Allowed:
- Structure title, type, description fields
- Suggest neutral improved titles from existing metadata
- Plain-language description rewrites
- Checklist of missing organizational fields (type, title, file, date) — use "not provided" / "nicht angegeben"

Forbidden:
- Interpret lab results or imaging findings
- Diagnose, recommend treatment, assess urgency
- Recommend specialists
- Invent medical content from files you cannot see

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
        { role: "system", content: DOC_SYSTEM },
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
      ? "Organization draft could not be generated safely. Please review manually."
      : "Organisations-Entwurf konnte nicht sicher erstellt werden. Bitte manuell prüfen.";
  }

  const safe = sanitizeAiOutput(raw, { locale: langCode(locale) });
  return safe.text;
}

/**
 * @param {{ type?: string, title?: string, description?: string | null, files?: Array<{ originalFileName: string }>, status?: string }} doc
 * @param {string} locale
 */
function metadataContext(doc, locale) {
  const isEn = langCode(locale) === "en";
  const lines = [
    `${isEn ? "Type" : "Typ"}: ${doc.type || "not provided"}`,
    `${isEn ? "Title" : "Titel"}: ${doc.title || "not provided"}`,
    `${isEn ? "Description" : "Beschreibung"}: ${doc.description || "not provided"}`,
    `${isEn ? "Status" : "Status"}: ${doc.status || "not provided"}`,
    `${isEn ? "Files attached" : "Dateien"}: ${doc.files?.length ?? 0}`,
  ];
  if (doc.files?.length) {
    for (const f of doc.files) {
      lines.push(`- ${f.originalFileName}`);
    }
  }
  return lines.join("\n");
}

/**
 * @param {{ linkId: string, practiceProfileId: string, documentId: string, locale?: string }} input
 */
export async function generatePracticeDocumentAiOrganize(input) {
  const doc = await getDocumentForPractice(
    input.documentId,
    input.linkId,
    input.practiceProfileId,
  );
  const locale = input.locale || "de";
  const isEn = langCode(locale) === "en";
  const prompt = isEn
    ? `Create an organizational checklist and neutral structure summary for this practice document metadata. Do not interpret medical content.\n\n${metadataContext(doc, locale)}`
    : `Erstelle eine organisatorische Checkliste und neutrale Strukturübersicht für diese Dokument-Metadaten. Keine medizinische Interpretation.\n\n${metadataContext(doc, locale)}`;

  const text = await runAi(prompt, locale);
  return { text, aiDraft: true };
}

/**
 * @param {{ linkId: string, practiceProfileId: string, type?: string, title?: string, description?: string, locale?: string }} input
 */
export async function generatePracticeDocumentAiTitleDraft(input) {
  const locale = input.locale || "de";
  const isEn = langCode(locale) === "en";
  const prompt = isEn
    ? `Suggest 3 neutral document title options based only on this metadata. No medical interpretation.\nType: ${input.type || "not provided"}\nCurrent title: ${input.title || "not provided"}\nDescription: ${input.description || "not provided"}`
    : `Schlage 3 neutrale Dokumenttitel vor, nur auf Basis dieser Metadaten. Keine medizinische Interpretation.\nTyp: ${input.type || "nicht angegeben"}\nAktueller Titel: ${input.title || "nicht angegeben"}\nBeschreibung: ${input.description || "nicht angegeben"}`;

  const text = await runAi(prompt, locale);
  return { text, aiDraft: true };
}
