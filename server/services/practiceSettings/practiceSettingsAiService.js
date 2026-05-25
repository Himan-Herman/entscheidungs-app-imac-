import { openai } from "../../openaiClient.js";
import { getOpenAiChatModel } from '../../config/openAiModels.js';
import {
  ALLOWED_COMMUNICATION_STYLE,
  STRICT_RETRY_SUFFIX_COMPLETION,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from "../aiSafetySanitizer.js";
import { writeAuditLog } from "../auditLogService.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { hasPracticePermission, PERMISSIONS } from "../../utils/practicePermissions.js";
import { containsForbiddenMarketingClaims } from "../../utils/practiceBranding.js";

const SETTINGS_AI_SYSTEM = `You help practice staff draft NEUTRAL organizational practice descriptions for a patient-facing portal.

Allowed:
- Plain, factual wording about services, location, languages, opening hours context
- Professional tone without superlatives
- DE or EN output as requested

Strictly forbidden:
- Medical advertising, healing promises, guarantees of outcomes
- "Best practice", "#1", superiority claims
- Diagnosis, treatment, therapy, or clinical recommendations
- Urgency or emergency framing

Output only the suggested description text (no title). Keep under 400 words.
${ALLOWED_COMMUNICATION_STYLE}`;

function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {{ locale?: string, draftNotes?: string, currentDescription?: string }} input
 * @param {{ req?: import('express').Request }} ctx
 */
export async function generatePracticeDescriptionDraft(
  actorUserId,
  practiceId,
  input,
  ctx = {},
) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!hasPracticePermission(access.role, PERMISSIONS.SETTINGS_MANAGE)) {
    throw new Error("forbidden");
  }

  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  const locale = langCode(input.locale);
  const practice = access.practice;
  const notes = String(input.draftNotes || "").trim().slice(0, 800);
  const current = String(input.currentDescription || practice.description || "").trim().slice(0, 2000);

  const userPrompt = [
    `Language: ${locale === "en" ? "English" : "German"}`,
    `Practice name: ${practice.practiceName}`,
    practice.specialty ? `Specialty: ${practice.specialty}` : "",
    practice.city || practice.country
      ? `Location: ${[practice.city, practice.country].filter(Boolean).join(", ")}`
      : "",
    current ? `Current description:\n${current}` : "",
    notes ? `Staff notes (organizational only):\n${notes}` : "",
    "Draft a neutral patient-facing practice description.",
  ]
    .filter(Boolean)
    .join("\n");

  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      temperature: 0.3,
      messages: [
        { role: "system", content: SETTINGS_AI_SYSTEM },
        {
          role: "user",
          content:
            attempt === 0 ? userPrompt : `${userPrompt}\n\n${STRICT_RETRY_SUFFIX_COMPLETION}`,
        },
      ],
    });
    raw = completion.choices[0]?.message?.content || "";
    if (!shouldRegenerateUnsafeOutput(raw)) break;
    raw = "";
  }

  if (!raw) {
    return {
      text:
        locale === "en"
          ? "A draft could not be generated safely. Please write the description manually."
          : "Ein Entwurf konnte nicht sicher erstellt werden. Bitte formulieren Sie die Beschreibung manuell.",
      aiGenerated: false,
    };
  }

  const safe = sanitizeAiOutput(raw, { locale });
  if (containsForbiddenMarketingClaims(safe.text)) {
    return {
      text:
        locale === "en"
          ? "The draft contained wording that is not allowed. Please adjust manually."
          : "Der Entwurf enthielt nicht erlaubte Formulierungen. Bitte manuell anpassen.",
      aiGenerated: false,
    };
  }

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    practiceProfileId: practiceId,
    action: "practice_settings_ai_description",
    entityType: "PracticeProfile",
    entityId: practiceId,
    metadata: {},
  });

  return { text: safe.text.slice(0, 2000), aiGenerated: true };
}
