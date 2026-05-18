import { openai } from "../../openaiClient.js";
import {
  ALLOWED_COMMUNICATION_STYLE,
  STRICT_RETRY_SUFFIX_COMPLETION,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from "../aiSafetySanitizer.js";
import {
  getThread,
  getThreadForPatientUser,
} from "./practicePatientThreadService.js";

/**
 * @param {string} locale
 */
function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

const ORG_SYSTEM = `You help with ORGANIZATIONAL communication drafting only for medical practice staff and patients.

Allowed:
- Polite reply drafts
- Neutral summaries of existing messages
- Plain-language reformulation
- Tone, spelling, and grammar improvements
- Note missing organizational info (e.g. appointment request missing, phone not provided)

Forbidden:
- Diagnosis, treatment, medication, dosage
- Urgency/triage/emergency assessment
- Specialist routing or clinical decisions
- Interpreting test results
- Inventing medical facts — use "not provided" / "nicht angegeben" when missing

${ALLOWED_COMMUNICATION_STYLE}`;

/**
 * @param {string} prompt
 * @param {string} locale
 */
async function runDraft(prompt, locale) {
  if (!process.env.OPENAI_API_KEY) throw new Error("ai_not_configured");

  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      messages: [
        { role: "system", content: ORG_SYSTEM },
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
      ? "A neutral draft could not be generated safely. Please write your message manually."
      : "Ein neutraler Entwurf konnte nicht sicher erstellt werden. Bitte formulieren Sie manuell.";
  }

  const safe = sanitizeAiOutput(raw, { locale: langCode(locale) });
  return safe.text;
}

/**
 * @param {{ thread: object, mode: string, locale: string, draftInput?: string }} p
 */
function buildPromptFromThread(p) {
  const { thread, mode, locale, draftInput } = p;
  const isEn = langCode(locale) === "en";
  const lines = (thread.messages || []).slice(-12).map((m) => {
    const who =
      m.senderType === "patient"
        ? isEn
          ? "Patient"
          : "Patient:in"
        : m.senderType === "practice"
          ? isEn
            ? "Practice"
            : "Praxis"
          : "System";
    return `${who}: ${String(m.body).slice(0, 600)}`;
  });

  if (mode === "rewrite" && draftInput) {
    return isEn
      ? `Improve this draft message for clarity and polite tone. Do not add medical advice.\nDraft:\n${draftInput}\n\nContext:\n${lines.join("\n")}`
      : `Verbessere diesen Entwurf für Klarheit und höflichen Ton. Keine medizinische Beratung.\nEntwurf:\n${draftInput}\n\nKontext:\n${lines.join("\n")}`;
  }

  if (mode === "summary") {
    return isEn
      ? `Summarize this thread in 3-5 bullet points. Organizational only.\n\n${lines.join("\n")}`
      : `Fasse diesen Thread in 3–5 Stichpunkten zusammen. Nur organisatorisch.\n\n${lines.join("\n")}`;
  }

  return isEn
    ? `Draft a short polite reply (max 120 words) based ONLY on the thread below. No medical advice.\n\n${lines.join("\n")}`
    : `Formuliere eine kurze höfliche Antwort (max. 120 Wörter) NUR auf Basis des Threads. Keine medizinische Beratung.\n\n${lines.join("\n")}`;
}

/**
 * @param {{ linkId: string, practiceProfileId: string, threadId: string, locale?: string, mode?: string, draftInput?: string }} input
 */
export async function generatePracticeMessageAiDraft(input) {
  const thread = await getThread(
    input.threadId,
    input.practiceProfileId,
    input.linkId,
  );
  const text = await runDraft(
    buildPromptFromThread({
      thread,
      mode: input.mode || "reply_draft",
      locale: input.locale || "de",
      draftInput: input.draftInput,
    }),
    input.locale || "de",
  );
  return { text, aiDraft: true };
}

/**
 * @param {{ threadId: string, patientUserId: string, locale?: string, mode?: string, draftInput?: string }} input
 */
export async function generatePatientMessageAiDraft(input) {
  const thread = await getThreadForPatientUser(input.threadId, input.patientUserId);
  const text = await runDraft(
    buildPromptFromThread({
      thread,
      mode: input.mode || "rewrite",
      locale: input.locale || "de",
      draftInput: input.draftInput,
    }),
    input.locale || "de",
  );
  return { text, aiDraft: true };
}
