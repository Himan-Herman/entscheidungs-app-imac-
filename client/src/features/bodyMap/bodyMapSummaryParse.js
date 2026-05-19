export const BODY_MAP_JSON_START = "<<<MEDSCOUTX_BODY_MAP_JSON>>>";
export const BODY_MAP_JSON_END = "<<<END_MEDSCOUTX_BODY_MAP_JSON>>>";

/**
 * @param {string} raw
 * @returns {{ displayText: string, summaryRaw: object | null }}
 */
export function splitBodyMapAssistantResponse(raw) {
  const text = String(raw ?? "");
  const start = text.indexOf(BODY_MAP_JSON_START);
  if (start === -1) {
    return { displayText: text.trim(), summaryRaw: null };
  }

  const jsonStart = start + BODY_MAP_JSON_START.length;
  const end = text.indexOf(BODY_MAP_JSON_END, jsonStart);
  const displayText = (
    text.slice(0, start) + (end === -1 ? "" : text.slice(end + BODY_MAP_JSON_END.length))
  ).trim();

  const jsonSlice = (end === -1 ? text.slice(jsonStart) : text.slice(jsonStart, end)).trim();

  try {
    const summaryRaw = JSON.parse(jsonSlice);
    if (summaryRaw && typeof summaryRaw === "object") {
      return { displayText, summaryRaw };
    }
  } catch {
    /* ignore malformed JSON */
  }
  return { displayText, summaryRaw: null };
}

/**
 * @param {object | null} raw
 * @returns {import('./bodyMapTypes.js').BodyMapSummary | null}
 */
export function normalizeBodyMapSummary(raw, organLabel) {
  if (!raw || typeof raw !== "object") return null;

  const pick = (key) => {
    const v = raw[key];
    return typeof v === "string" ? v.trim() : "";
  };

  const specialties = Array.isArray(raw.specialties)
    ? raw.specialties.map((s) => String(s).trim()).filter(Boolean).slice(0, 3)
    : [];

  const visitTopics = Array.isArray(raw.visitTopics)
    ? raw.visitTopics.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
    : [];

  return {
    region: pick("region") || organLabel || "",
    symptomSummary: pick("symptomSummary") || pick("symptoms") || "",
    timeline: pick("timeline") || "",
    associatedFactors: pick("associatedFactors") || pick("factors") || "",
    specialties,
    visitTopics,
  };
}
