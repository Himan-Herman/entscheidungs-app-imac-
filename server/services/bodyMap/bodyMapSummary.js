import {
  splitBodyMapAssistantResponse,
  normalizeBodyMapSummary,
} from "../../../client/src/features/bodyMap/bodyMapSummaryParse.js";
import { sanitizeAiOutput } from "../aiSafetySanitizer.js";
import { AI_MODULES } from "../../config/aiSafetyPolicy.js";

/**
 * @param {string} raw
 * @param {{ locale?: string, organLabel?: string }} options
 */
export function parseAndSanitizeBodyMapResponse(raw, options = {}) {
  const locale = options.locale === "en" ? "en" : "de";
  const { displayText, summaryRaw } = splitBodyMapAssistantResponse(raw);

  const safeDisplay = sanitizeAiOutput(displayText, {
    module: AI_MODULES.BODY_MAP,
    locale,
  });

  let summary = null;
  if (summaryRaw) {
    const normalized = normalizeBodyMapSummary(
      summaryRaw,
      options.organLabel || "",
    );
    if (normalized) {
      summary = {
        region: sanitizeField(normalized.region, locale),
        symptomSummary: sanitizeField(normalized.symptomSummary, locale),
        timeline: sanitizeField(normalized.timeline, locale),
        associatedFactors: sanitizeField(normalized.associatedFactors, locale),
        specialties: normalized.specialties.map((s) =>
          sanitizeField(s, locale),
        ),
        visitTopics: normalized.visitTopics.map((s) => sanitizeField(s, locale)),
      };
    }
  }

  return {
    text: safeDisplay.text,
    summary,
    safety: safeDisplay,
  };
}

function sanitizeField(value, locale) {
  const safe = sanitizeAiOutput(String(value || ""), {
    module: AI_MODULES.BODY_MAP,
    locale,
  });
  return safe.text;
}
