import { openai } from "../../openaiClient.js";
import {
  ALLOWED_COMMUNICATION_STYLE,
  STRICT_RETRY_SUFFIX_COMPLETION,
} from "../../config/aiSafetyPolicy.js";
import { sanitizeAiOutput, shouldRegenerateUnsafeOutput } from "../aiSafetySanitizer.js";
import { writeAuditLog } from "../auditLogService.js";
import { getPatientProfileForPractice } from "./practicePatientProfileService.js";

/**
 * @param {string} locale
 */
function langCode(locale) {
  return String(locale || "").toLowerCase().startsWith("en") ? "en" : "de";
}

const PROFILE_SYSTEM = `You help structure EXISTING patient-provided profile information for practice staff.

Allowed:
- Neutral organizational summary of fields already provided
- Plain-language rephrasing without changing meaning
- Mark missing profile fields as "not provided" / "nicht angegeben" (e.g. language, emergency contact, allergies)
- Section headers for basic vs health information already in the source

Forbidden:
- Diagnose or classify patients medically
- Assess health risks or urgency
- Recommend treatment, medications, or specialists
- Interpret symptoms or lab findings
- Invent allergies, conditions, medications, or contacts not in the source

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
        { role: "system", content: PROFILE_SYSTEM },
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
      ? "Summary could not be generated safely. Please review the profile manually."
      : "Zusammenfassung konnte nicht sicher erstellt werden. Bitte prüfen Sie das Profil manuell.";
  }

  const safe = sanitizeAiOutput(raw, { locale: langCode(locale) });
  return safe.text;
}

/**
 * @param {Awaited<ReturnType<typeof getPatientProfileForPractice>>} profile
 * @param {string} locale
 */
function profileContextLines(profile, locale) {
  const isEn = langCode(locale) === "en";
  const np = isEn ? "not provided" : "nicht angegeben";
  const lines = [];

  if (profile.dependentProfile) {
    const d = profile.dependentProfile;
    lines.push(`${isEn ? "Dependent" : "Betreute Person"}: ${d.displayName || np}`);
    lines.push(`${isEn ? "Relation" : "Beziehung"}: ${d.relationLabel || np}`);
    lines.push(`${isEn ? "Date of birth" : "Geburtsdatum"}: ${d.dateOfBirth || np}`);
    lines.push(`${isEn ? "Language" : "Sprache"}: ${d.preferredLanguage || np}`);
    return lines.join("\n");
  }

  const b = profile.basic;
  lines.push(`${isEn ? "Name" : "Name"}: ${b.displayName || [b.firstName, b.lastName].filter(Boolean).join(" ") || np}`);
  lines.push(`${isEn ? "Email" : "E-Mail"}: ${b.email || np}`);
  lines.push(`${isEn ? "Date of birth" : "Geburtsdatum"}: ${b.dateOfBirth || np}`);
  lines.push(`${isEn ? "Language" : "Sprache"}: ${b.preferredLanguage || np}`);
  lines.push(`${isEn ? "Emergency contact" : "Notfallkontakt"}: ${b.emergencyContactNote || np}`);
  lines.push(`${isEn ? "Insurance" : "Versicherung"}: ${b.insuranceType || np}`);

  if (profile.health) {
    const h = profile.health;
    lines.push(`${isEn ? "Allergies" : "Allergien"}: ${h.allergies || np}`);
    lines.push(`${isEn ? "Medications" : "Medikamente"}: ${h.regularMedications || np}`);
    lines.push(`${isEn ? "Conditions" : "Vorerkrankungen"}: ${h.chronicConditions || np}`);
    lines.push(`${isEn ? "Notes" : "Hinweise"}: ${h.importantNotes || np}`);
  }

  return lines.join("\n");
}

/**
 * @param {{ linkId: string, practiceProfileId: string, viewerUserId: string, locale?: string }} input
 */
export async function generatePracticePatientProfileAiSummary(input) {
  const profile = await getPatientProfileForPractice(
    input.linkId,
    input.practiceProfileId,
    input.viewerUserId,
  );

  const locale = input.locale || "de";
  const isEn = langCode(locale) === "en";
  const context = profileContextLines(profile, locale);

  const prompt = isEn
    ? `Create a short organizational summary of the following patient-provided profile fields only. Do not add medical assessment.\n\n${context}`
    : `Erstellen Sie eine kurze organisatorische Zusammenfassung nur der folgenden vom Patienten angegebenen Profilfelder. Keine medizinische Bewertung.\n\n${context}`;

  const summary = await runAi(prompt, locale);

  await writeAuditLog({
    userId: input.viewerUserId,
    actorRole: "practice",
    action: "patient_profile_ai_summary_created",
    entityType: "patient_profile",
    entityId: profile.linkId,
    metadata: {
      practiceProfileId: profile.practiceProfileId,
      patientUserId: profile.patientUserId,
      practicePatientLinkId: profile.linkId,
    },
  });

  return { summary, locale: langCode(locale) };
}
