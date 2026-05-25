import { PrismaClient } from "@prisma/client";
import { openai } from "../../openaiClient.js";
import { getOpenAiChatModel } from '../../config/openAiModels.js';
import {
  AI_MODULES,
  ALLOWED_COMMUNICATION_STYLE,
  STRICT_RETRY_SUFFIX_COMPLETION,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from "../aiSafetySanitizer.js";
import { getPracticeInboxItem } from "./practiceInboxService.js";

const prisma = new PrismaClient();
const MODULE = "practice_inbox_org";

const ORG_SYSTEM = `You assist medical practice staff with ORGANIZATIONAL tasks only.

You may:
- Summarize existing operational inbox information in neutral language
- Suggest polite, non-clinical practice reply wording
- Note missing organizational details (e.g. phone number not provided, appointment preference missing)

You must NOT:
- Diagnose, interpret findings, recommend treatment or medication, suggest dosage
- Assess urgency, triage, or emergency level
- Route to specialists or recommend clinical decisions
- Invent medical facts; use "not provided" / "nicht angegeben" when information is missing

${ALLOWED_COMMUNICATION_STYLE}`;

/**
 * @param {string} practiceProfileId
 * @param {string} itemId
 * @param {"summary" | "reply_draft"} mode
 * @param {string} [locale]
 */
export async function generatePracticeInboxAiAssist(
  practiceProfileId,
  itemId,
  mode,
  locale = "de",
) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("ai_not_configured");
  }

  const { item, context } = await getPracticeInboxItem(itemId, practiceProfileId);
  const lang = String(locale).toLowerCase().startsWith("en") ? "en" : "de";

  const patientName =
    item.patient?.displayName ||
    [item.patient?.firstName, item.patient?.lastName].filter(Boolean).join(" ") ||
    (lang === "en" ? "not provided" : "nicht angegeben");

  /** @type {string[]} */
  const facts = [
    `Type: ${item.type}`,
    `Title: ${item.title}`,
    `Summary: ${item.summary || (lang === "en" ? "not provided" : "nicht angegeben")}`,
    `Patient: ${patientName}`,
    `Status: ${item.status}`,
  ];

  if (context.thread?.messages) {
    const last = context.thread.messages.filter((m) => m.senderType === "patient").slice(-3);
    for (const m of last) {
      facts.push(`Patient message excerpt: ${String(m.body).slice(0, 400)}`);
    }
  }
  if (context.followUp?.messages) {
    const last = context.followUp.messages.filter((m) => m.senderType === "patient").slice(-3);
    for (const m of last) {
      facts.push(`Follow-up reply excerpt: ${String(m.body).slice(0, 400)}`);
    }
  }
  if (context.dataRequest) {
    facts.push(`Data request type: ${context.dataRequest.type}`);
    facts.push(
      `Reason: ${context.dataRequest.reason || (lang === "en" ? "not provided" : "nicht angegeben")}`,
    );
  }

  const userPrompt =
    mode === "reply_draft"
      ? lang === "en"
        ? `Draft a short polite practice reply (max 120 words) based ONLY on these facts. Do not add medical advice.\n\n${facts.join("\n")}`
        : `Formuliere eine kurze höfliche Praxisantwort (max. 120 Wörter) NUR auf Basis dieser Fakten. Keine medizinische Beratung.\n\n${facts.join("\n")}`
      : lang === "en"
        ? `Summarize this inbox item for staff in 3-5 bullet points. Organizational only.\n\n${facts.join("\n")}`
        : `Fasse diesen Posteingang für das Team in 3–5 Stichpunkten zusammen. Nur organisatorisch.\n\n${facts.join("\n")}`;

  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model: getOpenAiChatModel(),
      temperature: 0.3,
      messages: [
        { role: "system", content: ORG_SYSTEM },
        {
          role: "user",
          content: attempt === 0 ? userPrompt : `${userPrompt}\n\n${STRICT_RETRY_SUFFIX_COMPLETION}`,
        },
      ],
    });
    raw = completion.choices[0]?.message?.content || "";
    if (!shouldRegenerateUnsafeOutput(raw, AI_MODULES.GENERIC)) break;
    raw = "";
  }

  if (!raw) {
    return {
      text:
        lang === "en"
          ? "A neutral summary could not be generated safely. Please review the item manually."
          : "Eine neutrale Zusammenfassung konnte nicht sicher erstellt werden. Bitte manuell prüfen.",
      aiSuggestion: true,
    };
  }

  const safe = sanitizeAiOutput(raw, { module: AI_MODULES.GENERIC, locale: lang });
  return { text: safe.text, aiSuggestion: true };
}
