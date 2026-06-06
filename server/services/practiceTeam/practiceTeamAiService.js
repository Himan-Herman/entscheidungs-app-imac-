import { openai } from "../../openaiClient.js";
import { getOpenAiChatModel } from '../../config/openAiModels.js';
import {
  ALLOWED_COMMUNICATION_STYLE,
  STRICT_RETRY_SUFFIX_COMPLETION,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from "../aiSafetySanitizer.js";
import { writeAuditLog } from "../auditLogService.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { canManageTeam } from "../../utils/practiceAccess.js";
import { buildTeamList } from "./practiceTeamService.js";
import { permissionsForRole } from "../../utils/practicePermissions.js";

const TEAM_AI_SYSTEM = `You support practice administrators with ORGANIZATIONAL role and permission overviews only.

Allowed:
- Plain-language descriptions of practice roles (owner, admin, doctor, assistant, viewer)
- Suggest minimal permissions for a stated role intent
- Summarize which permissions a role typically has
- Flag possible organizational conflicts (e.g. viewer role combined with write permissions in a custom note)

Forbidden:
- Automatic role assignment decisions ("you should make them admin")
- Medical, clinical, or patient-care advice
- Risk scoring or surveillance of staff
- Legal or compliance guarantees
- Inventing users, emails, or access not in the input

Always end with a short reminder that a human must review any change.
${ALLOWED_COMMUNICATION_STYLE}`;

function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

/**
 * @param {string} prompt
 * @param {string} locale
 */
async function runTeamAi(prompt, locale) {
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      temperature: 0.25,
      messages: [
        { role: "system", content: TEAM_AI_SYSTEM },
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
      ? "Summary could not be generated safely. Please review roles manually."
      : "Zusammenfassung konnte nicht sicher erstellt werden. Bitte prüfen Sie die Rollen manuell.";
  }

  const safe = sanitizeAiOutput(raw, { locale: langCode(locale) });
  return safe.text;
}

/**
 * @param {string} actorUserId
 * @param {string} practiceId
 * @param {{ locale?: string, focusRole?: string }} input
 * @param {{ req?: import('express').Request }} ctx
 */
export async function generatePracticeTeamPermissionSummary(
  actorUserId,
  practiceId,
  input,
  ctx = {},
) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access || !canManageTeam(access.role)) throw new Error("forbidden");

  const built = await buildTeamList(practiceId);
  if (!built) throw new Error("practice_not_found");

  const locale = input.locale || "de";
  const isEn = langCode(locale) === "en";
  const focusRole = String(input.focusRole || "").trim() || "not provided";

  const memberSummary = built.members.map((m) => ({
    role: m.role,
    status: m.status,
    isPracticeOwner: m.isPracticeOwner,
  }));

  const prompt = [
    isEn ? "Language: English" : "Sprache: Deutsch",
    `Practice: ${built.practice.practiceName || (isEn ? "not provided" : "nicht angegeben")}`,
    `Focus role: ${focusRole}`,
    `Team member overview (roles/status only, no names): ${JSON.stringify(memberSummary)}`,
    `Standard permissions for focus role: ${JSON.stringify(permissionsForRole(focusRole))}`,
    isEn
      ? "Provide a short organizational summary and note any obvious permission conflicts. Do not assign roles automatically."
      : "Kurze organisatorische Zusammenfassung und Hinweise auf mögliche Rechte-Konflikte. Keine automatische Rollenvergabe.",
  ].join("\n");

  const summary = await runTeamAi(prompt, locale);

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action: "practice_team_ai_summary_created",
    entityType: "practice_membership",
    entityId: practiceId,
    practiceProfileId: practiceId,
    metadata: { focusRole: focusRole === "not provided" ? null : focusRole },
  });

  return {
    summary,
    aiSuggestionLabel: isEn ? "AI suggestion – please review" : "Automatischer Vorschlag – bitte prüfen",
    aiDisclaimer: isEn
      ? "AI only provides organizational support for role and permission overviews."
      : "Unterstützt nur organisatorisch bei Rollen- und Rechteübersichten.",
  };
}
