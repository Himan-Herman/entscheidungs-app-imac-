import { openai } from "../../openaiClient.js";
import { ALLOWED_COMMUNICATION_STYLE } from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput } from "../aiSafetySanitizer.js";
import { writeAuditLog } from "../auditLogService.js";
import { getPracticeAccess } from "../../utils/practiceAccess.js";
import { canManageIntegrations } from "../../utils/practicePermissions.js";
import { getOpenAiChatModel } from '../../config/openAiModels.js';

const INTEGRATION_AI_SYSTEM = `You assist practice IT staff with TECHNICAL and ORGANIZATIONAL integration explanations only.

Allowed:
- Explain FHIR/HL7 field mappings in plain language
- Summarize sandbox test results (success/failure counts)
- List missing configuration steps
- Clarify error codes without exposing secrets

Strictly forbidden:
- Medical interpretation of FHIR/HL7 payloads
- Diagnosis, therapy, lab value assessment, OBX clinical meaning
- Production mapping decisions without human review
- Suggesting automatic transfer of real health data

Output must be concise. Mark that content is AI-generated.
${ALLOWED_COMMUNICATION_STYLE}`;

function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

async function runIntegrationAi(actorUserId, practiceId, userPrompt, action, ctx = {}) {
  const access = await getPracticeAccess(actorUserId, practiceId);
  if (!access) throw new Error("practice_not_found");
  if (!canManageIntegrations(access.role)) throw new Error("forbidden");
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  const completion = await openai.chat.completions.create({
    model: getOpenAiChatModel(),
    temperature: 0.2,
    messages: [
      { role: "system", content: INTEGRATION_AI_SYSTEM },
      { role: "user", content: String(userPrompt).slice(0, 4000) },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content?.trim() || "";
  const text = sanitizeAiOutput(raw).slice(0, 3000);

  writeAuditLog({
    req: ctx.req,
    userId: actorUserId,
    actorRole: access.role,
    action,
    practiceProfileId: practiceId,
    metadata: { chars: text.length },
  }).catch(() => {});

  return {
    text,
    aiMarked: true,
    locale: langCode(ctx.locale),
  };
}

export async function generateMappingSummary(actorUserId, practiceId, input, ctx = {}) {
  const mappings = Array.isArray(input.mappings) ? input.mappings.slice(0, 10) : [];
  const locale = langCode(input.locale);
  const prompt = [
    `Language: ${locale === "en" ? "English" : "German"}`,
    "Explain these integration field mappings for staff (technical only):",
    JSON.stringify(
      mappings.map((m) => ({
        sourceType: m.sourceType,
        targetType: m.targetType,
        fields: m.mappingJson,
      })),
    ),
  ].join("\n");
  return runIntegrationAi(actorUserId, practiceId, prompt, "integration_ai_mapping_summary", {
    ...ctx,
    locale,
  });
}

export async function explainIntegrationError(actorUserId, practiceId, input, ctx = {}) {
  const locale = langCode(input.locale);
  const prompt = [
    `Language: ${locale === "en" ? "English" : "German"}`,
    `Error code: ${String(input.errorCode || "unknown").slice(0, 120)}`,
    input.context ? `Context: ${String(input.context).slice(0, 500)}` : "",
    "Explain what this integration error likely means and safe next steps (no medical content).",
  ].join("\n");
  return runIntegrationAi(actorUserId, practiceId, prompt, "integration_ai_error_explanation", {
    ...ctx,
    locale,
  });
}
