import {
  splitSymptomAssistantResponse,
  normalizeSymptomSummary,
} from "../../../client/src/features/symptomCheck/symptomSummaryParse.js";
import { sanitizeAiOutput } from "../aiSafetySanitizer.js";
import { AI_MODULES } from "../../config/aiSafetyPolicy.js";

function sanitizeField(value, locale) {
  const safe = sanitizeAiOutput(String(value || ""), {
    module: AI_MODULES.SYMPTOM_CHECK,
    locale,
  });
  return safe.text;
}

/**
 * @param {string} raw
 * @param {{ locale?: string }} options
 */
export function parseAndSanitizeSymptomResponse(raw, options = {}) {
  const locale = options.locale === "en" ? "en" : "de";
  const { displayText, summaryRaw } = splitSymptomAssistantResponse(raw);

  const safeDisplay = sanitizeAiOutput(displayText, {
    module: AI_MODULES.SYMPTOM_CHECK,
    locale,
  });

  let summary = null;
  if (summaryRaw) {
    const normalized = normalizeSymptomSummary(summaryRaw);
    if (normalized) {
      summary = {
        mainComplaints: sanitizeField(normalized.mainComplaints, locale),
        location: sanitizeField(normalized.location, locale),
        timeline: sanitizeField(normalized.timeline, locale),
        associatedFactors: sanitizeField(normalized.associatedFactors, locale),
        symptomSummary: sanitizeField(normalized.symptomSummary, locale),
        specialties: normalized.specialties.map((s) => sanitizeField(s, locale)),
        visitTopics: normalized.visitTopics.map((s) => sanitizeField(s, locale)),
      };
    }
  }

  return { text: safeDisplay.text, summary, safety: safeDisplay };
}
