import { openai } from "../../openaiClient.js";
import {
  ALLOWED_COMMUNICATION_STYLE,
  STRICT_RETRY_SUFFIX_COMPLETION,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from "../aiSafetySanitizer.js";
import { writeAuditLog } from "../auditLogService.js";
import { getPatientDataRequest } from "./patientDataRequestService.js";

/**
 * @param {string} locale
 */
function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

const DATA_REQUEST_SYSTEM = `You help patients and practice staff with ORGANIZATIONAL data-control requests only.

Allowed:
- Plain-language explanations of data control options (export, deletion request, archiving)
- Neutral draft wording for optional request notes (no medical details)
- Summarize request metadata (type, status, dates) without inventing facts
- Mark missing fields as "not provided" / "nicht angegeben"

Forbidden:
- Legal advice or GDPR interpretation as legal counsel
- Medical assessment, diagnosis, therapy, urgency
- Deciding whether medical records must be deleted
- Inventing sensitive health information

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
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: DATA_REQUEST_SYSTEM },
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
      ? "Draft could not be generated safely. Please write your note manually."
      : "Entwurf konnte nicht sicher erstellt werden. Bitte formulieren Sie Ihre Anmerkung selbst.";
  }

  const safe = sanitizeAiOutput(raw, { locale: langCode(locale) });
  return safe.text;
}

/**
 * Neutral optional note draft for a data request (patient).
 * @param {{ type: string, locale?: string, practiceName?: string }} input
 */
export async function generatePatientDataRequestAiDraft(input) {
  const type = String(input.type || "deletion").trim();
  const locale = input.locale || "de";
  const isEn = langCode(locale) === "en";
  const practice = input.practiceName?.trim() || (isEn ? "not provided" : "nicht angegeben");

  const typeLabel = {
    deletion: isEn ? "deletion or restriction" : "Löschung oder Einschränkung",
    access_restriction: isEn ? "access restriction" : "Zugriffseinschränkung",
    export: isEn ? "data export" : "Datenexport",
  }[type] || type;

  const prompt = isEn
    ? `Write a short neutral optional note (max 3 sentences) a patient might add to a ${typeLabel} request for practice "${practice}". No medical details. No legal advice.`
    : `Schreiben Sie eine kurze neutrale optionale Anmerkung (max. 3 Sätze), die eine Patientin / ein Patient zu einer Anfrage (${typeLabel}) für die Praxis „${practice}“ hinzufügen könnte. Keine medizinischen Details. Keine Rechtsberatung.`;

  const draft = await runAi(prompt, locale);
  return { draft, locale: langCode(locale) };
}

/**
 * Organizational summary of an existing request (patient).
 * @param {{ requestId: string, patientUserId: string, locale?: string }} input
 */
export async function generatePatientDataRequestAiSummary(input) {
  const row = await getPatientDataRequest(input.requestId, input.patientUserId, "patient");
  const locale = input.locale || "de";
  const isEn = langCode(locale) === "en";
  const np = isEn ? "not provided" : "nicht angegeben";

  const context = [
    `${isEn ? "Type" : "Typ"}: ${row.type}`,
    `${isEn ? "Status" : "Status"}: ${row.status}`,
    `${isEn ? "Created" : "Erstellt"}: ${row.createdAt}`,
    `${isEn ? "Practice link" : "Praxisbezug"}: ${row.practicePatientLinkId || np}`,
  ].join("\n");

  const prompt = isEn
    ? `Explain this data request status in simple organizational language for the patient. No legal or medical advice.\n\n${context}`
    : `Erklären Sie diesen Datenanfrage-Status in einfacher organisatorischer Sprache für die Patientin / den Patienten. Keine Rechts- oder medizinische Beratung.\n\n${context}`;

  const summary = await runAi(prompt, locale);

  await writeAuditLog({
    userId: input.patientUserId,
    actorRole: "patient",
    action: "patient_data_request_ai_summary_created",
    entityType: "patient_data_request",
    entityId: row.id,
    metadata: {
      practiceProfileId: row.practiceProfileId,
      practicePatientLinkId: row.practicePatientLinkId,
      requestType: row.type,
    },
  });

  return { summary, locale: langCode(locale) };
}
