/**
 * gpt-4o-mini AI summary for Notfallausweis / SOS-Karte.
 * Generates a concise first-responder summary from allergies, diagnoses, and card data.
 * Called once on patient save — not on every public read.
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SOS_AI_MODEL = process.env.SOS_CARD_AI_MODEL || "gpt-4o-mini";

/**
 * @param {{
 *   bloodType?: string | null;
 *   allergies: Array<{ allergen: string; severity: string; reaction?: string | null }>;
 *   diagnoses: Array<{ condition: string; status: string }>;
 *   emergencyContact1Name?: string | null;
 *   emergencyContact1Phone?: string | null;
 *   emergencyContact2Name?: string | null;
 *   emergencyContact2Phone?: string | null;
 *   firstResponderNote?: string | null;
 * }} data
 * @returns {Promise<string>}
 */
export async function generateSosCardSummary(data) {
  const {
    bloodType,
    allergies,
    diagnoses,
    emergencyContact1Name,
    emergencyContact1Phone,
    emergencyContact2Name,
    emergencyContact2Phone,
    firstResponderNote,
  } = data;

  const allergyLines = allergies
    .filter((a) => a.severity === "life_threatening" || a.severity === "severe" || a.severity === "moderate")
    .map((a) => `• ${a.allergen} (${a.severity}${a.reaction ? `, ${a.reaction}` : ""})`)
    .join("\n") || "None documented";

  const diagnosisLines = diagnoses
    .filter((d) => d.status === "active" || d.status === "chronic")
    .map((d) => `• ${d.condition} (${d.status})`)
    .join("\n") || "None documented";

  const contactLines = [
    emergencyContact1Name && emergencyContact1Phone
      ? `${emergencyContact1Name}: ${emergencyContact1Phone}`
      : null,
    emergencyContact2Name && emergencyContact2Phone
      ? `${emergencyContact2Name}: ${emergencyContact2Phone}`
      : null,
  ]
    .filter(Boolean)
    .join("; ") || "None";

  const prompt = `You are generating a concise first-responder emergency summary for a medical ID card.
Write in English. Maximum 120 words. Plain text only — no markdown, no bullet points.
Focus on: blood type, critical allergies with reactions, active/chronic diagnoses, emergency contacts.
Omit phrases like "The patient has..." — write directly.

Input:
Blood type: ${bloodType || "Unknown"}
Allergies (moderate–life-threatening):
${allergyLines}
Active/chronic diagnoses:
${diagnosisLines}
Emergency contacts: ${contactLines}
First-responder note: ${firstResponderNote || "None"}

Generate the summary now:`;

  const response = await openai.chat.completions.create({
    model: SOS_AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
    temperature: 0.2,
  });

  return (response.choices[0]?.message?.content || "").trim();
}
