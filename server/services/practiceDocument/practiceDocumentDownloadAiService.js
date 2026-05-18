import { openai } from "../../openaiClient.js";
import {
  ALLOWED_COMMUNICATION_STYLE,
  STRICT_RETRY_SUFFIX_COMPLETION,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from "../aiSafetySanitizer.js";
import { writeAuditLog } from "../auditLogService.js";

const SYSTEM = `You help users with ORGANIZATIONAL download and security notes for practice documents.

Allowed:
- Explain file type and purpose in neutral language (e.g. PDF, image)
- Simple-language security checklist: link expires, authorized access only, do not forward
- Note missing metadata as not provided / nicht angegeben

Forbidden:
- Interpreting document content
- Lab values, diagnoses, therapy, urgency
- Medical assessment of any kind

${ALLOWED_COMMUNICATION_STYLE}`;

function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

/**
 * @param {{ documentType?: string, fileName?: string, mimeType?: string, locale?: string, actorRole?: string, userId?: string, documentId?: string, practiceProfileId?: string }} input
 * @param {{ req?: import('express').Request }} ctx
 */
export async function generateDocumentDownloadAiNote(input, ctx = {}) {
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  const locale = input.locale || "de";
  const isEn = langCode(locale) === "en";
  const missing = isEn ? "not provided" : "nicht angegeben";

  const prompt = [
    isEn ? "Language: English" : "Sprache: Deutsch",
    `Document type label: ${input.documentType || missing}`,
    `File name (metadata only): ${input.fileName || missing}`,
    `MIME type: ${input.mimeType || missing}`,
    isEn
      ? "Write a short organizational download/security note. No document interpretation."
      : "Kurzer organisatorischer Download-/Sicherheitshinweis. Keine Dokumenteninterpretation.",
  ].join("\n");

  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        { role: "system", content: SYSTEM },
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

  const text =
    raw ||
    (isEn
      ? "Please download only via the secure link and do not share it with others."
      : "Bitte laden Sie nur über den sicheren Link herunter und geben Sie ihn nicht weiter.");

  const safe = sanitizeAiOutput(text, { locale: langCode(locale) });

  writeAuditLog({
    req: ctx.req,
    userId: input.userId,
    actorRole: input.actorRole,
    action: "practice_document_ai_download_note",
    entityType: "practice_document",
    entityId: input.documentId,
    practiceProfileId: input.practiceProfileId,
    metadata: { mimeType: input.mimeType },
  });

  return {
    note: safe.text,
    aiSuggestionLabel: isEn ? "AI note – please review" : "KI-Hinweis – bitte prüfen",
    aiDisclaimer: isEn
      ? "AI only supports organizational download and security notes. It does not interpret documents."
      : "Die KI unterstützt nur bei organisatorischen Download- und Sicherheitshinweisen. Sie interpretiert keine Dokumente.",
  };
}
